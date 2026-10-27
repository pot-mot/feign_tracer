import { parentPort, workerData } from "node:worker_threads";
import { createParseCache, type ParseCache } from "./cache.ts";
import { parseTask } from "./languages/parse-file.ts";
import {
    isParseTaskRequest,
    type ParseTaskError,
    type ParseTaskResult,
    type ParseWorkerData,
} from "./parse-protocol.ts";

/**
 * 解析 worker：一条消息只处理一个文件。
 *
 * 逐文件而不是逐批，是为了把主线程和 worker 的峰值都压到「同时只有一个
 * 文件被解析」；批处理会让一个 worker 在返回前把所有批次结果同时留在堆上，
 * 大文件项目里这正是内存峰值的来源。
 */
const port = parentPort;
if (port) {
    const options: ParseWorkerData | undefined =
        workerData !== null && typeof workerData === "object" ? workerData : undefined;
    const cache: ParseCache | undefined = options?.cache
        ? createParseCache(options.cache)
        : undefined;

    port.on("message", (message: unknown) => {
        if (!isParseTaskRequest(message)) return;
        try {
            const response: ParseTaskResult = {
                type: "result",
                taskId: message.taskId,
                outcome: parseTask(message.task, cache),
            };
            port.postMessage(response);
        } catch (error) {
            const response: ParseTaskError = {
                type: "error",
                taskId: message.taskId,
                message: error instanceof Error ? error.message : String(error),
            };
            port.postMessage(response);
        }
    });
}
