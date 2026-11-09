import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sqlite3 from "node-sqlite3-wasm";
import type { Database as DatabaseType } from "node-sqlite3-wasm";
import { ensureDatabaseReady } from "./sqlite.ts";

const { Database } = sqlite3;

export type DbTableKind = "table" | "view";

export interface DbColumn {
    readonly name: string;
    readonly type: string;
    readonly notNull: boolean;
    readonly defaultValue: string | undefined;
    /** PRAGMA table_info 中的主键序号，0 表示不是主键。 */
    readonly pk: number;
}

export interface DbTable {
    readonly name: string;
    readonly kind: DbTableKind;
    readonly columns: readonly DbColumn[];
    readonly primaryKey: readonly string[];
    readonly hasRowid: boolean;
    readonly rowCount: number;
}

export interface DbSchema {
    readonly path: string;
    readonly tables: readonly DbTable[];
}

export interface DbRows {
    readonly table: DbTable;
    readonly rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
}

export interface DbMutationResult {
    readonly changes: number;
    readonly lastInsertRowid?: number;
}

export interface SavedProject {
    readonly baseDir: string;
    readonly updatedAt: string;
}

export type ProjectOptionKind = "endpoint" | "class" | "method";

export const isProjectOptionKind = (value: string): value is ProjectOptionKind =>
    value === "endpoint" || value === "class" || value === "method";

const text = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

const numberValue = (value: unknown): number | undefined => {
    const parsed = typeof value === "bigint" ? Number(value) : value;
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
};

/** SQLite 标识符必须双引号包裹；名称来自目录表，仍然做一次转义。 */
export const quoteIdentifier = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const openDatabase = (dbPath: string, readOnly = false): DatabaseType => {
    const target = resolve(dbPath);
    if (!existsSync(target)) throw new Error(`数据库不存在：${target}`);
    const db = new Database(target, readOnly ? { readOnly: true } : undefined);
    // CRUD 与项目索引使用同一套外键约束。
    db.exec("PRAGMA foreign_keys = ON");
    return db;
};

const hasTable = (db: DatabaseType, name: string): boolean => {
    const row = db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [name]);
    return typeof row?.name === "string";
};

const findTable = (db: DatabaseType, name: string): DbTable | undefined => {
    const row = db.get(
        "SELECT name, type FROM sqlite_master WHERE name = ? AND type IN ('table', 'view')",
        [name],
    );
    const tableName = text(row?.name);
    if (!tableName) return undefined;
    const kind: DbTableKind = row?.type === "view" ? "view" : "table";
    const columns: DbColumn[] = db
        .all(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
        .map((column) => ({
            name: text(column.name) ?? "",
            type: text(column.type) ?? "",
            notNull: numberValue(column.notnull) === 1,
            defaultValue: text(column.dflt_value),
            pk: numberValue(column.pk) ?? 0,
        }));
    const primaryKey = columns
        .filter((column) => column.pk > 0)
        .sort((left, right) => left.pk - right.pk)
        .map((column) => column.name);

    let hasRowid = false;
    if (kind === "table") {
        try {
            db.all(`SELECT rowid FROM ${quoteIdentifier(tableName)} LIMIT 1`);
            hasRowid = true;
        } catch {
            hasRowid = false;
        }
    }

    const count = numberValue(db.get(`SELECT COUNT(*) AS c FROM ${quoteIdentifier(tableName)}`)?.c);
    return {
        name: tableName,
        kind,
        columns,
        primaryKey,
        hasRowid,
        rowCount: count ?? 0,
    };
};

/** 读取数据库中的全部表和视图及其列、主键信息。 */
export const loadDatabaseSchema = (dbPath: string): DbSchema => {
    const target = resolve(dbPath);
    ensureDatabaseReady(dbPath);
    const db = openDatabase(dbPath, true);
    try {
        const tables: DbTable[] = [];
        const rows = db.all(
            `SELECT name, type FROM sqlite_master
             WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
             ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`,
        );
        for (const row of rows) {
            const name = text(row.name);
            if (!name) continue;
            const table = findTable(db, name);
            if (table) tables.push(table);
        }
        return { path: target, tables };
    } finally {
        db.close();
    }
};

/**
 * 从项目索引表读取已保存的项目根目录。数据库或 projects 表不存在时
 * 返回空列表，让 UI 在首次扫描前保持可用。
 */
export const loadSavedProjects = (
    dbPath: string,
    query: string | undefined,
    limitInput?: number,
): SavedProject[] => {
    if (!existsSync(resolve(dbPath))) return [];
    ensureDatabaseReady(dbPath);
    const limit = Math.min(500, Math.max(1, Math.trunc(limitInput ?? 200)));
    const db = openDatabase(dbPath, true);
    try {
        const byRoot = new Map<string, SavedProject>();
        const add = (baseDir: string | undefined, updatedAt: string | undefined): void => {
            if (!baseDir) return;
            const normalized = baseDir.replace(/\\/g, "/");
            const key = normalized.toLowerCase();
            const existing = byRoot.get(key);
            if (!existing || (updatedAt ?? "") > existing.updatedAt) {
                byRoot.set(key, { baseDir: normalized, updatedAt: updatedAt ?? "" });
            }
        };

        if (hasTable(db, "projects")) {
            const rows = db.all(
                "SELECT base_dir, updated_at FROM projects ORDER BY updated_at DESC, base_dir ASC",
            );
            for (const row of rows) {
                add(text(row.base_dir), text(row.updated_at));
            }
        }

        const needle = (query?.trim() ?? "").toLowerCase();
        return [...byRoot.values()]
            .filter((project) => !needle || project.baseDir.toLowerCase().includes(needle))
            .sort((left, right) => {
                if (left.updatedAt !== right.updatedAt) {
                    return right.updatedAt.localeCompare(left.updatedAt);
                }
                return left.baseDir.localeCompare(right.baseDir);
            })
            .slice(0, limit);
    } finally {
        db.close();
    }
};

/**
 * 从当前项目的持久化索引中读取筛选候选项：
 * - endpoint：端点 id/path（来自 endpoints 与 project_files 的关联）；
 * - class：全限定类名；
 * - method：函数名。
 *
 * 返回结果在服务端做不区分大小写的子串过滤，避免把大项目的全部符号送到前端。
 */
export const loadProjectOptions = (
    dbPath: string,
    projectRoot: string,
    kind: ProjectOptionKind,
    query: string | undefined,
    limitInput?: number,
): string[] => {
    if (!existsSync(resolve(dbPath))) return [];
    const limit = Math.min(500, Math.max(1, Math.trunc(limitInput ?? 200)));
    const db = openDatabase(dbPath, true);
    try {
        if (!hasTable(db, "projects")) return [];
        const baseDir = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
        const project = db.get("SELECT id FROM projects WHERE base_dir = ? COLLATE NOCASE", [
            baseDir,
        ]);
        const projectId = numberValue(project?.id);
        if (projectId === undefined) return [];

        let values: string[] = [];
        if (kind === "endpoint") {
            if (!hasTable(db, "endpoints") || !hasTable(db, "project_files")) return [];
            values = db
                .all(
                    `SELECT DISTINCT e.id AS value
                     FROM endpoints e
                     JOIN project_files f ON f.path = e.file AND f.project_id = ?
                     ORDER BY e.id`,
                    [projectId],
                )
                .map((row) => text(row.value) ?? "")
                .filter(Boolean);
        } else if (kind === "class") {
            values = db
                .all(
                    `SELECT DISTINCT c.fqn AS value
                     FROM project_classes c
                     JOIN project_files f ON f.id = c.file_id
                     WHERE f.project_id = ?
                     ORDER BY c.fqn`,
                    [projectId],
                )
                .map((row) => text(row.value) ?? "")
                .filter(Boolean);
        } else {
            values = db
                .all(
                    `SELECT DISTINCT m.name AS value
                     FROM project_methods m
                     JOIN project_classes c ON c.id = m.class_id
                     JOIN project_files f ON f.id = c.file_id
                     WHERE f.project_id = ?
                     ORDER BY m.name`,
                    [projectId],
                )
                .map((row) => text(row.value) ?? "")
                .filter(Boolean);
        }

        /*
         * 历史库可能只有 analysis/endpoints，没有 project_* 明细。
         * 单项目数据库下用 endpoints 作为候选回退，重新扫描后会自动切回项目索引。
         */
        if (values.length === 0 && hasTable(db, "endpoints")) {
            const projectCount = numberValue(db.get("SELECT COUNT(*) AS c FROM projects")?.c);
            if (projectCount === 1) {
                if (kind === "endpoint") {
                    values = db
                        .all("SELECT DISTINCT id AS value FROM endpoints ORDER BY id")
                        .map((row) => text(row.value) ?? "")
                        .filter(Boolean);
                } else if (kind === "class") {
                    values = db
                        .all(
                            "SELECT DISTINCT controller AS value FROM endpoints WHERE controller <> '' ORDER BY controller",
                        )
                        .map((row) => text(row.value) ?? "")
                        .filter(Boolean);
                } else {
                    const methods = new Set<string>();
                    for (const row of db.all("SELECT DISTINCT handler AS value FROM endpoints")) {
                        const handler = text(row.value) ?? "";
                        const match = /#([^/]+)\//.exec(handler);
                        if (match) methods.add(match[1]);
                    }
                    values = [...methods];
                }
            }
        }

        const needle = (query?.trim() ?? "").toLowerCase();
        return values
            .filter((value) => !needle || value.toLowerCase().includes(needle))
            .slice(0, limit);
    } finally {
        db.close();
    }
};

const clampLimit = (value: number | undefined): number =>
    value === undefined ? 100 : Math.min(1000, Math.max(1, Math.trunc(value)));

const clampOffset = (value: number | undefined): number =>
    value === undefined ? 0 : Math.max(0, Math.trunc(value));

const copyRow = (row: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
        result[key] = value;
    }
    return result;
};

/** 分页读取表数据；表存在 rowid 时附带 `__rowid` 以支持无主键表编辑。 */
export const loadDatabaseRows = (
    dbPath: string,
    tableName: string,
    limitInput?: number,
    offsetInput?: number,
): DbRows => {
    const limit = clampLimit(limitInput);
    const offset = clampOffset(offsetInput);
    const db = openDatabase(dbPath, true);
    try {
        const table = findTable(db, tableName);
        if (!table) throw new Error(`表或视图不存在：${tableName}`);
        const select = table.hasRowid
            ? `SELECT rowid AS __rowid, * FROM ${quoteIdentifier(table.name)}`
            : `SELECT * FROM ${quoteIdentifier(table.name)}`;
        const order = table.hasRowid ? " ORDER BY rowid" : "";
        const rows = db
            .all(`${select}${order} LIMIT ? OFFSET ?`, [limit, offset])
            .map((row) => copyRow(row));
        return { table, rows, total: table.rowCount, limit, offset };
    } finally {
        db.close();
    }
};

const columnNames = (table: DbTable): ReadonlySet<string> =>
    new Set(table.columns.map((column) => column.name));

const keyNames = (table: DbTable): ReadonlySet<string> => {
    if (table.primaryKey.length > 0) return new Set(table.primaryKey);
    if (table.hasRowid) return new Set(["__rowid"]);
    return new Set();
};

const bindValue = (value: unknown, column: string): string | number | null => {
    if (value === null) return null;
    if (typeof value === "string" || typeof value === "number") return value;
    if (typeof value === "boolean") return value ? 1 : 0;
    throw new Error(`字段 ${column} 的值必须是字符串、数字、布尔值或 null`);
};

const buildValues = (
    table: DbTable,
    values: Record<string, unknown>,
): { readonly columns: string[]; readonly binds: Array<string | number | null> } => {
    const allowed = columnNames(table);
    const columns: string[] = [];
    const binds: Array<string | number | null> = [];
    for (const [column, value] of Object.entries(values)) {
        if (!allowed.has(column)) throw new Error(`字段不存在：${column}`);
        columns.push(column);
        binds.push(bindValue(value, column));
    }
    return { columns, binds };
};

const buildWhere = (
    table: DbTable,
    where: Record<string, unknown>,
): { readonly sql: string; readonly binds: Array<string | number | null> } => {
    const keys = keyNames(table);
    if (keys.size === 0) throw new Error("该表没有主键或 rowid，不能编辑");
    const entries = Object.entries(where);
    if (entries.length !== keys.size) {
        throw new Error(`定位条件必须包含完整主键：${[...keys].join(", ")}`);
    }
    const parts: string[] = [];
    const binds: Array<string | number | null> = [];
    for (const [column, value] of entries) {
        if (!keys.has(column)) throw new Error(`定位字段必须是主键：${column}`);
        parts.push(column === "__rowid" ? "rowid = ?" : `${quoteIdentifier(column)} = ?`);
        binds.push(bindValue(value, column));
    }
    return { sql: parts.join(" AND "), binds };
};

const ensureEditable = (table: DbTable): void => {
    if (table.kind === "view") throw new Error("视图是只读的，不能修改");
};

const runStatement = (
    db: DatabaseType,
    sql: string,
    binds: ReadonlyArray<string | number | null>,
): DbMutationResult => {
    const statement = db.prepare(sql);
    try {
        const result = statement.run([...binds]);
        const lastInsertRowid = numberValue(result.lastInsertRowid);
        return {
            changes: result.changes,
            ...(lastInsertRowid === undefined ? {} : { lastInsertRowid }),
        };
    } finally {
        statement.finalize();
    }
};

export const insertDatabaseRow = (
    dbPath: string,
    tableName: string,
    values: Record<string, unknown>,
): DbMutationResult => {
    const db = openDatabase(dbPath);
    try {
        const table = findTable(db, tableName);
        if (!table) throw new Error(`表不存在：${tableName}`);
        ensureEditable(table);
        const { columns, binds } = buildValues(table, values);
        const sql =
            columns.length === 0
                ? `INSERT INTO ${quoteIdentifier(table.name)} DEFAULT VALUES`
                : `INSERT INTO ${quoteIdentifier(table.name)} (${columns
                      .map(quoteIdentifier)
                      .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
        return runStatement(db, sql, binds);
    } finally {
        db.close();
    }
};

export const updateDatabaseRow = (
    dbPath: string,
    tableName: string,
    where: Record<string, unknown>,
    values: Record<string, unknown>,
): DbMutationResult => {
    const db = openDatabase(dbPath);
    try {
        const table = findTable(db, tableName);
        if (!table) throw new Error(`表不存在：${tableName}`);
        ensureEditable(table);
        const { columns, binds } = buildValues(table, values);
        if (columns.length === 0) throw new Error("没有需要更新的字段");
        const condition = buildWhere(table, where);
        const sql = `UPDATE ${quoteIdentifier(table.name)} SET ${columns
            .map((column) => `${quoteIdentifier(column)} = ?`)
            .join(", ")} WHERE ${condition.sql}`;
        return runStatement(db, sql, [...binds, ...condition.binds]);
    } finally {
        db.close();
    }
};

export const deleteDatabaseRow = (
    dbPath: string,
    tableName: string,
    where: Record<string, unknown>,
): DbMutationResult => {
    const db = openDatabase(dbPath);
    try {
        const table = findTable(db, tableName);
        if (!table) throw new Error(`表不存在：${tableName}`);
        ensureEditable(table);
        const condition = buildWhere(table, where);
        return runStatement(
            db,
            `DELETE FROM ${quoteIdentifier(table.name)} WHERE ${condition.sql}`,
            condition.binds,
        );
    } finally {
        db.close();
    }
};
