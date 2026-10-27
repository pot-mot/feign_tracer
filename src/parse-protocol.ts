import type { ParseCacheOptions } from "./cache.ts";
import type { ParseTask, ParseTaskOutcome } from "./languages/parse-file.ts";
import type { ParsedFile } from "./model.ts";

/** 主线程下发给 worker 的单个解析任务。 */
export interface ParseTaskRequest {
    readonly type: "task";
    readonly taskId: number;
    readonly task: ParseTask;
}

/** worker 创建缓存所需的选项，随 workerData 传入，不占用每条消息。 */
export interface ParseWorkerData {
    readonly cache: ParseCacheOptions | undefined;
}

export interface ParseTaskResult {
    readonly type: "result";
    readonly taskId: number;
    readonly outcome: ParseTaskOutcome;
}

export interface ParseTaskError {
    readonly type: "error";
    readonly taskId: number;
    readonly message: string;
}

export type ParseWorkerResponse = ParseTaskResult | ParseTaskError;

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isParseTask = (value: unknown): value is ParseTask => {
    if (!isObject(value)) return false;
    if (typeof value.absPath !== "string" || typeof value.relPath !== "string") return false;
    if (value.kind !== "java" && value.kind !== "kotlin" && value.kind !== "groovy") return false;
    return value.moduleId === undefined || typeof value.moduleId === "string";
};

const isParsedFile = (value: unknown): value is ParsedFile => {
    if (!isObject(value)) return false;
    return (
        typeof value.path === "string" &&
        typeof value.absPath === "string" &&
        typeof value.language === "string" &&
        typeof value.packageName === "string" &&
        Array.isArray(value.imports) &&
        Array.isArray(value.types) &&
        typeof value.parseErrors === "number" &&
        typeof value.lineCount === "number"
    );
};

const isParseTaskOutcome = (value: unknown): value is ParseTaskOutcome => {
    if (!isObject(value)) return false;
    if (typeof value.cacheHit !== "boolean") return false;
    if (value.warning !== undefined && typeof value.warning !== "string") return false;
    return isParsedFile(value.parsed);
};

export const isParseTaskRequest = (value: unknown): value is ParseTaskRequest => {
    if (!isObject(value)) return false;
    if (value.type !== "task") return false;
    if (typeof value.taskId !== "number") return false;
    return isParseTask(value.task);
};

export const isParseWorkerResponse = (value: unknown): value is ParseWorkerResponse => {
    if (!isObject(value)) return false;
    if (typeof value.taskId !== "number") return false;
    if (value.type === "result") return isParseTaskOutcome(value.outcome);
    if (value.type === "error") return typeof value.message === "string";
    return false;
};
