import { parentPort } from "node:worker_threads";
import { createParseCache } from "./cache.ts";
import { parseTasksInline } from "./languages/parse-file.ts";
import {
    isParseBatchRequest,
    type ParseBatchError,
    type ParseBatchResult,
} from "./parse-protocol.ts";

/**
 * 解析 worker：只接收批量文件任务，返回按原顺序排列的解析结果。
 * 缓存读写也放在 worker 内，冷启动时可以把磁盘 I/O 摊到多个核上。
 */
const port = parentPort;
if (port) {
    // 同一 worker 的所有批次共享缓存对象，避免每批重复计算缓存目录哈希。
    let cache: ReturnType<typeof createParseCache> | undefined;
    let cacheReady = false;

    port.on("message", (message: unknown) => {
        if (!isParseBatchRequest(message)) return;

        try {
            if (!cacheReady) {
                cache = message.cache ? createParseCache(message.cache) : undefined;
                cacheReady = true;
            }
            const outcomes = parseTasksInline(message.tasks, cache);
            const response: ParseBatchResult = {
                type: "result",
                batchId: message.batchId,
                outcomes,
            };
            port.postMessage(response);
        } catch (error) {
            const response: ParseBatchError = {
                type: "error",
                batchId: message.batchId,
                message: error instanceof Error ? error.message : String(error),
            };
            port.postMessage(response);
        }
    });
}
