import { closeSync, mkdirSync, openSync, readSync, unlinkSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { StringDecoder } from "node:string_decoder";
import type { CallTreeNode } from "../model.ts";
import type { CallTreeRootType, CallTreeSink } from "../graph/calls.ts";

/**
 * 调用树暂存文件。
 *
 * 调用树是结果里节点数最多的一部分，而每个端点的树最多 2 万个节点；
 * 端点数量一多，把「所有端点的树」同时留在内存里就会线性膨胀。这里把
 * 每棵树在展开完成后立即追加到 NDJSON 文件，写入 SQLite 时再流式读回，
 * 于是常驻内存只剩当前正在展开的那棵树。
 *
 * 选择 NDJSON 而不是临时 SQLite：这个文件只顺序写、顺序读，一次都不查，
 * 用数据库反而要额外承担页缓存和索引开销。
 */

export interface SpoolRecord {
    readonly rootType: CallTreeRootType;
    readonly id: string;
    readonly node: CallTreeNode;
}

export interface TreeSpool {
    readonly path: string;
    readonly sink: CallTreeSink;
    /** 已暂存的节点数。 */
    readonly count: number;
    /** 冲刷缓冲并关闭文件；不删除文件。 */
    readonly close: () => void;
}

/** 攒够这么多行或这么多字符就落盘，兼顾系统调用次数与内存占用。 */
const FLUSH_LINES = 2000;
const FLUSH_CHARS = 1 << 18;

/**
 * 序列化时丢弃 `children`：子节点会作为独立记录写入，
 * 否则每个节点都会重复携带整棵子树。
 */
const dropChildren = (key: string, value: unknown): unknown =>
    key === "children" ? undefined : value;

export const createTreeSpool = (path: string): TreeSpool => {
    mkdirSync(dirname(path), { recursive: true });
    const fd = openSync(path, "w");

    const pending: string[] = [];
    let pendingChars = 0;
    let count = 0;
    let rootType: CallTreeRootType = "endpoint";
    let id = "";
    let closed = false;

    const flush = (): void => {
        if (pending.length === 0) return;
        writeSync(fd, pending.join(""));
        pending.length = 0;
        pendingChars = 0;
    };

    const sink: CallTreeSink = {
        begin: (nextRootType, nextId) => {
            rootType = nextRootType;
            id = nextId;
        },
        write: (node) => {
            const line = JSON.stringify({ r: rootType, i: id, n: node }, dropChildren);
            pending.push(line, "\n");
            pendingChars += line.length;
            count++;
            if (pending.length >= FLUSH_LINES * 2 || pendingChars >= FLUSH_CHARS) flush();
        },
        end: () => {
            // 单个根的记录必须整体可见；这里不强制刷盘，读取时按行切分即可。
        },
    };

    const close = (): void => {
        if (closed) return;
        closed = true;
        flush();
        closeSync(fd);
    };

    return {
        path,
        sink,
        get count() {
            return count;
        },
        close,
    };
};

export const removeTreeSpool = (path: string | undefined): void => {
    if (!path) return;
    try {
        unlinkSync(path);
    } catch {
        // 文件可能已经不在了，交给系统回收临时目录即可。
    }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isStringOrUndefined = (value: unknown): boolean =>
    value === undefined || typeof value === "string";

const isNumberOrUndefined = (value: unknown): boolean =>
    value === undefined || typeof value === "number";

const isStringArrayOrUndefined = (value: unknown): boolean =>
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"));

/**
 * 暂存文件是磁盘格式，读取回来必须逐字段校验再交给业务层。
 * 校验范围与 `call_nodes` 插入所需字段保持一致，不需要更多。
 */
const isCallTreeNode = (value: unknown): value is CallTreeNode => {
    if (!isObject(value)) return false;
    if (typeof value.seq !== "string" || typeof value.path !== "string") return false;
    if (typeof value.id !== "string" || typeof value.label !== "string") return false;
    if (typeof value.kind !== "string") return false;
    if (typeof value.order !== "number" || typeof value.depth !== "number") return false;
    if (!isStringOrUndefined(value.signature)) return false;
    if (!isStringOrUndefined(value.visibility)) return false;
    if (!isStringOrUndefined(value.moduleId)) return false;
    if (!isStringOrUndefined(value.file)) return false;
    if (!isNumberOrUndefined(value.line)) return false;
    if (!isNumberOrUndefined(value.callCount)) return false;
    if (!isStringOrUndefined(value.implementationOf)) return false;
    if (!isStringArrayOrUndefined(value.annotations)) return false;
    if (value.unresolved !== undefined && typeof value.unresolved !== "boolean") return false;
    if (value.cyclic !== undefined && typeof value.cyclic !== "boolean") return false;
    if (value.params !== undefined) {
        if (!Array.isArray(value.params)) return false;
        for (const param of value.params) {
            if (!isObject(param)) return false;
            if (typeof param.name !== "string" || typeof param.type !== "string") return false;
        }
    }
    if (value.feign !== undefined && !isObject(value.feign)) return false;
    if (value.remote !== undefined && !isObject(value.remote)) return false;
    // 子节点以独立记录存放，出现 children 说明写入侧序列化有问题。
    return value.children === undefined;
};

/**
 * 把磁盘上的短键记录还原成业务结构。写成短键是为了减少每行重复字段：
 * 一行节点可能上百万条，键名开销不可忽略。
 */
const parseRecord = (value: unknown): SpoolRecord | undefined => {
    if (!isObject(value)) return undefined;
    if (value.r !== "endpoint" && value.r !== "trace") return undefined;
    if (typeof value.i !== "string") return undefined;
    if (!isCallTreeNode(value.n)) return undefined;
    return { rootType: value.r, id: value.i, node: value.n };
};

/**
 * 同步流式读取暂存文件。逐行回调，调用方不需要把整个文件读进内存。
 * 用 StringDecoder 处理跨块的多字节字符，避免中文标签被截断成乱码。
 */
export const readTreeSpool = (path: string, onRecord: (record: SpoolRecord) => void): void => {
    const fd = openSync(path, "r");
    const decoder = new StringDecoder("utf8");
    const buffer = Buffer.allocUnsafe(1 << 16);
    let rest = "";

    try {
        for (;;) {
            const read = readSync(fd, buffer, 0, buffer.length, null);
            if (read <= 0) break;
            rest += decoder.write(buffer.subarray(0, read));
            let newline = rest.indexOf("\n");
            while (newline >= 0) {
                const line = rest.slice(0, newline);
                rest = rest.slice(newline + 1);
                if (line.length > 0) emit(line, onRecord);
                newline = rest.indexOf("\n");
            }
        }
        rest += decoder.end();
        if (rest.trim().length > 0) emit(rest, onRecord);
    } finally {
        closeSync(fd);
    }
};

const emit = (line: string, onRecord: (record: SpoolRecord) => void): void => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(line);
    } catch {
        // 暂存文件由本进程写入，损坏说明磁盘异常；跳过该行而不是中断整库写入。
        return;
    }
    const record = parseRecord(parsed);
    if (record) onRecord(record);
};
