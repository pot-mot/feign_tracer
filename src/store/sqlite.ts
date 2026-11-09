import { copyFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sqlite3 from "node-sqlite3-wasm";
import type { Database as DatabaseType, Statement as StatementType } from "node-sqlite3-wasm";
import type { AnalysisResult, CallTreeNode, ModuleDependency } from "../model.ts";
import type { DeepReadonly } from "../types.ts";
import { readTreeSpool } from "./tree-spool.ts";
import { hasProjectTables } from "./project.ts";
import {
    METADATA_TABLES,
    PROJECT_TABLES,
    SCHEMA,
    SCHEMA_VERSION,
    TABLE_NAMES,
    VIEW_NAMES,
    VIEWS,
} from "./schema.ts";

const { Database } = sqlite3;

export const SQLITE_SCHEMA_VERSION = SCHEMA_VERSION;

export interface SqliteWriteResult {
    readonly path: string;
    readonly bytes: number;
    readonly rowCounts: Readonly<Record<string, number>>;
}

const normalizeBaseDir = (value: string): string =>
    value.replace(/\\/g, "/").replace(/\/+$/, "") || "/";

const text = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

export interface SqliteWriteOptions {
    /** 保留本次未重建端点的调用树；增量/目录重建模式依赖该选项。 */
    readonly merge?: boolean;
    /**
     * 调用树暂存文件。提供后 `call_nodes` 从该文件流式读取，
     * 而不是遍历 `result.endpoints[].tree`——后者要求所有端点的树同时驻留内存。
     */
    readonly treeSpool?: string;
    /**
     * 全新写入时保留旧库中的项目索引表（projects/project_files/...）。
     * 分析阶段已按项目索引完成复用，因此整库替换不能把索引一起丢掉。
     */
    readonly preserveProject?: boolean;
}

/**
 * 将分析结果写入 SQLite。全新写入先写临时文件再原子替换；
 * 增量写入在事务中更新现有数据库。
 */
export const writeAnalysisToSqlite = (
    result: DeepReadonly<AnalysisResult>,
    targetPath: string,
    options: SqliteWriteOptions = {},
): SqliteWriteResult => {
    const dbPath = resolve(targetPath);
    mkdirSync(dirname(dbPath), { recursive: true });
    if (options.merge && existsSync(dbPath))
        return mergeAnalysis(result, dbPath, options.treeSpool);
    return createAnalysis(result, dbPath, options.treeSpool, options.preserveProject === true);
};

const nowIso = (): string => new Date().toISOString();

const quoteSqlIdentifier = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const hasTable = (db: DatabaseType, name: string): boolean => {
    const row = db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [name]);
    return typeof row?.name === "string";
};

/**
 * 自动迁移历史数据：
 * - 删除旧版本遗留、且不属于当前 schema 的表/视图；
 * - 用 analysis.root 回填缺失的 projects.base_dir；
 * - 统一历史项目路径分隔符。
 *
 * 该函数由 schema 迁移和只读功能入口自动调用，不再依赖独立命令。
 */
const migrateHistoricalData = (db: DatabaseType): void => {
    const knownObjects = new Set<string>([...TABLE_NAMES, ...VIEW_NAMES]);
    const objects = db.all(
        `SELECT type, name FROM sqlite_master
         WHERE type IN ('table', 'view')
           AND name NOT LIKE 'sqlite_%'
         ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END, name`,
    );
    for (const row of objects) {
        const name = text(row.name);
        const type = text(row.type);
        if (!name || !type || knownObjects.has(name)) continue;
        db.exec(`DROP ${type === "view" ? "VIEW" : "TABLE"} IF EXISTS ${quoteSqlIdentifier(name)}`);
    }

    if (!hasTable(db, "projects")) return;

    if (hasTable(db, "analysis")) {
        const analysis = db.get("SELECT root, generated_at FROM analysis WHERE id = 1");
        const root = text(analysis?.root);
        if (root) {
            const baseDir = normalizeBaseDir(root);
            const existing = db.get("SELECT id FROM projects WHERE base_dir = ? COLLATE NOCASE", [
                baseDir,
            ]);
            if (typeof existing?.id !== "number") {
                const insertProject = db.prepare(
                    "INSERT INTO projects (base_dir, created_at, updated_at) VALUES (?, ?, ?)",
                );
                try {
                    insertProject.run([
                        baseDir,
                        text(analysis?.generated_at) ?? nowIso(),
                        nowIso(),
                    ]);
                } finally {
                    insertProject.finalize();
                }
            }
        }
    }

    const projects = db.all("SELECT id, base_dir FROM projects");
    const updateProject = db.prepare("UPDATE projects SET base_dir = ? WHERE id = ?");
    try {
        for (const project of projects) {
            const id = project.id;
            const raw = text(project.base_dir);
            if (typeof id !== "number" || !raw) continue;
            const normalized = normalizeBaseDir(raw);
            if (normalized !== raw) updateProject.run([normalized, id]);
        }
    } finally {
        updateProject.finalize();
    }
};

const ensuredDatabases = new Map<string, string>();

const fingerprintOf = (dbPath: string): string | undefined => {
    try {
        const stat = statSync(dbPath);
        return `${stat.mtimeMs}:${stat.size}`;
    } catch {
        return undefined;
    }
};

/**
 * 只读检查数据库是否已经满足当前 schema 与历史数据要求。
 * 这样普通读取不会在分析写入期间反复打开写连接，避免 SQLITE_BUSY。
 */
const isDatabaseReadyForRead = (dbPath: string): boolean => {
    const db = new Database(dbPath, { readOnly: true });
    try {
        const versionRaw = db.get("PRAGMA user_version")?.user_version;
        const version = typeof versionRaw === "number" ? versionRaw : 0;
        if (version !== SQLITE_SCHEMA_VERSION) return false;
        if (!hasTable(db, "projects")) return false;

        const knownObjects = new Set<string>([...TABLE_NAMES, ...VIEW_NAMES]);
        const objects = db.all(
            `SELECT name FROM sqlite_master
             WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'`,
        );
        if (objects.some((row) => !knownObjects.has(text(row.name) ?? ""))) return false;

        if (hasTable(db, "analysis")) {
            const analysis = db.get("SELECT root FROM analysis WHERE id = 1");
            const root = text(analysis?.root);
            if (root) {
                const baseDir = normalizeBaseDir(root);
                const project = db.get(
                    "SELECT id FROM projects WHERE base_dir = ? COLLATE NOCASE",
                    [baseDir],
                );
                if (typeof project?.id !== "number") return false;
            }
        }
        return true;
    } finally {
        db.close();
    }
};

/**
 * 在读取项目/浏览数据库/分析前确保旧库已经完成自动迁移。
 * 已是最新状态时只做只读检查，避免写锁干扰正在进行的分析。
 */
export const ensureDatabaseReady = (targetPath: string): void => {
    const dbPath = resolve(targetPath);
    if (!existsSync(dbPath)) return;
    const fingerprint = fingerprintOf(dbPath);
    if (!fingerprint) return;
    if (ensuredDatabases.get(dbPath) === fingerprint) return;

    try {
        if (isDatabaseReadyForRead(dbPath)) {
            ensuredDatabases.set(dbPath, fingerprint);
            return;
        }
    } catch {
        // 数据库正在被分析写入时可能短暂无法读取；保持现状，下一次再迁移。
        return;
    }

    try {
        const db = new Database(dbPath);
        try {
            db.exec("PRAGMA foreign_keys = ON");
            if (migrateSchema(db) === "recreate") return;
        } finally {
            db.close();
        }
    } catch {
        // 写锁被占用时不要影响读取/分析主流程。
        return;
    }

    const after = fingerprintOf(dbPath);
    if (after) ensuredDatabases.set(dbPath, after);
};

const createAnalysis = (
    result: DeepReadonly<AnalysisResult>,
    dbPath: string,
    treeSpool: string | undefined,
    preserveProject: boolean,
): SqliteWriteResult => {
    if (preserveProject && existsSync(dbPath) && hasProjectTables(dbPath)) {
        return replaceAnalysisPreservingProject(result, dbPath, treeSpool);
    }

    const tempPath = `${dbPath}.tmp-${process.pid}-${Date.now()}`;
    const db = new Database(tempPath);
    try {
        // 目标是临时文件，崩溃直接丢弃即可，因此关掉回滚日志与临时页的内存占用。
        db.exec("PRAGMA journal_mode = OFF");
        db.exec("PRAGMA synchronous = OFF");
        db.exec("PRAGMA temp_store = FILE");
        db.exec("PRAGMA cache_size = -32768");
        db.exec(SCHEMA);

        const statements = prepareStatements(db);
        db.exec("BEGIN");
        try {
            insertAnalysis(statements, result, treeSpool);
            db.exec("COMMIT");
        } catch (error) {
            try {
                db.exec("ROLLBACK");
            } catch {
                // 忽略回滚错误；临时文件随后会被删除
            }
            throw error;
        }

        db.exec(`PRAGMA user_version = ${SQLITE_SCHEMA_VERSION}`);
        const rowCounts = countRows(db);
        finalizeStatements(statements);
        db.close();

        /*
         * 直接 rename 覆盖目标文件：POSIX rename 与 Windows
         * MoveFileEx(REPLACE_EXISTING) 都是原子替换。
         * 先 delete 再 rename 反而会留下一个「目标文件不存在」的窗口。
         */
        renameSync(tempPath, dbPath);
        return { path: dbPath, bytes: statSync(dbPath).size, rowCounts };
    } catch (error) {
        try {
            db.close();
        } catch {
            // 忽略失败写入时的关闭错误
        }
        try {
            unlinkSync(tempPath);
        } catch {
            // 临时文件可能从未创建成功，忽略。
        }
        throw error;
    }
};

/**
 * 全新分析时保留已持久化的项目索引。
 *
 * 复制旧库到临时文件后只清空分析元数据表，项目索引（projects 及其子表）
 * 原样保留；这样强制重扫描/首次全量分析不会把可复用索引一起丢掉。
 */
const replaceAnalysisPreservingProject = (
    result: DeepReadonly<AnalysisResult>,
    dbPath: string,
    treeSpool: string | undefined,
): SqliteWriteResult => {
    const tempPath = `${dbPath}.tmp-${process.pid}-${Date.now()}`;
    copyFileSync(dbPath, tempPath);
    const db = new Database(tempPath);
    try {
        if (migrateSchema(db) === "recreate") {
            throw new Error("Cannot preserve project index from an incompatible database schema");
        }
        db.exec("PRAGMA journal_mode = OFF");
        db.exec("PRAGMA synchronous = OFF");
        db.exec("PRAGMA temp_store = FILE");
        db.exec("PRAGMA cache_size = -32768");

        for (const table of METADATA_TABLES) db.exec(`DELETE FROM ${table}`);
        db.exec("DELETE FROM call_nodes");

        const statements = prepareStatements(db);
        db.exec("BEGIN");
        try {
            insertAnalysis(statements, result, treeSpool);
            db.exec("COMMIT");
        } catch (error) {
            try {
                db.exec("ROLLBACK");
            } catch {
                // 忽略回滚错误；临时文件随后会被删除。
            }
            throw error;
        }

        db.exec(`PRAGMA user_version = ${SQLITE_SCHEMA_VERSION}`);
        const rowCounts = countRows(db);
        finalizeStatements(statements);
        db.close();
        // Windows 上刚关闭的连接可能仍短暂持有目标文件；直接复制覆盖更稳。
        copyFileSync(tempPath, dbPath);
        unlinkSync(tempPath);
        return { path: dbPath, bytes: statSync(dbPath).size, rowCounts };
    } catch (error) {
        try {
            db.close();
        } catch {
            // 忽略失败写入时的关闭错误。
        }
        try {
            unlinkSync(tempPath);
        } catch {
            // 临时文件可能从未创建成功，忽略。
        }
        throw error;
    }
};

const mergeAnalysis = (
    result: DeepReadonly<AnalysisResult>,
    dbPath: string,
    treeSpool: string | undefined,
): SqliteWriteResult => {
    const db = new Database(dbPath);
    try {
        if (migrateSchema(db) === "recreate") {
            // 旧库结构无法原地升级：关闭连接后整库重建，由 createAnalysis 原子替换。
            db.close();
            return createAnalysis(result, dbPath, treeSpool, false);
        }

        db.exec("PRAGMA synchronous = NORMAL");
        const statements = prepareStatements(db);
        db.exec("BEGIN");
        try {
            db.exec(
                "CREATE TEMP TABLE current_endpoint (id TEXT PRIMARY KEY, tree_built INTEGER NOT NULL)",
            );
            const insertCurrent = db.prepare(
                "INSERT INTO current_endpoint (id, tree_built) VALUES (?, ?)",
            );
            for (const endpoint of result.endpoints) {
                insertCurrent.run([endpoint.id, endpoint.treeBuilt ? 1 : 0]);
            }
            insertCurrent.finalize();

            db.exec(
                "CREATE TEMP TABLE current_trace (id TEXT PRIMARY KEY, tree_built INTEGER NOT NULL)",
            );
            const insertCurrentTrace = db.prepare(
                "INSERT INTO current_trace (id, tree_built) VALUES (?, ?)",
            );
            for (const trace of result.traces ?? []) {
                insertCurrentTrace.run([trace.id, trace.treeBuilt ? 1 : 0]);
            }
            insertCurrentTrace.finalize();

            // 增量运行只选择部分调用链；保留其他元数据与树，避免已构建的根丢失。
            db.exec(
                "CREATE TEMP TABLE preserved_trace AS SELECT * FROM traces WHERE id NOT IN (SELECT id FROM current_trace)",
            );

            // 删除已移除端点/调用链的树，以及本次重建根对应的旧树。
            db.exec(
                "DELETE FROM call_nodes WHERE root_type = 'endpoint' AND endpoint_id NOT IN (SELECT id FROM current_endpoint)",
            );
            db.exec(
                "DELETE FROM call_nodes WHERE root_type = 'endpoint' AND endpoint_id IN (SELECT id FROM current_endpoint WHERE tree_built = 1)",
            );
            db.exec(
                "DELETE FROM call_nodes WHERE root_type = 'trace' AND endpoint_id IN (SELECT id FROM current_trace WHERE tree_built = 1)",
            );

            for (const table of METADATA_TABLES) db.exec(`DELETE FROM ${table}`);
            insertAnalysis(statements, result, treeSpool);
            db.exec("INSERT INTO traces SELECT * FROM preserved_trace");

            // 未重建的根保留之前构建的树。
            db.exec(
                `UPDATE endpoints SET tree_built = 1
         WHERE tree_built = 0
           AND EXISTS (
             SELECT 1 FROM call_nodes c
             WHERE c.root_type = 'endpoint' AND c.endpoint_id = endpoints.id
           )`,
            );
            db.exec(
                `UPDATE traces SET tree_built = 1
         WHERE tree_built = 0
           AND EXISTS (
             SELECT 1 FROM call_nodes c
             WHERE c.root_type = 'trace' AND c.endpoint_id = traces.id
           )`,
            );

            db.exec("DROP TABLE current_endpoint");
            db.exec("DROP TABLE current_trace");
            db.exec("DROP TABLE preserved_trace");
            db.exec("COMMIT");
        } catch (error) {
            try {
                db.exec("ROLLBACK");
            } catch {
                // 忽略回滚错误
            }
            throw error;
        }

        db.exec(`PRAGMA user_version = ${SQLITE_SCHEMA_VERSION}`);
        const rowCounts = countRows(db);
        finalizeStatements(statements);
        db.close();
        return { path: dbPath, bytes: statSync(dbPath).size, rowCounts };
    } catch (error) {
        try {
            db.close();
        } catch {
            // 忽略失败合并时的关闭错误
        }
        throw error;
    }
};

const migrateSchema = (db: DatabaseType): "ok" | "recreate" => {
    const rawVersion = db.get("PRAGMA user_version")?.user_version;
    const version = typeof rawVersion === "number" ? rawVersion : 0;
    if (version === SQLITE_SCHEMA_VERSION) {
        // 即使版本已最新，也处理旧库遗留表/项目回填等历史数据。
        db.exec(PROJECT_TABLES);
        migrateHistoricalData(db);
        return "ok";
    }
    if (version > SQLITE_SCHEMA_VERSION) {
        throw new Error(
            `Database schema v${version} is newer than supported v${SQLITE_SCHEMA_VERSION}`,
        );
    }

    if (version === 0) {
        const table = db.get(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'endpoints'",
        );
        if (typeof table?.name !== "string") return "recreate";
    }

    addColumn(db, "endpoints", "tree_built", "INTEGER NOT NULL DEFAULT 0");
    addColumn(db, "call_nodes", "params_json", "TEXT");
    addColumn(db, "call_nodes", "visibility", "TEXT");
    addColumn(db, "call_nodes", "implementation_of", "TEXT");
    addColumn(db, "call_nodes", "root_type", "TEXT NOT NULL DEFAULT 'endpoint'");
    db.exec(`
    CREATE TABLE IF NOT EXISTS traces (
      id                TEXT PRIMARY KEY,
      class_name        TEXT NOT NULL,
      method_name       TEXT NOT NULL,
      label             TEXT NOT NULL,
      kind              TEXT NOT NULL,
      module_id         TEXT,
      file              TEXT,
      line              INTEGER,
      implementation_of TEXT,
      tree_built        INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_traces_class ON traces(class_name);
    CREATE INDEX IF NOT EXISTS idx_traces_module ON traces(module_id);
  `);
    // v4 新增项目索引表；旧库原地补表，下次扫描即可复用已有源码结果。
    db.exec(PROJECT_TABLES);
    for (const view of VIEW_NAMES) db.exec(`DROP VIEW IF EXISTS ${view}`);
    db.exec(VIEWS);
    migrateHistoricalData(db);
    db.exec(`PRAGMA user_version = ${SQLITE_SCHEMA_VERSION}`);
    return "ok";
};

const addColumn = (db: DatabaseType, table: string, column: string, definition: string): void => {
    const columns = db.all(`PRAGMA table_info(${table})`);
    if (!columns.some((entry) => entry.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
};

const countRows = (db: DatabaseType): Record<string, number> => {
    const rowCounts: Record<string, number> = {};
    for (const table of TABLE_NAMES) {
        const count = db.get(`SELECT COUNT(*) AS c FROM ${table}`)?.c;
        rowCounts[table] = typeof count === "number" ? count : Number(count ?? 0);
    }
    return rowCounts;
};

const finalizeStatements = (statements: InsertStatements): void => {
    for (const statement of statements.all) statement.finalize();
};

interface InsertStatements {
    all: Array<{ finalize(): void }>;
    analysis: StatementType;
    stat: StatementType;
    warning: StatementType;
    module: StatementType;
    moduleDependency: StatementType;
    moduleEdge: StatementType;
    moduleChild: StatementType;
    endpoint: StatementType;
    trace: StatementType;
    callNode: StatementType;
    feignClient: StatementType;
    feignClientMethod: StatementType;
    feignOperation: StatementType;
    feignOperationTarget: StatementType;
    sourceFile: StatementType;
    fileDependency: StatementType;
}

type Statement = StatementType;

const prepareStatements = (db: DatabaseType): InsertStatements => {
    const analysis = db.prepare(
        `INSERT INTO analysis (id, root, generated_at, tool, version, options_json, duration_ms)
     VALUES (1, ?, ?, ?, ?, ?, ?)`,
    );
    const stat = db.prepare("INSERT INTO stats (name, value) VALUES (?, ?)");
    const warning = db.prepare("INSERT INTO warnings (message) VALUES (?)");
    const module = db.prepare(
        `INSERT INTO modules (id, name, build_tool, dir, build_file, parent_id, group_id, artifact_id, version, file_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const moduleDependency = db.prepare(
        `INSERT INTO module_dependencies
       (module_id, to_module, group_id, artifact_id, version, scope, configuration, optional, external, raw)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const moduleEdge = db.prepare(
        "INSERT INTO module_edges (from_module, to_module, count) VALUES (?, ?, ?)",
    );
    const moduleChild = db.prepare(
        "INSERT INTO module_children (parent_id, child_id, position) VALUES (?, ?, ?)",
    );
    const endpoint = db.prepare(
        `INSERT INTO endpoints (id, http_method, paths_json, handler, handler_label, controller, module_id, file, line, tree_built)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const callNode = db.prepare(
        `INSERT INTO call_nodes
       (root_type, endpoint_id, seq, path, sort_key, parent_seq, node_order, depth, method_id, label, signature,
        params_json, visibility, kind, module_id, file, line, annotations_json, call_count, unresolved, cyclic,
        implementation_of, feign_service, feign_http_method, feign_path, remote_endpoint, remote_service)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const trace = db.prepare(
        `INSERT INTO traces
       (id, class_name, method_name, label, kind, module_id, file, line, implementation_of, tree_built)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const feignClient = db.prepare(
        `INSERT INTO feign_clients (id, name, service_name, url, module_id, file, line)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const feignClientMethod = db.prepare(
        `INSERT INTO feign_client_methods (client_id, method_id, name, http_method, paths_json, signature, position)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const feignOperation = db.prepare(
        `INSERT INTO feign_operations
       (method_id, path, client_name, client_id, service_name, url, method_name, http_method, module_id, file, line)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const feignOperationTarget = db.prepare(
        "INSERT INTO feign_operation_targets (method_id, path, endpoint_ref) VALUES (?, ?, ?)",
    );
    const sourceFile = db.prepare(
        `INSERT INTO source_files (path, language, module_id, package_name, imports_json, types_json, calls, parse_errors)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const fileDependency = db.prepare(
        `INSERT INTO file_dependencies (file_path, to_type, count, kinds_json, lines_json)
     VALUES (?, ?, ?, ?, ?)`,
    );

    return {
        analysis,
        stat,
        warning,
        module,
        moduleDependency,
        moduleEdge,
        moduleChild,
        endpoint,
        trace,
        callNode,
        feignClient,
        feignClientMethod,
        feignOperation,
        feignOperationTarget,
        sourceFile,
        fileDependency,
        all: [
            analysis,
            stat,
            warning,
            module,
            moduleDependency,
            moduleEdge,
            moduleChild,
            endpoint,
            trace,
            callNode,
            feignClient,
            feignClientMethod,
            feignOperation,
            feignOperationTarget,
            sourceFile,
            fileDependency,
        ],
    };
};

const insertAnalysis = (
    statements: InsertStatements,
    result: DeepReadonly<AnalysisResult>,
    treeSpool: string | undefined,
): void => {
    const { meta, stats } = result;
    statements.analysis.run([
        meta.root,
        meta.generatedAt,
        meta.tool,
        meta.version,
        JSON.stringify(meta.options),
        stats.durationMs,
    ]);

    for (const [name, value] of Object.entries(stats)) {
        statements.stat.run([name, Number(value)]);
    }

    result.warnings.forEach((message) => {
        statements.warning.run([message]);
    });

    for (const module of result.modules) {
        statements.module.run([
            module.id,
            module.name,
            module.buildTool,
            module.dir,
            module.buildFile ?? null,
            module.parentId ?? null,
            module.groupId ?? null,
            module.artifactId ?? null,
            module.version ?? null,
            module.fileCount,
        ]);

        for (const dependency of module.dependencies) {
            insertModuleDependency(statements.moduleDependency, module.id, dependency);
        }

        (module.modules ?? []).forEach((childId, position) => {
            statements.moduleChild.run([module.id, childId, position]);
        });
    }

    for (const edge of result.moduleEdges) {
        statements.moduleEdge.run([edge.from, edge.to, edge.count]);
    }

    for (const endpoint of result.endpoints) {
        statements.endpoint.run([
            endpoint.id,
            endpoint.httpMethod,
            JSON.stringify(endpoint.paths),
            endpoint.handler,
            endpoint.handlerLabel,
            endpoint.controller,
            endpoint.moduleId ?? null,
            endpoint.file ?? null,
            endpoint.line ?? null,
            endpoint.treeBuilt ? 1 : 0,
        ]);
        if (endpoint.treeBuilt && !treeSpool) {
            insertCallTree(statements.callNode, "endpoint", endpoint.id, endpoint.tree);
        }
    }

    for (const trace of result.traces ?? []) {
        statements.trace.run([
            trace.id,
            trace.className,
            trace.methodName,
            trace.label,
            trace.kind,
            trace.moduleId ?? null,
            trace.file ?? null,
            trace.line ?? null,
            trace.implementationOf ?? null,
            trace.treeBuilt ? 1 : 0,
        ]);
        if (trace.treeBuilt && !treeSpool) {
            insertCallTree(statements.callNode, "trace", trace.id, trace.tree);
        }
    }

    // 调用树单独流式写入：整棵树在上一步已经落到暂存文件，这里只保留一行的内存开销。
    if (treeSpool) {
        readTreeSpool(treeSpool, (record) => {
            insertCallNode(statements.callNode, record.rootType, record.id, record.node);
        });
    }

    const clientIdByKey = new Map<string, string>();
    for (const client of result.feignClients) {
        statements.feignClient.run([
            client.id,
            client.name,
            client.serviceName ?? null,
            client.url ?? null,
            client.moduleId ?? null,
            client.file ?? null,
            client.line ?? null,
        ]);
        clientIdByKey.set(`${client.moduleId ?? ""}\u0000${client.name}`, client.id);

        client.methods.forEach((method, position) => {
            statements.feignClientMethod.run([
                client.id,
                method.id,
                method.name,
                method.httpMethod,
                JSON.stringify(method.paths),
                method.signature,
                position,
            ]);
        });
    }

    for (const operation of result.feignOperations) {
        const clientId =
            clientIdByKey.get(`${operation.moduleId ?? ""}\u0000${operation.client}`) ?? null;
        statements.feignOperation.run([
            operation.id,
            operation.path,
            operation.client,
            clientId,
            operation.serviceName ?? null,
            operation.url ?? null,
            operation.method,
            operation.httpMethod,
            operation.moduleId ?? null,
            operation.file ?? null,
            operation.line ?? null,
        ]);
        for (const reference of operation.targetEndpoints) {
            statements.feignOperationTarget.run([operation.id, operation.path, reference]);
        }
    }

    for (const file of result.files) {
        statements.sourceFile.run([
            file.path,
            file.language,
            file.moduleId ?? null,
            file.packageName,
            JSON.stringify(file.imports),
            JSON.stringify(file.types),
            file.calls,
            file.parseErrors,
        ]);
        for (const dependency of file.dependencies) {
            statements.fileDependency.run([
                file.path,
                dependency.to,
                dependency.count,
                JSON.stringify(dependency.kinds),
                JSON.stringify(dependency.lines),
            ]);
        }
    }
};

const insertModuleDependency = (
    statement: Statement,
    moduleId: string,
    dependency: DeepReadonly<ModuleDependency>,
): void => {
    statement.run([
        moduleId,
        dependency.to ?? null,
        dependency.groupId ?? null,
        dependency.artifactId ?? null,
        dependency.version ?? null,
        dependency.scope ?? null,
        dependency.configuration ?? null,
        dependency.optional ? 1 : 0,
        dependency.external ? 1 : 0,
        dependency.raw ?? null,
    ]);
};

const insertCallTree = (
    statement: Statement,
    rootType: "endpoint" | "trace",
    endpointId: string,
    root: DeepReadonly<CallTreeNode>,
): void => {
    const stack: Array<DeepReadonly<CallTreeNode>> = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) break;
        insertCallNode(statement, rootType, endpointId, node);
        for (const child of node.children) stack.push(child);
    }
};

/** 单行写入。暂存文件读取路径与内存树路径共用，保证两种模式产生完全相同的行。 */
const insertCallNode = (
    statement: Statement,
    rootType: "endpoint" | "trace",
    endpointId: string,
    node: DeepReadonly<CallTreeNode>,
): void => {
    const parentSeq = node.seq.includes("-")
        ? node.seq.slice(0, node.seq.lastIndexOf("-"))
        : undefined;
    const sortKey = node.seq
        .split("-")
        .map((part) => part.padStart(4, "0"))
        .join(".");

    statement.run([
        rootType,
        endpointId,
        node.seq,
        node.path,
        sortKey,
        parentSeq ?? null,
        node.order,
        node.depth,
        node.id,
        node.label,
        node.signature ?? null,
        node.params && node.params.length > 0 ? JSON.stringify(node.params) : null,
        node.visibility ?? null,
        node.kind,
        node.moduleId ?? null,
        node.file ?? null,
        node.line ?? null,
        node.annotations && node.annotations.length > 0 ? JSON.stringify(node.annotations) : null,
        node.callCount ?? 1,
        node.unresolved ? 1 : 0,
        node.cyclic ? 1 : 0,
        node.implementationOf ?? null,
        node.feign?.service ?? null,
        node.feign?.httpMethod ?? null,
        node.feign?.path ?? null,
        node.remote?.endpoint ?? null,
        node.remote?.service ?? null,
    ]);
};
