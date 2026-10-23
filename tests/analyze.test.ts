import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { analyzeDirectory, analyzeDirectoryAsync } from "../src/analyze.ts";
import { makeTempDir, removeDir, sanitizeResult } from "./test-utils.ts";

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
