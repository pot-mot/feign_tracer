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

const MB = 1024 * 1024;

/**
 * 自动内存预算。ANTLR 的 LL 预测峰值与源码字节数近似线性，
 * 多个 worker 同时解析大文件时最容易把进程推到几 GB 以上。
 * 可用 FEIGN_TRACER_PARSE_MEMORY_MB 覆盖（单位 MB）。
 */
export const DEFAULT_PARSE_MEMORY_MB = 6144;

/** worker 自身加载语法和运行时的基础内存，计入总预算但不计入单文件估算。 */
const WORKER_BASE_MB = 128;

/**
 * 单文件解析峰值约为源码字节的 640 倍（实测 3.4MB → 约 2GB）。
 * 这是保守估算，只用于限制并发，不参与结果计算。
 */
const PARSE_PEAK_MULTIPLIER = 640;

/** 空文件/极小文件也至少按 64KB 估算，避免估算值趋近于 0。 */
const MIN_TASK_BYTES = 64 * 1024;

const parseMemoryBudgetMb = (): number => {
    const raw = process.env.FEIGN_TRACER_PARSE_MEMORY_MB;
    if (raw === undefined || raw.trim() === "") return DEFAULT_PARSE_MEMORY_MB;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_PARSE_MEMORY_MB;
};

/**
 * 估算单个文件在 worker 内的峰值。返回值不含 worker 基础内存；
 * 调度器会先预留 `jobs × WORKER_BASE_MB`，再把剩余预算分给在途文件。
 */
export const estimateParseMemoryBytes = (task: ParseTask): number =>
    Math.max(task.bytes ?? 0, MIN_TASK_BYTES) * PARSE_PEAK_MULTIPLIER;

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

/**
 * 计算实际并发度，并保证小项目不会为 worker 启动时间买单。
 *
 * 这里只限制 worker 数量；真正决定「哪些文件可以同时解析」的是
 * `runPool` 里的字节预算调度，避免一个超大文件把所有并发都吃掉。
 */
export const resolveParseJobs = (requested: number, taskCount: number): number => {
    if (requested === 1 || taskCount === 0) return 1;
    const cores = Math.max(1, availableParallelism());
    const wanted = requested > 0 ? requested : Math.min(cores, MAX_AUTO_JOBS);
    const byBudget = Math.max(1, Math.floor((parseMemoryBudgetMb() * MB) / (WORKER_BASE_MB * MB)));
    const jobs = Math.max(
        1,
        Math.min(wanted, cores, byBudget, Math.ceil(taskCount / MIN_FILES_PER_WORKER)),
    );
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
 * 动态逐文件派发，并按字节预算限制同时在途的大文件。
 *
 * 每个 worker 的堆上最多只有正在解析的那一个文件；调度器再根据源码大小
 * 估算峰值，只有「已预留的 worker 基础内存 + 在途文件估算」不超过总预算时才
 * 继续派发。超过单次预算的超大文件会进入 `heavy` 队列，独占一个 worker 运行。
 * 这样既保留小文件的并发度，也避免 8 个大文件同时把内存推到十几 GB。
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
    /** 可以在预算内并行派发的普通文件。 */
    const light: number[] = [];
    /** 估算超过单次预算、必须独占运行的文件。 */
    const heavy: number[] = [];

    const budgetBytes = parseMemoryBudgetMb() * MB;
    const taskBudgetBytes = Math.max(
        MIN_TASK_BYTES * PARSE_PEAK_MULTIPLIER,
        budgetBytes - jobs * WORKER_BASE_MB * MB,
    );
    for (let index = 0; index < tasks.length; index++) {
        const estimate = estimateParseMemoryBytes(tasks[index]);
        (estimate > taskBudgetBytes ? heavy : light).push(index);
    }

    let activeBytes = 0;
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

        const allDone = (): boolean => light.length === 0 && heavy.length === 0 && busy.size === 0;

        const takeTask = (): number | undefined => {
            const nextLight = light[0];
            if (nextLight !== undefined) {
                const estimate = estimateParseMemoryBytes(tasks[nextLight]);
                // 空闲 worker 至少能领一个任务；有在途任务时必须留在预算内。
                if (busy.size === 0 || activeBytes + estimate <= taskBudgetBytes) {
                    light.shift();
                    activeBytes += estimate;
                    return nextLight;
                }
                return undefined;
            }

            // 超大文件独占运行，等所有在途任务结束后再派发。
            if (heavy.length === 0 || busy.size > 0) return undefined;
            const nextHeavy = heavy.shift();
            if (nextHeavy === undefined) return undefined;
            activeBytes = estimateParseMemoryBytes(tasks[nextHeavy]);
            return nextHeavy;
        };

        const pump = (): void => {
            if (settled) return;
            for (const worker of workers) {
                if (busy.has(worker)) continue;
                const taskId = takeTask();
                if (taskId === undefined) break;
                busy.set(worker, taskId);
                const request: ParseTaskRequest = { type: "task", taskId, task: tasks[taskId] };
                try {
                    worker.postMessage(request);
                } catch (error) {
                    fail(error instanceof Error ? error : new Error(String(error)));
                    return;
                }
            }
            if (allDone()) finish();
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
                    activeBytes = Math.max(
                        0,
                        activeBytes - estimateParseMemoryBytes(tasks[taskId]),
                    );

                    if (message.type === "error") {
                        fail(new Error(`parse worker failed: ${message.message}`));
                        return;
                    }
                    try {
                        deliver(taskId, message.outcome);
                    } catch (error) {
                        fail(error instanceof Error ? error : new Error(String(error)));
                        return;
                    }
                    pump();
                });
                worker.on("error", (error: Error) => fail(error));
                worker.on("exit", (code) => {
                    if (settled) return;
                    fail(new Error(`parse worker exited unexpectedly with code ${code}`));
                });
            }
        } catch (error) {
            fail(error instanceof Error ? error : new Error(String(error)));
            return;
        }

        pump();
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
