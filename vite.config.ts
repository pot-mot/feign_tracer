import { defineConfig, type Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { analyzeDirectoryAsync } from "./src/analyze.ts";
import { writeAnalysisToSqlite } from "./src/store/sqlite.ts";

const readBody = (request: IncomingMessage): Promise<string> => {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        request.on("data", (chunk: Buffer) => chunks.push(chunk));
        request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        request.on("error", reject);
    });
};

const json = (response: ServerResponse, status: number, value: unknown): void => {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(value));
};

interface AnalyzePayload {
    readonly root?: string;
    readonly maxDepth?: number;
    readonly includeExternal?: boolean;
    readonly followFeign?: boolean;
    readonly includeSource?: boolean;
    readonly excludeSelfCalls?: boolean;
    readonly classFilters?: string[];
    readonly ignore?: string[];
    readonly keywords?: string[];
    readonly classNames?: string[];
    readonly methodNames?: string[];
    readonly buildTrees?: boolean;
    readonly rebuildDir?: string;
    readonly useCache?: boolean;
    readonly cacheDir?: string;
    readonly fresh?: boolean;
    readonly dbPath?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const stringValue = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

const numberValue = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

const booleanValue = (value: unknown): boolean | undefined =>
    typeof value === "boolean" ? value : undefined;

const stringArray = (value: unknown): string[] | undefined =>
    Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;

const parseAnalyzePayload = (value: unknown): AnalyzePayload | undefined => {
    if (!isRecord(value)) return undefined;
    return {
        root: stringValue(value.root),
        maxDepth: numberValue(value.maxDepth),
        includeExternal: booleanValue(value.includeExternal),
        followFeign: booleanValue(value.followFeign),
        includeSource: booleanValue(value.includeSource),
        excludeSelfCalls: booleanValue(value.excludeSelfCalls),
        classFilters: stringArray(value.classFilters),
        ignore: stringArray(value.ignore),
        keywords: stringArray(value.keywords),
        classNames: stringArray(value.classNames),
        methodNames: stringArray(value.methodNames),
        buildTrees: booleanValue(value.buildTrees),
        rebuildDir: stringValue(value.rebuildDir),
        useCache: booleanValue(value.useCache),
        cacheDir: stringValue(value.cacheDir),
        fresh: booleanValue(value.fresh),
        dbPath: stringValue(value.dbPath),
    };
};

const analyzeMiddleware = async (request: IncomingMessage, response: ServerResponse) => {
    try {
        if (request.method === "GET") {
            json(response, 200, { root: process.cwd() });
            return;
        }
        if (request.method !== "POST") {
            json(response, 405, { error: "Use POST" });
            return;
        }
        const body = await readBody(request);
        const parsed: unknown = JSON.parse(body);
        const payload = parseAnalyzePayload(parsed);
        if (!payload?.root) {
            json(response, 400, { error: "root is required" });
            return;
        }
        const keywords = payload.keywords ?? [];
        const classNames = payload.classNames ?? [];
        const methodNames = payload.methodNames ?? [];
        const buildTrees = payload.buildTrees !== false;
        const incremental =
            !payload.fresh &&
            (keywords.length > 0 ||
                classNames.length > 0 ||
                methodNames.length > 0 ||
                Boolean(payload.rebuildDir) ||
                !buildTrees);
        const result = await analyzeDirectoryAsync({
            root: payload.root,
            maxDepth: payload.maxDepth,
            includeExternal: payload.includeExternal,
            followFeign: payload.followFeign,
            includeSource: payload.includeSource,
            excludeSelfCalls: payload.excludeSelfCalls,
            classFilters: payload.classFilters,
            ignore: payload.ignore,
            keywords,
            classNames,
            methodNames,
            buildTrees,
            rebuildDir: payload.rebuildDir,
            useCache: payload.useCache,
            cacheDir: payload.cacheDir,
        });
        if (payload.dbPath && payload.dbPath.trim()) {
            const info = writeAnalysisToSqlite(result, payload.dbPath.trim(), {
                merge: incremental,
            });
            json(response, 200, { ...result, dbPath: info.path, dbBytes: info.bytes });
            return;
        }
        json(response, 200, result);
    } catch (error) {
        json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
};

const apiPlugin = (): Plugin => {
    return {
        name: "feign-tracer-api",
        configureServer(server) {
            server.middlewares.use("/api/analyze", analyzeMiddleware);
        },
        configurePreviewServer(server) {
            server.middlewares.use("/api/analyze", analyzeMiddleware);
        },
    };
};

export default defineConfig({
    base: "./",
    plugins: [apiPlugin()],
    build: {
        outDir: "dist/web",
        emptyOutDir: true,
    },
});
