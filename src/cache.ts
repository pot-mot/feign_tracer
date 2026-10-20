import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { ParsedFile } from "./model.ts";

/** 语言提取器或 ParsedFile 结构变化时递增，旧缓存会自动失效。 */
export const PARSE_CACHE_VERSION = 1;

interface CacheRecord {
    version: number;
    mtimeMs: number;
    size: number;
    moduleId?: string;
    parsed: ParsedFile;
}

export interface ParseCacheOptions {
    /** 缓存根目录；省略表示关闭缓存。 */
    readonly cacheDir?: string;
    /** 被分析项目的根目录，缓存按根目录分区。 */
    readonly root: string;
    /** 该绝对目录下的文件强制重新解析。 */
    readonly rebuildDir?: string;
}

export interface ParseCache {
    readonly load: (absPath: string, moduleId?: string) => ParsedFile | undefined;
    readonly save: (absPath: string, parsed: ParsedFile, moduleId?: string) => void;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

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

const isCacheRecord = (value: unknown): value is CacheRecord => {
    if (!isObject(value)) return false;
    return (
        typeof value.version === "number" &&
        typeof value.mtimeMs === "number" &&
        typeof value.size === "number" &&
        isParsedFile(value.parsed)
    );
};

const hashPath = (value: string): string =>
    createHash("sha1").update(value.toLowerCase()).digest("hex");

const isUnder = (absPath: string, dir: string): boolean => {
    const path = resolve(absPath).toLowerCase();
    const base = resolve(dir).toLowerCase();
    if (path === base) return true;
    const rel = relative(base, path);
    return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`);
};

/**
 * 单文件解析缓存。命中条件同时校验 mtime、size 与模块归属，
 * 任一变化都会重新解析；缓存失败不会影响主流程。
 */
export const createParseCache = (options: ParseCacheOptions): ParseCache => {
    const cacheDir = options.cacheDir ? resolve(options.cacheDir) : undefined;
    const rebuildDir = options.rebuildDir ? resolve(options.rebuildDir) : undefined;
    const rootKey = hashPath(resolve(options.root));

    const entryPath = (absPath: string): string | undefined => {
        if (!cacheDir) return undefined;
        return join(cacheDir, rootKey, `${hashPath(absPath)}.json`);
    };

    const load = (absPath: string, moduleId?: string): ParsedFile | undefined => {
        const target = entryPath(absPath);
        if (!target || !cacheDir) return undefined;
        if (rebuildDir && isUnder(absPath, rebuildDir)) return undefined;

        try {
            const stat = statSync(absPath);
            const raw: unknown = JSON.parse(readFileSync(target, "utf8"));
            if (!isCacheRecord(raw)) return undefined;
            if (raw.version !== PARSE_CACHE_VERSION) return undefined;
            if (raw.mtimeMs !== stat.mtimeMs || raw.size !== stat.size) return undefined;
            if ((raw.moduleId ?? "") !== (moduleId ?? "")) return undefined;
            return raw.parsed;
        } catch {
            return undefined;
        }
    };

    const save = (absPath: string, parsed: ParsedFile, moduleId?: string): void => {
        const target = entryPath(absPath);
        if (!target || !cacheDir) return;
        try {
            const stat = statSync(absPath);
            const record: CacheRecord = {
                version: PARSE_CACHE_VERSION,
                mtimeMs: stat.mtimeMs,
                size: stat.size,
                moduleId,
                parsed,
            };
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, JSON.stringify(record), "utf8");
        } catch {
            // 缓存只是性能优化，失败时静默忽略。
        }
    };

    return { load, save };
};
