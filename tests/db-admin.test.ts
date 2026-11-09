import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import sqlite3 from "node-sqlite3-wasm";
import { analyzeDirectoryAsync } from "../src/analyze.ts";
import {
    deleteDatabaseRow,
    insertDatabaseRow,
    loadDatabaseRows,
    loadDatabaseSchema,
    loadSavedProjects,
    updateDatabaseRow,
} from "../src/store/db-admin.ts";
import { writeAnalysisToSqlite } from "../src/store/sqlite.ts";
import { makeTempDir, removeDir } from "./test-utils.ts";

const { Database } = sqlite3;
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const shopRoot = join(repoRoot, "examples/shop");

let workDir = "";
let dbPath = "";

before(async () => {
    workDir = makeTempDir("feign-tracer-db-admin-");
    dbPath = join(workDir, "analysis.db");
    const result = await analyzeDirectoryAsync({
        root: shopRoot,
        useCache: false,
        parseWorkers: 1,
        buildTrees: false,
    });
    writeAnalysisToSqlite(result, dbPath);
});

after(() => {
    removeDir(workDir);
});

test("schema introspection lists tables, views and primary keys", () => {
    const schema = loadDatabaseSchema(dbPath);
    const names = schema.tables.map((table) => table.name);
    for (const name of [
        "analysis",
        "endpoints",
        "projects",
        "project_files",
        "project_classes",
        "project_methods",
        "project_calls",
        "v_endpoint_overview",
    ]) {
        assert.equal(names.includes(name), true, `缺少 ${name}`);
    }
    assert.equal(schema.tables.find((table) => table.name === "projects")?.kind, "table");
    assert.equal(schema.tables.find((table) => table.name === "v_endpoint_overview")?.kind, "view");
    const stats = schema.tables.find((table) => table.name === "stats");
    assert.deepEqual(stats?.primaryKey, ["name"]);
});

test("rows support pagination and preserve null values", () => {
    const page = loadDatabaseRows(dbPath, "analysis", 10, 0);
    assert.equal(page.total, 1);
    assert.equal(page.rows.length, 1);
    assert.equal(page.limit, 10);
    assert.equal(page.offset, 0);

    const schema = loadDatabaseSchema(dbPath);
    const callNodes = schema.tables.find((table) => table.name === "call_nodes");
    assert.equal(callNodes !== undefined, true);
});

test("tables support insert, update and delete by primary key", () => {
    const inserted = insertDatabaseRow(dbPath, "stats", { name: "custom_metric", value: 42 });
    assert.equal(inserted.changes, 1);

    const updated = updateDatabaseRow(dbPath, "stats", { name: "custom_metric" }, { value: 43 });
    assert.equal(updated.changes, 1);

    const db = new Database(dbPath, { readOnly: true });
    try {
        assert.equal(
            db.get("SELECT value FROM stats WHERE name = ?", ["custom_metric"])?.value,
            43,
        );
    } finally {
        db.close();
    }

    const deleted = deleteDatabaseRow(dbPath, "stats", { name: "custom_metric" });
    assert.equal(deleted.changes, 1);
});

test("saved projects can be filtered by root directory", () => {
    // 读取入口会自动用 analysis.root 回填 projects，无需显式迁移。
    const fallback = loadSavedProjects(dbPath, "shop");
    assert.equal(
        fallback.some((project) => project.baseDir.endsWith("/examples/shop")),
        true,
    );

    const now = new Date().toISOString();
    insertDatabaseRow(dbPath, "projects", {
        base_dir: "D:/repo/alpha",
        created_at: now,
        updated_at: now,
    });
    insertDatabaseRow(dbPath, "projects", {
        base_dir: "D:/repo/beta",
        created_at: now,
        updated_at: now,
    });

    assert.deepEqual(
        loadSavedProjects(dbPath, "alpha").map((project) => project.baseDir),
        ["D:/repo/alpha"],
    );
    assert.deepEqual(
        loadSavedProjects(dbPath, "repo").map((project) => project.baseDir),
        ["D:/repo/alpha", "D:/repo/beta"],
    );
    const all = loadSavedProjects(dbPath, "");
    assert.equal(
        all.some((project) => project.baseDir.endsWith("/examples/shop")),
        true,
    );
    assert.equal(
        all.some((project) => project.baseDir === "D:/repo/alpha"),
        true,
    );
    assert.deepEqual(loadSavedProjects(join(workDir, "missing.db"), ""), []);
});

test("views are read-only and incomplete keys are rejected", () => {
    assert.throws(() => insertDatabaseRow(dbPath, "v_endpoint_overview", { id: "x" }), /视图/);
    assert.throws(() => deleteDatabaseRow(dbPath, "stats", {}), /完整主键/);
});
