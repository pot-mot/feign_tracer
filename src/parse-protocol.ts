import type { ParseCacheOptions } from "./cache.ts";
import type { ParseTask, ParseTaskOutcome } from "./languages/parse-file.ts";

/** 主线程发给 worker 的一批解析任务；tasks 已按原始文件顺序切片。 */
export interface ParseBatchRequest {
    readonly type: "parse";
    readonly batchId: number;
    readonly tasks: readonly ParseTask[];
    /** 省略表示不启用解析缓存。 */
    readonly cache: ParseCacheOptions | undefined;
}

export interface ParseBatchResult {
    readonly type: "result";
    readonly batchId: number;
    readonly outcomes: readonly ParseTaskOutcome[];
}

export interface ParseBatchError {
    readonly type: "error";
    readonly batchId: number;
    readonly message: string;
}

export type ParseWorkerResponse = ParseBatchResult | ParseBatchError;

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

export const isParseBatchRequest = (value: unknown): value is ParseBatchRequest => {
    if (!isObject(value)) return false;
    return (
        value.type === "parse" && typeof value.batchId === "number" && Array.isArray(value.tasks)
    );
};

export const isParseWorkerResponse = (value: unknown): value is ParseWorkerResponse => {
    if (!isObject(value)) return false;
    if (typeof value.batchId !== "number") return false;
    if (value.type === "result") return Array.isArray(value.outcomes);
    if (value.type === "error") return typeof value.message === "string";
    return false;
};
