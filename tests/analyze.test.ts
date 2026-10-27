import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import sqlite3 from "node-sqlite3-wasm";
import { analyzeDirectory, analyzeDirectoryAsync } from "../src/analyze.ts";
import { writeAnalysisToSqlite } from "../src/store/sqlite.ts";
import { makeTempDir, removeDir, sanitizeResult } from "./test-utils.ts";

const { Database } = sqlite3;

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const shopRoot = join(repoRoot, "examples/shop");
const tempDirs: string[] = [];

after(() => {
    for (const dir of tempDirs) removeDir(dir);
});

test("parallel analysis matches the synchronous analysis", async () => {
    const input = {
        root: shopRoot,
        useCache: false,
        buildTrees: true,
        parseWorkers: 2,
    };

    const syncResult = analyzeDirectory(input);
    const asyncResult = await analyzeDirectoryAsync(input);

    assert.equal(asyncResult.stats.endpoints, syncResult.stats.endpoints);
    assert.equal(asyncResult.stats.sourceFiles, syncResult.stats.sourceFiles);
    assert.deepEqual(sanitizeResult(asyncResult), sanitizeResult(syncResult));
});

/**
 * 方法体转存到工作库后必须与被剥离前的行为完全一致：
 * 调用链、依赖边、解析统计都依赖这部分数据。
 */
test("the work database keeps results identical to in-memory method bodies", async () => {
    const withStore = await analyzeDirectoryAsync({
        root: shopRoot,
        useCache: false,
        buildTrees: true,
        parseWorkers: 2,
        workDb: true,
    });
    const withoutStore = await analyzeDirectoryAsync({
        root: shopRoot,
        useCache: false,
        buildTrees: true,
        parseWorkers: 2,
        workDb: false,
    });

    assert.equal(withStore.stats.calls > 0, true);
    assert.equal(withStore.stats.resolvedCalls, withoutStore.stats.resolvedCalls);
    assert.deepEqual(sanitizeResult(withStore), sanitizeResult(withoutStore));
});

/** 暂存文件路径只改变内存占用，落库结果必须逐行一致。 */
test("streamed call trees write the same rows as in-memory trees", async () => {
    const dir = makeTempDir("feign-tracer-spool-");
    tempDirs.push(dir);
    const spoolPath = join(dir, "trees.ndjson");

    const streamed = await analyzeDirectoryAsync(
        { root: shopRoot, useCache: false, parseWorkers: 1 },
        { treeSpoolPath: spoolPath },
    );
    const inMemory = await analyzeDirectoryAsync({
        root: shopRoot,
        useCache: false,
        parseWorkers: 1,
    });

    // 流式模式下树已经外移：只保留 treeBuilt 标记。
    assert.equal(
        streamed.endpoints.every((endpoint) => endpoint.tree.children.length === 0),
        true,
    );
    assert.equal(streamed.stats.endpointsBuilt, inMemory.stats.endpointsBuilt);

    const streamedDb = join(dir, "streamed.db");
    const memoryDb = join(dir, "memory.db");
    const streamedResult = writeAnalysisToSqlite(streamed, streamedDb, { treeSpool: spoolPath });
    const memoryResult = writeAnalysisToSqlite(inMemory, memoryDb);

    assert.deepEqual(streamedResult.rowCounts, memoryResult.rowCounts);

    const readNodes = (path: string): unknown[] => {
        const db = new Database(path, { readOnly: true });
        try {
            return db.all(
                `SELECT root_type, endpoint_id, seq, path, sort_key, parent_seq, node_order, depth,
                        method_id, label, signature, params_json, visibility, kind, module_id, file, line,
                        annotations_json, call_count, unresolved, cyclic, implementation_of,
                        feign_service, feign_http_method, feign_path, remote_endpoint, remote_service
                 FROM call_nodes ORDER BY root_type, endpoint_id, seq`,
            );
        } finally {
            db.close();
        }
    };
    assert.deepEqual(readNodes(streamedDb), readNodes(memoryDb));
});

test("parallel analysis reuses the parse cache without changing results", async () => {
    const cacheDir = makeTempDir("feign-tracer-analyze-cache-");
    tempDirs.push(cacheDir);
    const input = {
        root: shopRoot,
        cacheDir,
        useCache: true,
        buildTrees: true,
        parseWorkers: 2,
    };

    const first = await analyzeDirectoryAsync(input);
    const second = await analyzeDirectoryAsync(input);

    assert.equal(first.stats.parseErrors, second.stats.parseErrors);
    assert.deepEqual(sanitizeResult(second), sanitizeResult(first));
});

test("exact class/method selection still marks cyclic call trees", async () => {
    const result = await analyzeDirectoryAsync({
        root: join(repoRoot, "examples/cycles"),
        useCache: false,
        classNames: ["CycleService"],
        methodNames: ["a"],
        parseWorkers: 2,
    });

    assert.equal(result.traces.length > 0, true);

    interface TreeLike {
        readonly cyclic?: boolean;
        readonly children: readonly TreeLike[];
    }

    const flatten = (node: TreeLike): boolean =>
        node.cyclic === true || node.children.some((child) => flatten(child));

    assert.equal(
        result.traces.some((trace) => flatten(trace.tree)),
        true,
    );
});
