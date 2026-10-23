import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { ParseCacheOptions } from "./cache.ts";
import { createParseCache } from "./cache.ts";
import type { ParsedFile } from "./model.ts";
import { parseTasksInline, type ParseTask, type ParseTaskOutcome } from "./languages/parse-file.ts";
import { isParseWorkerResponse, type ParseBatchRequest } from "./parse-protocol.ts";

/** 自动模式下最多使用 8 个 worker，避免大机器上内存和语法初始化开销失控。 */
const MAX_AUTO_JOBS = 8;

/**
 * 每个 worker 至少要分到这么多文件才值得启动。
 * 单文件解析约 50~100ms，worker 首次加载 ANTLR 语法约 1.5s，
 * 因此每个 worker 至少需要约 1.5s 的工作量，否则并行反而更慢。
 */
const MIN_FILES_PER_WORKER = 24;

const MIN_BATCH_SIZE = 4;
const MAX_BATCH_SIZE = 64;

export interface ParsePoolOptions extends ParseCacheOptions {
    /** 0 表示按 CPU 核数自动选择，1 表示禁用并行。 */
    readonly jobs?: number;
    readonly onProgress?: (completed: number, total: number) => void;
}

export interface ParsePoolResult {
    /** 与输入任务一一对应，供 analyze 侧统一合并警告和模块计数。 */
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
const createWorker = (): Worker => {
    const tsUrl = new URL("./parse-worker.ts", import.meta.url);
    if (!existsSync(fileURLToPath(tsUrl))) {
        return new Worker(new URL("./parse-worker.js", import.meta.url));
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
    return new Worker(code, { eval: true });
};

interface Batch {
    readonly id: number;
    readonly start: number;
    readonly end: number;
}

const makeBatches = (taskCount: number, jobs: number): Batch[] => {
    const rawSize = Math.ceil(taskCount / (jobs * 8));
    const size = Math.min(MAX_BATCH_SIZE, Math.max(MIN_BATCH_SIZE, rawSize));
    const batches: Batch[] = [];
    for (let start = 0, id = 0; start < taskCount; start += size, id++) {
        batches.push({ id, start, end: Math.min(start + size, taskCount) });
    }
    return batches;
};

const runPool = (
    tasks: readonly ParseTask[],
    jobs: number,
    cache: ParseCacheOptions | undefined,
    onProgress: ParsePoolOptions["onProgress"],
): Promise<{ outcomes: ParseTaskOutcome[]; cacheHits: number }> => {
    const outcomes = new Array<ParseTaskOutcome | undefined>(tasks.length);
    const batches = makeBatches(tasks.length, jobs);
    const workers: Worker[] = [];
    const pending = new Map<Worker, Batch>();
    let nextBatch = 0;
    let completed = 0;
    let cacheHits = 0;
    let settled = false;

    return new Promise((resolve, reject) => {
        const terminateAll = (): Promise<unknown> =>
            Promise.allSettled(workers.map((worker) => worker.terminate()));

        const finish = (): void => {
            if (settled) return;
            const filled: ParseTaskOutcome[] = [];
            for (const entry of outcomes) {
                if (entry === undefined) {
                    settled = true;
                    void terminateAll().then(() =>
                        reject(new Error("parse worker returned an incomplete batch")),
                    );
                    return;
                }
                filled.push(entry);
            }
            settled = true;
            void terminateAll().then(() => resolve({ outcomes: filled, cacheHits }));
        };

        const fail = (error: Error): void => {
            if (settled) return;
            settled = true;
            void terminateAll().then(() => reject(error));
        };

        const dispatch = (worker: Worker): void => {
            const batch = batches[nextBatch];
            if (!batch) return;
            nextBatch++;
            pending.set(worker, batch);
            const request: ParseBatchRequest = {
                type: "parse",
                batchId: batch.id,
                tasks: tasks.slice(batch.start, batch.end),
                cache,
            };
            worker.postMessage(request);
        };

        for (let index = 0; index < jobs; index++) {
            const worker = createWorker();
            workers.push(worker);

            worker.on("message", (message: unknown) => {
                if (settled || !isParseWorkerResponse(message)) return;
                const batch = pending.get(worker);
                if (!batch || batch.id !== message.batchId) return;
                pending.delete(worker);

                if (message.type === "error") {
                    fail(new Error(`parse worker failed: ${message.message}`));
                    return;
                }
                if (message.outcomes.length !== batch.end - batch.start) {
                    fail(new Error("parse worker returned a mismatched batch"));
                    return;
                }
                for (let offset = 0; offset < message.outcomes.length; offset++) {
                    const outcome = message.outcomes[offset];
                    if (outcome === undefined) continue;
                    if (outcome.cacheHit) cacheHits++;
                    outcomes[batch.start + offset] = outcome;
                }
                completed += message.outcomes.length;
                onProgress?.(completed, tasks.length);
                if (completed >= tasks.length) {
                    finish();
                    return;
                }
                dispatch(worker);
            });
            worker.on("error", (error: Error) => fail(error));
            worker.on("exit", (code) => {
                if (settled) return;
                fail(new Error(`parse worker exited unexpectedly with code ${code}`));
            });

            dispatch(worker);
        }
    });
};

/**
 * 并行解析入口。所有结果都与 tasks 下标一一对应，因此输出顺序
 * 与单线程完全一致；worker 不可用时自动回退到同步解析。
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

    if (jobs <= 1) {
        const outcomes = parseTasksInline(tasks, cache);
        return toResult(outcomes, jobs);
    }

    try {
        const { outcomes, cacheHits } = await runPool(
            tasks,
            jobs,
            cacheOptions,
            options.onProgress,
        );
        const result = toResult(outcomes, jobs);
        return { ...result, cacheHits };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const outcomes = parseTasksInline(tasks, cache);
        const result = toResult(outcomes, 1);
        return {
            outcomes: result.outcomes,
            parsed: result.parsed,
            warnings: [
                `Parallel parsing unavailable, fell back to single thread: ${message}`,
                ...result.warnings,
            ],
            cacheHits: result.cacheHits,
            jobs: 1,
        };
    }
};

const toResult = (outcomes: readonly ParseTaskOutcome[], jobs: number): ParsePoolResult => {
    const parsed: ParsedFile[] = [];
    const warnings: string[] = [];
    let cacheHits = 0;
    for (const outcome of outcomes) {
        parsed.push(outcome.parsed);
        if (outcome.warning) warnings.push(outcome.warning);
        if (outcome.cacheHit) cacheHits++;
    }
    return { outcomes, parsed, warnings, cacheHits, jobs };
};
