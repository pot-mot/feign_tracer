import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sqlite3 from "node-sqlite3-wasm";
import type { Database as DatabaseType } from "node-sqlite3-wasm";
import type { Language, ParsedFile, TypeInfo } from "../model.ts";
import type { ParseTask } from "../languages/parse-file.ts";
import { PROJECT_TABLES, SCHEMA, SCHEMA_VERSION } from "./schema.ts";

const { Database } = sqlite3;

/** 项目表里保存的文件清单；只记录相对路径与磁盘元数据，不加载解析内容。 */
export interface ProjectFileState {
    readonly path: string;
    readonly absPath: string;
    readonly language: Language;
    readonly moduleId?: string;
    readonly mtimeMs: number;
    readonly size: number;
}

export interface ProjectManifest {
    readonly projectId: number;
    readonly files: ReadonlyMap<string, ProjectFileState>;
}

export interface ProjectWriter {
    readonly projectId: number;
    /** 覆盖写入一个文件的解析结果，同时刷新类/方法/调用关系。 */
    readonly saveFile: (task: ParseTask, parsed: ParsedFile) => void;
    /** 删除已经从磁盘消失的文件，级联清理类、方法与调用。 */
    readonly removeFiles: (paths: readonly string[]) => void;
    /**
     * 为本次写入的调用边补上被调用方函数外键。
     * `resolve` 返回与方法调用点一一对应的目标方法 key。
     */
    readonly updateCallees: (
        resolve: (methodKey: string) => ReadonlyArray<string | undefined>,
    ) => void;
    readonly close: () => void;
    readonly abort: () => void;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const text = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

const numberValue = (value: unknown): number | undefined => {
    const parsed = typeof value === "bigint" ? Number(value) : value;
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
};

const optionalText = (value: unknown): string | undefined => text(value) ?? undefined;

const isLanguage = (value: string): value is Language =>
    value === "java" || value === "kotlin" || value === "groovy";

/** 项目根目录只用于匹配；统一分隔符，避免同一目录出现两种写法。 */
const baseDirOf = (root: string): string => resolve(root).replace(/\\/g, "/");

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

const hasTable = (db: DatabaseType, name: string): boolean => {
    const row = db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [name]);
    return typeof row?.name === "string";
};

/** 判断一个数据库是否已经包含项目索引表，供原子替换时决定是否保留索引。 */
export const hasProjectTables = (dbPath: string): boolean => {
    if (!existsSync(dbPath)) return false;
    const db = new Database(dbPath, { readOnly: true });
    try {
        return hasTable(db, "projects");
    } catch {
        return false;
    } finally {
        db.close();
    }
};

/**
 * 按 `projects.base_dir` 读取文件清单。找不到项目或表结构不存在时返回
 * undefined，调用方会退回完整解析。
 */
export const loadProjectManifest = (dbPath: string, root: string): ProjectManifest | undefined => {
    if (!existsSync(dbPath)) return undefined;
    const db = new Database(dbPath, { readOnly: true });
    try {
        if (!hasTable(db, "projects") || !hasTable(db, "project_files")) return undefined;
        const project = db.get("SELECT id FROM projects WHERE base_dir = ? COLLATE NOCASE", [
            baseDirOf(root),
        ]);
        const projectId = numberValue(project?.id);
        if (projectId === undefined) return undefined;

        const files = new Map<string, ProjectFileState>();
        const rows = db.all(
            `SELECT path, abs_path, language, module_id, mtime_ms, size
             FROM project_files WHERE project_id = ?`,
            [projectId],
        );
        for (const row of rows) {
            const path = text(row.path);
            const absPath = text(row.abs_path);
            const language = text(row.language);
            if (!path || !absPath || !language || !isLanguage(language)) continue;
            files.set(path, {
                path,
                absPath,
                language,
                moduleId: optionalText(row.module_id),
                mtimeMs: numberValue(row.mtime_ms) ?? 0,
                size: numberValue(row.size) ?? 0,
            });
        }
        return { projectId, files };
    } catch {
        return undefined;
    } finally {
        db.close();
    }
};

/**
 * 批量加载需要复用的解析结果。用迭代器逐行读取，避免一次性把所有
 * `parsed_json` 同时留在内存里。
 */
export const loadReusedProjectFiles = (
    dbPath: string,
    projectId: number,
    paths: ReadonlySet<string>,
): Map<string, ParsedFile> => {
    const result = new Map<string, ParsedFile>();
    if (paths.size === 0) return result;
    const db = new Database(dbPath, { readOnly: true });
    const statement = db.prepare(
        "SELECT path, parsed_json FROM project_files WHERE project_id = ?",
    );
    try {
        for (const row of statement.iterate([projectId])) {
            const path = text(row.path);
            const raw = text(row.parsed_json);
            if (!path || !raw || !paths.has(path)) continue;
            try {
                const parsed: unknown = JSON.parse(raw);
                if (isParsedFile(parsed)) result.set(path, parsed);
            } catch {
                // 损坏的单条缓存按未命中处理，随后重新解析。
            }
        }
    } finally {
        statement.finalize();
        db.close();
    }
    return result;
};

const ensureSchema = (db: DatabaseType): void => {
    if (!hasTable(db, "analysis")) {
        db.exec(SCHEMA);
        db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
        return;
    }
    // 旧库可能还没有项目索引表；用 IF NOT EXISTS 原地补齐。
    db.exec(PROJECT_TABLES);
};

const lastId = (result: { readonly lastInsertRowid: number | bigint }): number =>
    Number(result.lastInsertRowid);

const json = (value: unknown): string => JSON.stringify(value);

const insertType = (
    statements: WriterStatements,
    type: TypeInfo,
    fileId: number,
    parentClassId: number | undefined,
    callRows: Map<string, number[]>,
): void => {
    const classResult = statements.insertClass.run([
        fileId,
        parentClassId ?? null,
        type.fqn,
        type.name,
        type.kind,
        type.packageName,
        type.moduleId ?? null,
        json(type.annotations),
        json(type.modifiers),
        json(type.superTypes),
        json(type.fields),
        type.line,
    ]);
    const classId = lastId(classResult);

    for (const method of type.methods) {
        const methodResult = statements.insertMethod.run([
            classId,
            method.id,
            method.name,
            method.ownerFqn,
            method.ownerSimpleName,
            method.ownerKind,
            json(method.annotations),
            json(method.modifiers),
            method.returnType,
            json(method.params),
            method.line,
            method.endLine,
            method.bodyStart ?? null,
            method.bodyEnd ?? null,
            method.isConstructor ? 1 : 0,
            method.isAbstract ? 1 : 0,
            json(method.locals ?? []),
        ]);
        const methodId = lastId(methodResult);
        const rows: number[] = [];
        callRows.set(method.id, rows);
        for (const call of method.calls ?? []) {
            const callResult = statements.insertCall.run([
                methodId,
                null,
                null,
                call.name,
                call.qualifier ?? null,
                call.qualifierKind,
                call.argCount,
                json(call.args),
                call.line,
                call.offset,
                call.isConstructor ? 1 : 0,
            ]);
            rows.push(lastId(callResult));
        }
    }

    for (const nested of type.nested) {
        insertType(statements, nested, fileId, classId, callRows);
    }
};

interface WriterStatements {
    readonly insertProject: ReturnType<DatabaseType["prepare"]>;
    readonly insertFile: ReturnType<DatabaseType["prepare"]>;
    readonly deleteFile: ReturnType<DatabaseType["prepare"]>;
    readonly insertClass: ReturnType<DatabaseType["prepare"]>;
    readonly insertMethod: ReturnType<DatabaseType["prepare"]>;
    readonly insertCall: ReturnType<DatabaseType["prepare"]>;
    readonly findMethod: ReturnType<DatabaseType["prepare"]>;
    readonly updateCall: ReturnType<DatabaseType["prepare"]>;
    readonly touchProject: ReturnType<DatabaseType["prepare"]>;
}

const prepareWriterStatements = (db: DatabaseType): WriterStatements => ({
    insertProject: db.prepare(
        "INSERT INTO projects (base_dir, created_at, updated_at) VALUES (?, ?, ?)",
    ),
    insertFile: db.prepare(
        `INSERT INTO project_files
       (project_id, path, abs_path, language, module_id, package_name, imports_json,
        parse_errors, line_count, mtime_ms, size, parsed_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    deleteFile: db.prepare("DELETE FROM project_files WHERE project_id = ? AND path = ?"),
    insertClass: db.prepare(
        `INSERT INTO project_classes
       (file_id, parent_class_id, fqn, name, kind, package_name, module_id,
        annotations_json, modifiers_json, super_types_json, fields_json, line)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    insertMethod: db.prepare(
        `INSERT INTO project_methods
       (class_id, method_key, name, owner_fqn, owner_simple_name, owner_kind,
        annotations_json, modifiers_json, return_type, params_json, line, end_line,
        body_start, body_end, is_constructor, is_abstract, locals_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    insertCall: db.prepare(
        `INSERT INTO project_calls
       (caller_method_id, callee_method_id, callee_method_key, name, qualifier,
        qualifier_kind, arg_count, args_json, line, offset, is_constructor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    // MethodInfo.id 只包含参数个数；同参数个数的重载会共享 key。
    // 内存索引以最后注册的方法为准，这里保持同样顺序。
    findMethod: db.prepare(
        "SELECT id FROM project_methods WHERE method_key = ? ORDER BY id DESC LIMIT 1",
    ),
    updateCall: db.prepare(
        "UPDATE project_calls SET callee_method_id = ?, callee_method_key = ? WHERE id = ?",
    ),
    touchProject: db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?"),
});

/**
 * 打开项目索引写入器。调用方负责在分析成功后 `close()`，失败时 `abort()`；
 * 所有文件/类/方法/调用写入都处于同一个事务里。
 */
export const createProjectWriter = (dbPath: string, root: string): ProjectWriter => {
    const target = resolve(dbPath);
    mkdirSync(dirname(target), { recursive: true });
    const db = new Database(target);
    // 层级关系依赖外键；SQLite 需要显式开启。
    db.exec("PRAGMA foreign_keys = ON");
    ensureSchema(db);
    db.exec("PRAGMA synchronous = NORMAL");

    const statements = prepareWriterStatements(db);
    const baseDir = baseDirOf(root);
    const now = new Date().toISOString();
    const existing = db.get("SELECT id FROM projects WHERE base_dir = ? COLLATE NOCASE", [baseDir]);
    let projectId = numberValue(existing?.id);
    if (projectId === undefined) {
        projectId = lastId(statements.insertProject.run([baseDir, now, now]));
    }

    const callRows = new Map<string, number[]>();
    let finished = false;

    db.exec("BEGIN");

    const saveFile = (task: ParseTask, parsed: ParsedFile): void => {
        if (finished) return;
        let mtimeMs = task.mtimeMs ?? 0;
        let size = task.bytes ?? 0;
        try {
            const stat = statSync(task.absPath);
            mtimeMs = stat.mtimeMs;
            size = stat.size;
        } catch {
            // 文件在扫描后被删除：仍保存解析占位，避免下次重复报错。
        }

        statements.deleteFile.run([projectId, task.relPath]);
        const fileResult = statements.insertFile.run([
            projectId,
            task.relPath,
            task.absPath,
            parsed.language,
            parsed.moduleId ?? null,
            parsed.packageName,
            json(parsed.imports),
            parsed.parseErrors,
            parsed.lineCount,
            mtimeMs,
            size,
            json(parsed),
        ]);
        const fileId = lastId(fileResult);
        for (const type of parsed.types) {
            insertType(statements, type, fileId, undefined, callRows);
        }
    };

    const removeFiles = (paths: readonly string[]): void => {
        if (finished) return;
        for (const path of paths) statements.deleteFile.run([projectId, path]);
    };

    const updateCallees = (
        resolveTargets: (methodKey: string) => ReadonlyArray<string | undefined>,
    ): void => {
        if (finished) return;
        for (const [methodKey, rows] of callRows) {
            const targets = resolveTargets(methodKey);
            for (let index = 0; index < rows.length; index++) {
                const targetKey = targets[index];
                if (!targetKey) continue;
                const row = statements.findMethod.get([targetKey]);
                const calleeId = numberValue(row?.id);
                statements.updateCall.run([calleeId ?? null, targetKey, rows[index]]);
            }
        }
    };

    const close = (): void => {
        if (finished) return;
        finished = true;
        statements.touchProject.run([new Date().toISOString(), projectId]);
        db.exec("COMMIT");
        for (const statement of Object.values(statements)) statement.finalize();
        db.close();
    };

    const abort = (): void => {
        if (finished) return;
        finished = true;
        try {
            db.exec("ROLLBACK");
        } catch {
            // 事务可能尚未开始或数据库已损坏，继续释放连接。
        }
        for (const statement of Object.values(statements)) statement.finalize();
        db.close();
    };

    return { projectId, saveFile, removeFiles, updateCallees, close, abort };
};
