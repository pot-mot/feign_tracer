import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { analyzeDirectoryAsync } from "./src/analyze.ts";
import {
    deleteDatabaseRow,
    insertDatabaseRow,
    loadDatabaseRows,
    loadDatabaseSchema,
    loadProjectOptions,
    loadSavedProjects,
    isProjectOptionKind,
    updateDatabaseRow,
} from "./src/store/db-admin.ts";
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
    readonly forceRescan?: boolean;
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
        forceRescan: booleanValue(value.forceRescan),
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
        const dbPath = payload.dbPath?.trim();
        const databaseExists = dbPath ? existsSync(resolve(dbPath)) : false;
        const incremental =
            !payload.fresh &&
            (keywords.length > 0 ||
                classNames.length > 0 ||
                methodNames.length > 0 ||
                Boolean(payload.rebuildDir) ||
                !buildTrees ||
                databaseExists);
        const result = await analyzeDirectoryAsync(
            {
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
                forceReparse: payload.forceRescan === true,
            },
            { projectDbPath: dbPath },
        );
        if (dbPath) {
            const info = writeAnalysisToSqlite(result, dbPath, {
                merge: incremental,
                preserveProject: true,
            });
            json(response, 200, { ...result, dbPath: info.path, dbBytes: info.bytes });
            return;
        }
        json(response, 200, result);
    } catch (error) {
        json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
};

const queryParam = (request: IncomingMessage, name: string): string | undefined => {
    const url = new URL(request.url ?? "/", "http://localhost");
    return url.searchParams.get(name) ?? undefined;
};

const dbSchemaMiddleware = (request: IncomingMessage, response: ServerResponse): void => {
    try {
        if (request.method !== "GET") {
            json(response, 405, { error: "Use GET" });
            return;
        }
        const dbPath = queryParam(request, "path");
        if (!dbPath) {
            json(response, 400, { error: "path is required" });
            return;
        }
        json(response, 200, loadDatabaseSchema(dbPath));
    } catch (error) {
        json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
};

interface DbMutationPayload {
    readonly path?: string;
    readonly table?: string;
    readonly values?: Record<string, unknown>;
    readonly where?: Record<string, unknown>;
}

const parseDbMutationPayload = (value: unknown): DbMutationPayload | undefined => {
    if (!isRecord(value)) return undefined;
    return {
        path: stringValue(value.path),
        table: stringValue(value.table),
        values: isRecord(value.values) ? value.values : undefined,
        where: isRecord(value.where) ? value.where : undefined,
    };
};

const dbRowsMiddleware = async (
    request: IncomingMessage,
    response: ServerResponse,
): Promise<void> => {
    try {
        if (request.method === "GET") {
            const dbPath = queryParam(request, "path");
            const table = queryParam(request, "table");
            if (!dbPath || !table) {
                json(response, 400, { error: "path and table are required" });
                return;
            }
            const limit = numberValue(Number(queryParam(request, "limit")));
            const offset = numberValue(Number(queryParam(request, "offset")));
            json(response, 200, loadDatabaseRows(dbPath, table, limit, offset));
            return;
        }

        if (request.method !== "POST" && request.method !== "PUT" && request.method !== "DELETE") {
            json(response, 405, { error: "Use GET, POST, PUT or DELETE" });
            return;
        }

        const body = await readBody(request);
        const parsed: unknown = JSON.parse(body);
        const payload = parseDbMutationPayload(parsed);
        if (!payload?.path || !payload.table) {
            json(response, 400, { error: "path and table are required" });
            return;
        }
        if (request.method === "POST") {
            json(
                response,
                200,
                insertDatabaseRow(payload.path, payload.table, payload.values ?? {}),
            );
            return;
        }
        if (!payload.where) {
            json(response, 400, { error: "where is required" });
            return;
        }
        if (request.method === "PUT") {
            json(
                response,
                200,
                updateDatabaseRow(payload.path, payload.table, payload.where, payload.values ?? {}),
            );
            return;
        }
        json(response, 200, deleteDatabaseRow(payload.path, payload.table, payload.where));
    } catch (error) {
        json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
};

const projectOptionsMiddleware = (request: IncomingMessage, response: ServerResponse): void => {
    try {
        if (request.method !== "GET") {
            json(response, 405, { error: "Use GET" });
            return;
        }
        const dbPath = queryParam(request, "path");
        const root = queryParam(request, "root");
        const kind = queryParam(request, "kind");
        if (!dbPath || !root || !kind || !isProjectOptionKind(kind)) {
            json(response, 400, { error: "path, root and a valid kind are required" });
            return;
        }
        const query = queryParam(request, "q");
        const limit = numberValue(Number(queryParam(request, "limit")));
        json(response, 200, {
            options: loadProjectOptions(dbPath, root, kind, query, limit),
        });
    } catch (error) {
        json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
};

const projectsMiddleware = (request: IncomingMessage, response: ServerResponse): void => {
    try {
        if (request.method !== "GET") {
            json(response, 405, { error: "Use GET" });
            return;
        }
        const dbPath = queryParam(request, "path");
        if (!dbPath) {
            json(response, 400, { error: "path is required" });
            return;
        }
        const query = queryParam(request, "q");
        const limit = numberValue(Number(queryParam(request, "limit")));
        json(response, 200, {
            path: dbPath,
            projects: loadSavedProjects(dbPath, query, limit),
        });
    } catch (error) {
        json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
};

const apiPlugin = (): Plugin => {
    return {
        name: "feign-tracer-api",
        configureServer(server) {
            server.middlewares.use("/api/analyze", analyzeMiddleware);
            server.middlewares.use("/api/db/schema", dbSchemaMiddleware);
            server.middlewares.use("/api/db/rows", dbRowsMiddleware);
            server.middlewares.use("/api/projects", projectsMiddleware);
            server.middlewares.use("/api/project-options", projectOptionsMiddleware);
        },
        configurePreviewServer(server) {
            server.middlewares.use("/api/analyze", analyzeMiddleware);
            server.middlewares.use("/api/db/schema", dbSchemaMiddleware);
            server.middlewares.use("/api/db/rows", dbRowsMiddleware);
            server.middlewares.use("/api/projects", projectsMiddleware);
            server.middlewares.use("/api/project-options", projectOptionsMiddleware);
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
