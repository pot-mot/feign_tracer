import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { ParseCacheOptions } from "./cache.ts";
import { createParseCache } from "./cache.ts";
import type { ParsedFile } from "./model.ts";
import { parseTask, type ParseTask, type ParseTaskOutcome } from "./languages/parse-file.ts";
import {
    isParseWorkerResponse,
    type ParseTaskRequest,
    type ParseWorkerData,
} from "./parse-protocol.ts";

/** 自动模式下最多使用 8 个 worker，避免大机器上内存和语法初始化开销失控。 */
const MAX_AUTO_JOBS = 8;

/**
 * 每个 worker 至少要分到这么多文件才值得启动。
 * 单文件解析约 50~100ms，worker 首次加载 ANTLR 语法约 1.5s，
 * 因此每个 worker 至少需要约 1.5s 的工作量，否则并行反而更慢。
 */
const MIN_FILES_PER_WORKER = 24;

export interface ParsePoolOptions extends ParseCacheOptions {
    /** 0 表示按 CPU 核数自动选择，1 表示禁用并行。 */
    readonly jobs?: number;
    readonly onProgress?: (completed: number, total: number) => void;
    /**
     * 逐文件交付回调。提供后解析结果不再累积，内存里只保留「在途」的文件；
     * 此时返回值中的 `outcomes` / `parsed` 为空数组。
     */
    readonly onFile?: (index: number, outcome: ParseTaskOutcome) => void;
}

export interface ParsePoolResult {
    /** 与输入任务一一对应；使用 `onFile` 时为空。 */
    readonly outcomes: readonly ParseTaskOutcome[];
    readonly parsed: ParsedFile[];
    readonly warnings: string[];
    readonly cacheHits: number;
    /** 实际使用的 worker 数；1 表示走了单线程回退。 */
    readonly jobs: number;
}

/** 计算实际并发度，并保证小项目不会为 worker 启动时间买单。 */
export const resolveParseJobs = (requested: number, taskCount: number): number => {
    if (requested === 1 || taskCount === 0) return 1;
    const cores = Math.max(1, availableParallelism());
    const wanted = requested > 0 ? requested : Math.min(cores, MAX_AUTO_JOBS);
    const jobs = Math.max(1, Math.min(wanted, cores, Math.ceil(taskCount / MIN_FILES_PER_WORKER)));
    return jobs;
};

/**
 * Worker 入口在开发态是 .ts，构建产物是 .js。
 *
 * Node 的 worker 不会继承主线程通过 --import 注册的 tsx 加载器
 * （execArgv 传 --import 也不生效），因此开发态用 eval 引导脚本：
 * 先在 worker 内 register()，再动态导入 TS 入口。构建产物走原生 ESM。
 */
const createWorker = (cache: ParseCacheOptions | undefined): Worker => {
    const workerData: ParseWorkerData = { cache };
    const tsUrl = new URL("./parse-worker.ts", import.meta.url);
    if (!existsSync(fileURLToPath(tsUrl))) {
        return new Worker(new URL("./parse-worker.js", import.meta.url), { workerData });
    }

    const require = createRequire(import.meta.url);
    const tsxApi = require.resolve("tsx/cjs/api");
    const entry = fileURLToPath(tsUrl);
    const code = `(() => {
    try {
        const { register } = require(${JSON.stringify(tsxApi)});
        register();
        require(${JSON.stringify(entry)});
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();`;
    return new Worker(code, { eval: true, workerData });
};

type Deliver = (index: number, outcome: ParseTaskOutcome) => void;

/**
 * 动态逐文件派发。
 *
 * 相比「按文件数切批」，这里由 worker 完成一个就领一个：
 * 每个 worker 的堆上最多只有正在解析的那一个文件（加上 postMessage 的
 * 结构化克隆副本），负载也天然均衡，不需要预估单文件耗时或字节数。
 */
const runPool = (
    tasks: readonly ParseTask[],
    jobs: number,
    cache: ParseCacheOptions | undefined,
    deliver: Deliver,
): Promise<void> => {
    const workers: Worker[] = [];
    /** worker -> 当前在途任务下标 */
    const busy = new Map<Worker, number>();
    let nextIndex = 0;
    let settled = false;

    return new Promise<void>((resolve, reject) => {
        const terminateAll = (): Promise<unknown> =>
            Promise.allSettled(workers.map((worker) => worker.terminate()));

        const finish = (): void => {
            if (settled) return;
            settled = true;
            void terminateAll().then(() => resolve());
        };

        const fail = (error: Error): void => {
            if (settled) return;
            settled = true;
            void terminateAll().then(() => reject(error));
        };

        const dispatch = (worker: Worker): void => {
            if (settled || nextIndex >= tasks.length) return;
            const taskId = nextIndex;
            nextIndex++;
            busy.set(worker, taskId);
            const request: ParseTaskRequest = { type: "task", taskId, task: tasks[taskId] };
            worker.postMessage(request);
        };

        try {
            for (let index = 0; index < jobs; index++) {
                const worker = createWorker(cache);
                workers.push(worker);

                worker.on("message", (message: unknown) => {
                    if (settled || !isParseWorkerResponse(message)) return;
                    const taskId = busy.get(worker);
                    if (taskId === undefined || message.taskId !== taskId) return;
                    busy.delete(worker);

                    if (message.type === "error") {
                        fail(new Error(`parse worker failed: ${message.message}`));
                        return;
                    }
                    deliver(taskId, message.outcome);
                    dispatch(worker);
                    if (nextIndex >= tasks.length && busy.size === 0) finish();
                });
                worker.on("error", (error: Error) => fail(error));
                worker.on("exit", (code) => {
                    if (settled) return;
                    fail(new Error(`parse worker exited unexpectedly with code ${code}`));
                });

                dispatch(worker);
            }
        } catch (error) {
            fail(error instanceof Error ? error : new Error(String(error)));
            return;
        }

        if (tasks.length === 0) finish();
    });
};

/** 单线程路径同样逐文件交付，保证「峰值只与一个文件有关」的对齐。 */
const runInline = (
    tasks: readonly ParseTask[],
    cache: ReturnType<typeof createParseCache> | undefined,
    deliver: Deliver,
    delivered: Uint8Array | undefined,
): void => {
    for (let index = 0; index < tasks.length; index++) {
        if (delivered?.[index] === 1) continue;
        deliver(index, parseTask(tasks[index], cache));
    }
};

/**
 * 并行解析入口。所有结果都与 tasks 下标一一对应，因此输出顺序
 * 与单线程完全一致；worker 不可用时只补跑未交付的文件，避免重复计入
 * 模块文件数或工作库。
 */
export const parseFilesInPool = async (
    tasks: readonly ParseTask[],
    options: ParsePoolOptions,
): Promise<ParsePoolResult> => {
    if (tasks.length === 0) {
        return { outcomes: [], parsed: [], warnings: [], cacheHits: 0, jobs: 1 };
    }

    // 只把可结构化克隆的缓存选项传给 worker；onProgress 是函数，不能进入消息。
    const cacheOptions: ParseCacheOptions | undefined = options.cacheDir
        ? {
              cacheDir: options.cacheDir,
              root: options.root,
              rebuildDir: options.rebuildDir,
          }
        : undefined;
    const cache = cacheOptions ? createParseCache(cacheOptions) : undefined;
    const jobs = resolveParseJobs(options.jobs ?? 0, tasks.length);

    const collected: Array<ParseTaskOutcome | undefined> | undefined = options.onFile
        ? undefined
        : new Array<ParseTaskOutcome | undefined>(tasks.length);
    const delivered = new Uint8Array(tasks.length);
    const warnings: string[] = [];
    let cacheHits = 0;
    let completed = 0;

    const deliver: Deliver = (index, outcome) => {
        if (delivered[index] === 1) return;
        delivered[index] = 1;
        if (outcome.cacheHit) cacheHits++;
        completed++;
        options.onFile?.(index, outcome);
        if (collected) collected[index] = outcome;
        options.onProgress?.(completed, tasks.length);
    };

    let actualJobs = jobs;
    if (jobs <= 1) {
        runInline(tasks, cache, deliver, delivered);
    } else {
        try {
            await runPool(tasks, jobs, cacheOptions, deliver);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            warnings.push(`Parallel parsing unavailable, fell back to single thread: ${message}`);
            runInline(tasks, cache, deliver, delivered);
            actualJobs = 1;
        }
    }

    const outcomes: ParseTaskOutcome[] = [];
    const parsed: ParsedFile[] = [];
    for (const outcome of collected ?? []) {
        if (!outcome) continue;
        outcomes.push(outcome);
        parsed.push(outcome.parsed);
    }

    return { outcomes, parsed, warnings, cacheHits, jobs: actualJobs };
};
