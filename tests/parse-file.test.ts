import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createParseCache } from "../src/cache.ts";
import { parseSourceFile, parseTask, type ParseTask } from "../src/languages/parse-file.ts";
import { makeTempDir, removeDir, writeFile } from "./test-utils.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
let workDir = "";
let cacheDir = "";

before(() => {
    workDir = makeTempDir("feign-tracer-parse-");
    cacheDir = join(workDir, "cache");
});

after(() => {
    removeDir(workDir);
});

test("parseSourceFile extracts Java structure and calls", () => {
    const absPath = join(
        repoRoot,
        "examples/shop/order-service/src/main/java/com/example/order/controller/OrderController.java",
    );
    const parsed = parseSourceFile({
        absPath,
        relPath: "OrderController.java",
        kind: "java",
    });

    assert.equal(parsed.language, "java");
    assert.equal(parsed.types.length, 1);
    const type = parsed.types[0];
    assert.equal(type.name, "OrderController");
    assert.equal(
        type.annotations.some((annotation) => annotation.name === "RestController"),
        true,
    );
    assert.equal(
        type.methods.some((method) => (method.calls ?? []).length > 0),
        true,
    );
});

test("parseSourceFile falls back to LL when SLL cannot decide", () => {
    const parsed = parseSourceFile({
        absPath: join(
            repoRoot,
            "examples/shop/order-service/src/main/java/com/example/order/service/OrderServiceImpl.java",
        ),
        relPath: "OrderServiceImpl.java",
        kind: "java",
    });

    assert.equal(parsed.parseErrors, 0);
    assert.equal(parsed.types.length, 1);
    assert.equal(parsed.types[0].methods.length > 0, true);
});

test("parseSourceFile keeps call sites inside their own method", () => {
    const source = writeFile(
        workDir,
        "src/com/acme/CallRanges.java",
        "package com.acme;\npublic class CallRanges {\n    public void first() { alpha.run(); }\n    public void second() { beta.run(); }\n    public void third() { gamma.run(); }\n}\n",
    );
    const parsed = parseSourceFile({
        absPath: source,
        relPath: "src/com/acme/CallRanges.java",
        kind: "java",
    });

    const methods = parsed.types[0].methods;
    assert.deepEqual(
        methods.map((method) => (method.calls ?? []).map((call) => call.qualifier)),
        [["alpha"], ["beta"], ["gamma"]],
    );
});

test("parseSourceFile handles Kotlin and Groovy examples", () => {
    const kotlin = parseSourceFile({
        absPath: join(
            repoRoot,
            "examples/gradle-shop/app/src/main/kotlin/com/example/app/DemoController.kt",
        ),
        relPath: "DemoController.kt",
        kind: "kotlin",
    });
    const groovy = parseSourceFile({
        absPath: join(
            repoRoot,
            "examples/shop/order-service/src/main/groovy/com/example/order/LegacyOrderService.groovy",
        ),
        relPath: "LegacyOrderService.groovy",
        kind: "groovy",
    });

    assert.equal(kotlin.language, "kotlin");
    assert.equal(kotlin.types.length > 0, true);
    assert.equal(groovy.language, "groovy");
    assert.equal(groovy.types.length > 0, true);
});

test("parseTask reuses the per-file cache on the second run", () => {
    const source = writeFile(
        workDir,
        "src/com/acme/CachedService.java",
        "package com.acme;\npublic class CachedService {\n    public String load(String id) { return id; }\n}\n",
    );
    const task: ParseTask = {
        absPath: source,
        relPath: "src/com/acme/CachedService.java",
        kind: "java",
        moduleId: "demo",
    };
    const options = { cacheDir, root: workDir };

    const first = parseTask(task, createParseCache(options));
    const second = parseTask(task, createParseCache(options));

    assert.equal(first.cacheHit, false);
    assert.equal(second.cacheHit, true);
    assert.deepEqual(second.parsed, first.parsed);
});

test("parseTask turns a missing file into a placeholder with a warning", () => {
    const task: ParseTask = {
        absPath: join(workDir, "missing/DoesNotExist.java"),
        relPath: "missing/DoesNotExist.java",
        kind: "java",
    };

    const outcome = parseTask(task, undefined);

    assert.equal(outcome.cacheHit, false);
    assert.equal(outcome.parsed.parseErrors, 1);
    assert.equal(outcome.parsed.types.length, 0);
    assert.equal(outcome.warning?.startsWith("Failed to parse missing/DoesNotExist.java:"), true);
});
