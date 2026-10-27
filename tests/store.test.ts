import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import sqlite3 from "node-sqlite3-wasm";
import { analyzeDirectoryAsync } from "../src/analyze.ts";
import type { CallTreeNode } from "../src/model.ts";
import { SQLITE_SCHEMA_VERSION, writeAnalysisToSqlite } from "../src/store/sqlite.ts";
import type { DeepReadonly } from "../src/types.ts";
import { makeTempDir, removeDir } from "./test-utils.ts";

const { Database } = sqlite3;
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const shopRoot = join(repoRoot, "examples/shop");

/**
 * SQLite 落库状态回归。
 *
 * 关注的是「写完之后库里的状态对不对」：schema 版本、建树标记、节点父子关系、
 * 排序键，以及增量合并不该丢的旧树。这些是 Web UI 和 SQL 查询直接依赖的东西。
 */

let workDir = "";

before(() => {
    workDir = makeTempDir("feign-tracer-store-");
});

after(() => {
    removeDir(workDir);
});

const read = <T>(path: string, query: (db: InstanceType<typeof Database>) => T): T => {
    const db = new Database(path, { readOnly: true });
    try {
        return query(db);
    } finally {
        db.close();
    }
};

const asNumber = (value: unknown): number =>
    typeof value === "number" ? value : Number(value ?? 0);
const text = (value: unknown): string => (typeof value === "string" ? value : "");

test("全新写入：schema 版本、表与视图齐全", async () => {
    const dbPath = join(workDir, "schema.db");
    const result = await analyzeDirectoryAsync({
        root: shopRoot,
        useCache: false,
        parseWorkers: 1,
    });
    const info = writeAnalysisToSqlite(result, dbPath);

    assert.equal(info.rowCounts.call_nodes > 0, true);
    assert.equal(info.rowCounts.endpoints, result.stats.endpoints);
    assert.equal(info.rowCounts.source_files, result.stats.sourceFiles);

    read(dbPath, (db) => {
        assert.equal(asNumber(db.get("PRAGMA user_version")?.user_version), SQLITE_SCHEMA_VERSION);

        const tables = db
            .all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
            .map((row) => text(row.name));
        for (const table of [
            "analysis",
            "call_nodes",
            "endpoints",
            "feign_operations",
            "file_dependencies",
            "source_files",
            "traces",
        ]) {
            assert.equal(tables.includes(table), true, `缺少表 ${table}`);
        }

        const views = db
            .all("SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name")
            .map((row) => text(row.name));
        assert.deepEqual(views, [
            "v_endpoint_overview",
            "v_file_overview",
            "v_module_overview",
            "v_trace_overview",
        ]);
    });
});

test("建树状态：tree_built 与 stats.endpointsBuilt 一致", async () => {
    const dbPath = join(workDir, "built.db");
    const result = await analyzeDirectoryAsync({
        root: shopRoot,
        useCache: false,
        parseWorkers: 1,
    });
    writeAnalysisToSqlite(result, dbPath);

    read(dbPath, (db) => {
        const built = db.all("SELECT id, tree_built FROM endpoints");
        assert.equal(built.length, result.stats.endpoints);
        assert.equal(
            built.filter((row) => asNumber(row.tree_built) === 1).length,
            result.stats.endpointsBuilt,
        );
        // 每个已建树的端点都必须真的有节点行。
        for (const row of built) {
            const nodes = asNumber(
                db.get("SELECT COUNT(*) AS c FROM call_nodes WHERE endpoint_id = ?", [text(row.id)])
                    ?.c,
            );
            assert.equal(
                nodes > 0,
                asNumber(row.tree_built) === 1,
                `端点 ${text(row.id)} 状态不一致`,
            );
        }
    });
});

test("call_nodes：父子关系、排序键与树结构一致", async () => {
    const dbPath = join(workDir, "nodes.db");
    const result = await analyzeDirectoryAsync({
        root: shopRoot,
        useCache: false,
        parseWorkers: 1,
    });
    writeAnalysisToSqlite(result, dbPath);

    // 与内存中的树逐节点对照。
    const expected = new Map<string, { parent?: string; sortKey: string; seq: string }>();
    const walk = (endpointId: string, node: DeepReadonly<CallTreeNode>, parent?: string): void => {
        expected.set(`${endpointId}\u0000${node.seq}`, {
            parent,
            seq: node.seq,
            sortKey: node.seq
                .split("-")
                .map((part) => part.padStart(4, "0"))
                .join("."),
        });
        for (const child of node.children) walk(endpointId, child, node.seq);
    };
    for (const endpoint of result.endpoints) {
        if (endpoint.treeBuilt) walk(endpoint.id, endpoint.tree);
    }

    read(dbPath, (db) => {
        const rows = db.all(
            "SELECT endpoint_id, seq, parent_seq, sort_key FROM call_nodes ORDER BY endpoint_id, sort_key",
        );
        assert.equal(rows.length, expected.size, "库内节点数应与内存树节点数一致");
        for (const row of rows) {
            const key = `${text(row.endpoint_id)}\u0000${text(row.seq)}`;
            const entry = expected.get(key);
            assert.notEqual(entry, undefined, `多出节点 ${key}`);
            if (!entry) continue;
            assert.equal(text(row.sort_key), entry.sortKey);
            const parent = row.parent_seq === null ? undefined : text(row.parent_seq);
            assert.equal(parent, entry.parent, `节点 ${key} 的 parent_seq 不正确`);
        }
    });
});

test("增量合并：未重建端点的调用树仍然保留", async () => {
    const dbPath = join(workDir, "merge.db");
    const full = await analyzeDirectoryAsync({ root: shopRoot, useCache: false, parseWorkers: 1 });
    writeAnalysisToSqlite(full, dbPath);

    const rootsBefore = read(dbPath, (db) =>
        db
            .all(
                "SELECT DISTINCT endpoint_id FROM call_nodes WHERE root_type = 'endpoint' ORDER BY endpoint_id",
            )
            .map((row) => text(row.endpoint_id)),
    );
    assert.equal(rootsBefore.length, full.stats.endpointsBuilt);

    // 只重建一个端点，其余端点的树不应被删除。
    const partial = await analyzeDirectoryAsync({
        root: shopRoot,
        useCache: false,
        parseWorkers: 1,
        classNames: ["UserController"],
        methodNames: ["getUser"],
    });
    assert.equal(partial.stats.endpointsBuilt, 1);

    writeAnalysisToSqlite(partial, dbPath, { merge: true });

    read(dbPath, (db) => {
        const rootsAfter = db
            .all(
                "SELECT DISTINCT endpoint_id FROM call_nodes WHERE root_type = 'endpoint' ORDER BY endpoint_id",
            )
            .map((row) => text(row.endpoint_id));
        assert.deepEqual(rootsAfter, rootsBefore);

        // 所有端点仍标记为已建树（未重建的由 call_nodes 反推回填）。
        const built = db.all("SELECT id, tree_built FROM endpoints");
        assert.equal(
            built.every((row) => asNumber(row.tree_built) === 1),
            true,
        );
    });
});

test("暂存文件与内存树写出的库内容一致", async () => {
    const streamedDb = join(workDir, "streamed.db");
    const memoryDb = join(workDir, "memory.db");
    const spool = join(workDir, "trees.ndjson");

    const streamed = await analyzeDirectoryAsync(
        { root: shopRoot, useCache: false, parseWorkers: 1 },
        { treeSpoolPath: spool },
    );
    const memory = await analyzeDirectoryAsync({
        root: shopRoot,
        useCache: false,
        parseWorkers: 1,
    });

    const streamedInfo = writeAnalysisToSqlite(streamed, streamedDb, { treeSpool: spool });
    const memoryInfo = writeAnalysisToSqlite(memory, memoryDb);

    assert.deepEqual(streamedInfo.rowCounts, memoryInfo.rowCounts);

    const dump = (path: string): unknown =>
        read(path, (db) =>
            db.all(
                `SELECT root_type, endpoint_id, seq, path, sort_key, parent_seq, node_order, depth,
                        method_id, label, signature, params_json, visibility, kind, module_id, file, line,
                        annotations_json, call_count, unresolved, cyclic, implementation_of,
                        feign_service, feign_http_method, feign_path, remote_endpoint, remote_service
                 FROM call_nodes ORDER BY root_type, endpoint_id, sort_key`,
            ),
        );
    assert.deepEqual(dump(streamedDb), dump(memoryDb));
});
