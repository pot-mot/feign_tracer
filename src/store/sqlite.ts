import { existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sqlite3 from "node-sqlite3-wasm";
import type { Database as DatabaseType, Statement as StatementType } from "node-sqlite3-wasm";
import type { AnalysisResult, CallTreeNode, ModuleDependency } from "../model.ts";
import type { DeepReadonly } from "../types.ts";
import { readTreeSpool } from "./tree-spool.ts";

const { Database } = sqlite3;

/** 架构变化时递增，存入 PRAGMA user_version。 */
export const SQLITE_SCHEMA_VERSION = 3;

const TABLES = `
CREATE TABLE analysis (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  root          TEXT NOT NULL,
  generated_at  TEXT NOT NULL,
  tool          TEXT NOT NULL,
  version       TEXT NOT NULL,
  options_json  TEXT NOT NULL,
  duration_ms   INTEGER NOT NULL
);

CREATE TABLE stats (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE warnings (
  id      INTEGER PRIMARY KEY,
  message TEXT NOT NULL
);

CREATE TABLE modules (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  build_tool  TEXT NOT NULL,
  dir         TEXT NOT NULL,
  build_file  TEXT,
  parent_id   TEXT,
  group_id    TEXT,
  artifact_id TEXT,
  version     TEXT,
  file_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE module_dependencies (
  id            INTEGER PRIMARY KEY,
  module_id     TEXT NOT NULL,
  to_module     TEXT,
  group_id      TEXT,
  artifact_id   TEXT,
  version       TEXT,
  scope         TEXT,
  configuration TEXT,
  optional      INTEGER NOT NULL DEFAULT 0,
  external      INTEGER NOT NULL DEFAULT 0,
  raw           TEXT
);
CREATE INDEX idx_module_dependencies_module ON module_dependencies(module_id);
CREATE INDEX idx_module_dependencies_target ON module_dependencies(to_module);

CREATE TABLE module_edges (
  from_module TEXT NOT NULL,
  to_module   TEXT NOT NULL,
  count       INTEGER NOT NULL,
  PRIMARY KEY (from_module, to_module)
);

CREATE TABLE module_children (
  parent_id TEXT NOT NULL,
  child_id  TEXT NOT NULL,
  position  INTEGER NOT NULL,
  PRIMARY KEY (parent_id, child_id)
);

CREATE TABLE endpoints (
  id            TEXT PRIMARY KEY,
  http_method   TEXT NOT NULL,
  paths_json    TEXT NOT NULL,
  handler       TEXT NOT NULL,
  handler_label TEXT NOT NULL,
  controller    TEXT NOT NULL,
  module_id     TEXT,
  file          TEXT,
  line          INTEGER,
  tree_built    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_endpoints_controller ON endpoints(controller);
CREATE INDEX idx_endpoints_module ON endpoints(module_id);

CREATE TABLE call_nodes (
  root_type        TEXT NOT NULL DEFAULT 'endpoint',
  endpoint_id      TEXT NOT NULL,
  seq              TEXT NOT NULL,
  path             TEXT NOT NULL,
  sort_key         TEXT NOT NULL,
  parent_seq       TEXT,
  node_order       INTEGER NOT NULL,
  depth            INTEGER NOT NULL,
  method_id        TEXT NOT NULL,
  label            TEXT NOT NULL,
  signature        TEXT,
  params_json      TEXT,
  visibility       TEXT,
  kind             TEXT NOT NULL,
  module_id        TEXT,
  file             TEXT,
  line             INTEGER,
  annotations_json TEXT,
  call_count       INTEGER NOT NULL DEFAULT 1,
  unresolved       INTEGER NOT NULL DEFAULT 0,
  cyclic           INTEGER NOT NULL DEFAULT 0,
  implementation_of TEXT,
  feign_service    TEXT,
  feign_http_method TEXT,
  feign_path       TEXT,
  remote_endpoint  TEXT,
  remote_service   TEXT,
  PRIMARY KEY (root_type, endpoint_id, seq)
);
CREATE INDEX idx_call_nodes_parent ON call_nodes(root_type, endpoint_id, parent_seq);
CREATE INDEX idx_call_nodes_sort ON call_nodes(root_type, endpoint_id, sort_key);
CREATE INDEX idx_call_nodes_method ON call_nodes(method_id);
CREATE INDEX idx_call_nodes_kind ON call_nodes(kind);

CREATE TABLE traces (
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
CREATE INDEX idx_traces_class ON traces(class_name);
CREATE INDEX idx_traces_module ON traces(module_id);

CREATE TABLE feign_clients (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  service_name TEXT,
  url          TEXT,
  module_id    TEXT,
  file         TEXT,
  line         INTEGER
);

CREATE TABLE feign_client_methods (
  client_id   TEXT NOT NULL,
  method_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  http_method TEXT NOT NULL,
  paths_json  TEXT NOT NULL,
  signature   TEXT NOT NULL,
  position    INTEGER NOT NULL,
  PRIMARY KEY (client_id, method_id)
);

CREATE TABLE feign_operations (
  method_id    TEXT NOT NULL,
  path         TEXT NOT NULL,
  client_name  TEXT NOT NULL,
  client_id    TEXT,
  service_name TEXT,
  url          TEXT,
  method_name  TEXT NOT NULL,
  http_method  TEXT NOT NULL,
  module_id    TEXT,
  file         TEXT,
  line         INTEGER,
  PRIMARY KEY (method_id, path)
);
CREATE INDEX idx_feign_operations_client ON feign_operations(client_id);

CREATE TABLE feign_operation_targets (
  method_id    TEXT NOT NULL,
  path         TEXT NOT NULL,
  endpoint_ref TEXT NOT NULL,
  PRIMARY KEY (method_id, path, endpoint_ref)
);

CREATE TABLE source_files (
  path           TEXT PRIMARY KEY,
  language       TEXT NOT NULL,
  module_id      TEXT,
  package_name   TEXT NOT NULL,
  imports_json   TEXT NOT NULL,
  types_json     TEXT NOT NULL,
  calls          INTEGER NOT NULL DEFAULT 0,
  parse_errors   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_source_files_module ON source_files(module_id);

CREATE TABLE file_dependencies (
  file_path TEXT NOT NULL,
  to_type   TEXT NOT NULL,
  count     INTEGER NOT NULL,
  kinds_json TEXT NOT NULL,
  lines_json TEXT NOT NULL,
  PRIMARY KEY (file_path, to_type)
);
CREATE INDEX idx_file_dependencies_target ON file_dependencies(to_type);
`;

const VIEWS = `
CREATE VIEW v_endpoint_overview AS
SELECT
  e.id,
  e.http_method,
  e.paths_json,
  e.controller,
  e.module_id,
  e.file,
  e.tree_built,
  (SELECT COUNT(*) FROM call_nodes n WHERE n.root_type = 'endpoint' AND n.endpoint_id = e.id) AS node_count,
  (SELECT COUNT(*) FROM call_nodes n WHERE n.root_type = 'endpoint' AND n.endpoint_id = e.id AND n.kind = 'feign') AS feign_calls,
  (SELECT COUNT(*) FROM call_nodes n WHERE n.root_type = 'endpoint' AND n.endpoint_id = e.id AND n.depth = 0) AS root_nodes
FROM endpoints e;

CREATE VIEW v_trace_overview AS
SELECT
  t.id,
  t.class_name,
  t.method_name,
  t.label,
  t.kind,
  t.module_id,
  t.file,
  t.implementation_of,
  t.tree_built,
  (SELECT COUNT(*) FROM call_nodes n WHERE n.root_type = 'trace' AND n.endpoint_id = t.id) AS node_count,
  (SELECT COUNT(*) FROM call_nodes n WHERE n.root_type = 'trace' AND n.endpoint_id = t.id AND n.kind = 'feign') AS feign_calls
FROM traces t;

CREATE VIEW v_module_overview AS
SELECT
  m.*,
  (SELECT COUNT(*) FROM module_dependencies d WHERE d.module_id = m.id) AS dependency_count,
  (SELECT COUNT(*) FROM module_dependencies d WHERE d.to_module = m.id) AS dependent_count
FROM modules m;

CREATE VIEW v_file_overview AS
SELECT
  f.path,
  f.language,
  f.module_id,
  f.package_name,
  f.calls,
  (SELECT COUNT(*) FROM file_dependencies d WHERE d.file_path = f.path) AS dependency_count
FROM source_files f;
`;

const SCHEMA = `${TABLES}\n${VIEWS}`;

const VIEW_NAMES = [
    "v_endpoint_overview",
    "v_trace_overview",
    "v_module_overview",
    "v_file_overview",
];

const TABLE_NAMES = [
    "analysis",
    "stats",
    "warnings",
    "modules",
    "module_dependencies",
    "module_edges",
    "module_children",
    "endpoints",
    "call_nodes",
    "traces",
    "feign_clients",
    "feign_client_methods",
    "feign_operations",
    "feign_operation_targets",
    "source_files",
    "file_dependencies",
] as const;

const METADATA_TABLES = [
    "analysis",
    "stats",
    "warnings",
    "modules",
    "module_dependencies",
    "module_edges",
    "module_children",
    "endpoints",
    "traces",
    "feign_clients",
    "feign_client_methods",
    "feign_operations",
    "feign_operation_targets",
    "source_files",
    "file_dependencies",
] as const;

export interface SqliteWriteResult {
    readonly path: string;
    readonly bytes: number;
    readonly rowCounts: Readonly<Record<string, number>>;
}

export interface SqliteWriteOptions {
    /** 保留本次未重建端点的调用树；增量/目录重建模式依赖该选项。 */
    readonly merge?: boolean;
    /**
     * 调用树暂存文件。提供后 `call_nodes` 从该文件流式读取，
     * 而不是遍历 `result.endpoints[].tree`——后者要求所有端点的树同时驻留内存。
     */
    readonly treeSpool?: string;
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
    return createAnalysis(result, dbPath, options.treeSpool);
};

const createAnalysis = (
    result: DeepReadonly<AnalysisResult>,
    dbPath: string,
    treeSpool: string | undefined,
): SqliteWriteResult => {
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
            return createAnalysis(result, dbPath, treeSpool);
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
    if (version === SQLITE_SCHEMA_VERSION) return "ok";
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
    for (const view of VIEW_NAMES) db.exec(`DROP VIEW IF EXISTS ${view}`);
    db.exec(VIEWS);
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
