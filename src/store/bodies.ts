import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sqlite3 from "node-sqlite3-wasm";
import type { CallSite, LocalVar, MethodInfo, ParsedFile, TypeInfo } from "../model.ts";

const { Database } = sqlite3;

/**
 * 方法体是解析结果里体积最大、但访问最局部的一部分：
 * 每个调用点都要保存原始参数表达式，一个 3.4MB 的 Java 文件解析后
 * 光方法体就可能占十几 MB。而调用链展开和依赖边统计都是一次只读一个
 * 方法，所以让它整体常驻内存没有收益。
 *
 * 这里把方法体按 `method_id` 存成一行 JSON，落盘后即可从 MethodInfo
 * 剥离；读取侧带 LRU，保证同一方法在「建树 → 统计依赖 → 统计 resolved
 * 调用数」多次访问之间不会反复查库。
 *
 * 之所以整数组存 JSON 而不是拆成 calls/locals 行：单个方法的调用点通常
 * 只有几十个，JSON 一行的开销远小于逐行插入的往返成本，同时直接复用
 * CallSite/LocalVar 的结构，不需要在读写两侧维护列映射。
 */
export interface MethodBody {
    readonly calls: readonly CallSite[];
    readonly locals: readonly LocalVar[];
}

export interface BodyStore {
    /** 保存方法体。写入进入当前事务，由 `flush()` 决定提交时机。 */
    readonly save: (method: MethodInfo) => void;
    /** 提交当前事务；未提交的事务会持有回滚日志并拖高内存。 */
    readonly flush: () => void;
    /** 按方法 id 读取方法体；不存在时返回 undefined。 */
    readonly load: (methodId: string) => MethodBody | undefined;
    /** 提交剩余写入、关闭连接并删除工作库文件。 */
    readonly close: () => void;
    readonly path: string;
}

export interface BodyStoreOptions {
    /** 指定工作库文件；省略时在系统临时目录创建。 */
    readonly path?: string;
    /** 内存中保留的方法体条数上限。 */
    readonly cacheEntries?: number;
}

const SCHEMA = `
DROP TABLE IF EXISTS method_bodies;
CREATE TABLE method_bodies (
  method_id  TEXT PRIMARY KEY,
  calls_json TEXT NOT NULL,
  locals_json TEXT NOT NULL
);
`;

/** 默认 LRU 容量：单个方法体通常几 KB，2048 条约 10MB 级别。 */
const DEFAULT_CACHE_ENTRIES = 2048;

/** 未提交写入超过该条数就自动提交，避免事务无限增长。 */
const AUTO_COMMIT_ENTRIES = 2048;

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isCallSite = (value: unknown): value is CallSite => {
    if (!isObject(value)) return false;
    return (
        typeof value.name === "string" &&
        typeof value.qualifierKind === "string" &&
        typeof value.argCount === "number" &&
        Array.isArray(value.args)
    );
};

const isLocalVar = (value: unknown): value is LocalVar => {
    if (!isObject(value)) return false;
    return typeof value.name === "string" && typeof value.line === "number";
};

/** JSON.parse 的返回值必须经过校验层；任一条目不合法就整条丢弃。 */
const decodeArray = <T>(raw: unknown, guard: (value: unknown) => value is T): T[] | undefined => {
    if (typeof raw !== "string") return undefined;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return undefined;
    }
    if (!Array.isArray(parsed)) return undefined;
    const items: unknown[] = parsed;
    const result: T[] = [];
    for (const item of items) {
        if (!guard(item)) return undefined;
        result.push(item);
    }
    return result;
};

/**
 * 创建方法体工作库。默认文件在 `close()` 时删除：它是可丢弃的中间产物，
 * 文件名带 pid 与进程内序号，崩溃残留不会影响下一次运行。
 */
export const createBodyStore = (options: BodyStoreOptions = {}): BodyStore => {
    const path = options.path ?? defaultPath();
    const cacheEntries = Math.max(16, options.cacheEntries ?? DEFAULT_CACHE_ENTRIES);
    const db = new Database(path);

    // 工作库不追求崩溃安全，只需要写入吞吐。
    db.exec("PRAGMA journal_mode = OFF");
    db.exec("PRAGMA synchronous = OFF");
    db.exec("PRAGMA temp_store = FILE");
    db.exec("PRAGMA cache_size = -32768");
    db.exec(SCHEMA);

    const insert = db.prepare(
        "INSERT OR REPLACE INTO method_bodies (method_id, calls_json, locals_json) VALUES (?, ?, ?)",
    );
    const select = db.prepare(
        "SELECT calls_json, locals_json FROM method_bodies WHERE method_id = ?",
    );

    const cache = new Map<string, MethodBody>();
    let inTransaction = false;
    let pending = 0;
    let closed = false;

    const commit = (): void => {
        if (!inTransaction) return;
        db.exec("COMMIT");
        inTransaction = false;
        pending = 0;
    };

    /** Map 保持插入顺序，删掉最早插入的键即可实现 LRU 淘汰。 */
    const trimCache = (): void => {
        while (cache.size > cacheEntries) {
            const oldest = cache.keys().next();
            if (oldest.done === true) return;
            cache.delete(oldest.value);
        }
    };

    const save = (method: MethodInfo): void => {
        if (closed) return;
        if (!inTransaction) {
            db.exec("BEGIN");
            inTransaction = true;
        }
        insert.run([
            method.id,
            JSON.stringify(method.calls ?? []),
            JSON.stringify(method.locals ?? []),
        ]);
        pending++;
        if (pending >= AUTO_COMMIT_ENTRIES) commit();
    };

    const load = (methodId: string): MethodBody | undefined => {
        const cached = cache.get(methodId);
        if (cached) {
            // 命中后重新插入，维持 LRU 顺序。
            cache.delete(methodId);
            cache.set(methodId, cached);
            return cached;
        }
        if (closed) return undefined;

        const row = select.get([methodId]);
        if (!row) return undefined;
        // 读到的行放进 LRU：调用链展开、依赖统计、resolved 计数会反复访问同一批方法。
        const body: MethodBody = {
            calls: decodeArray(row.calls_json, isCallSite) ?? [],
            locals: decodeArray(row.locals_json, isLocalVar) ?? [],
        };
        cache.set(methodId, body);
        trimCache();
        return body;
    };

    const close = (): void => {
        if (closed) return;
        try {
            commit();
        } catch {
            // 提交失败说明工作库已不可用，继续清理流程。
        }
        closed = true;
        for (const statement of [insert, select]) {
            try {
                statement.finalize();
            } catch {
                // 语句可能已随连接失效，忽略。
            }
        }
        try {
            db.close();
        } catch {
            // 忽略关闭错误。
        }
        cache.clear();
        try {
            unlinkSync(path);
        } catch {
            // 文件可能已被清理或仍被占用，交给系统临时目录回收。
        }
    };

    return { save, flush: commit, load, close, path };
};

let sequence = 0;

const defaultPath = (): string => {
    sequence++;
    return join(tmpdir(), `feign-tracer-bodies-${process.pid}-${sequence}.db`);
};

export interface DistillStats {
    readonly methods: number;
    readonly calls: number;
    readonly locals: number;
}

/**
 * 把一个文件的全部方法体转存到工作库，并从内存结构中剥离。
 *
 * 调用点数量必须在这里统计：剥离之后 `method.calls` 已经不存在，
 * 事后无法再回溯 `stats.calls`。`store` 省略时只统计不剥离，用作
 * 小项目/测试的对照路径。
 */
export const detachBodies = (store: BodyStore | undefined, file: ParsedFile): DistillStats => {
    let methods = 0;
    let calls = 0;
    let locals = 0;

    const walk = (type: TypeInfo): void => {
        for (const method of type.methods) {
            const methodCalls = method.calls;
            const methodLocals = method.locals;
            if (methodCalls === undefined && methodLocals === undefined) continue;

            calls += methodCalls?.length ?? 0;
            locals += methodLocals?.length ?? 0;
            if ((methodCalls?.length ?? 0) === 0 && (methodLocals?.length ?? 0) === 0) continue;

            methods++;
            if (!store) continue;
            store.save(method);
            // 先落库再删字段：只要 save 抛错，内存里的数据仍然完整。
            delete method.calls;
            delete method.locals;
        }
        for (const nested of type.nested) walk(nested);
    };

    for (const type of file.types) walk(type);
    return { methods, calls, locals };
};
