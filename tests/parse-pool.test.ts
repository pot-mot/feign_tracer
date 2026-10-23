import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { join } from "node:path";
import { isSourceKind, scanProject } from "../src/scan.ts";
import type { ParseTask } from "../src/languages/parse-file.ts";
import { parseFilesInPool, resolveParseJobs } from "../src/parse-pool.ts";
import { makeTempDir, minimalJavaInterface, removeDir, writeFile } from "./test-utils.ts";

const FILE_COUNT = 48;
let root = "";
let cacheDir = "";
let tasks: ParseTask[] = [];

before(() => {
    root = makeTempDir("feign-tracer-pool-");
    cacheDir = join(root, ".cache");
    for (let index = 0; index < FILE_COUNT; index++) {
        writeFile(
            root,
            `src/com/acme/Service${index}.java`,
            minimalJavaInterface("com.acme", `Service${index}`),
        );
    }
    const scanned = scanProject(root, { maxFiles: 1000, ignore: [] });
    const collected: ParseTask[] = [];
    for (const file of scanned.files) {
        if (!isSourceKind(file.kind)) continue;
        collected.push({
            absPath: file.absPath,
            relPath: file.relPath,
            kind: file.kind,
        });
    }
    tasks = collected;
});

after(() => {
    removeDir(root);
});

test("resolveParseJobs keeps small batches on one thread", () => {
    assert.equal(resolveParseJobs(0, 0), 1);
    assert.equal(resolveParseJobs(1, 1000), 1);
    assert.equal(resolveParseJobs(2, 8), 1);
});

test("parallel parsing matches the single-threaded result", async () => {
    assert.equal(tasks.length, FILE_COUNT);

    const inline = await parseFilesInPool(tasks, { root, jobs: 1 });
    const progress: number[] = [];
    const pooled = await parseFilesInPool(tasks, {
        root,
        cacheDir,
        jobs: 2,
        onProgress: (completed, total) => {
            assert.equal(total, FILE_COUNT);
            progress.push(completed);
        },
    });

    assert.equal(inline.jobs, 1);
    assert.equal(pooled.jobs, 2);
    assert.equal(pooled.cacheHits, 0);
    assert.deepEqual(pooled.warnings, inline.warnings);
    assert.deepEqual(pooled.parsed, inline.parsed);
    assert.equal(pooled.parsed.length, FILE_COUNT);
    assert.equal(progress[progress.length - 1], FILE_COUNT);
});

test("parallel parsing writes and reuses the parse cache", async () => {
    const reuseCacheDir = join(root, ".cache-reuse");
    const first = await parseFilesInPool(tasks, { root, cacheDir: reuseCacheDir, jobs: 2 });
    const second = await parseFilesInPool(tasks, { root, cacheDir: reuseCacheDir, jobs: 2 });

    assert.equal(first.cacheHits, 0);
    assert.equal(second.cacheHits, FILE_COUNT);
    // 缓存经 JSON 往返会省略值为 undefined 的可选字段，按 JSON 语义比较即可。
    assert.equal(JSON.stringify(second.parsed), JSON.stringify(first.parsed));
    assert.equal(
        second.parsed.every((file) => file.types.length === 1),
        true,
    );
});
