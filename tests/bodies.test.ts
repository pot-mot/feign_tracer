import assert from "node:assert/strict";
import { after, test } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseSourceFile } from "../src/languages/parse-file.ts";
import { createBodyStore, detachBodies } from "../src/store/bodies.ts";
import { makeTempDir, removeDir, writeFile } from "./test-utils.ts";

const tempDirs: string[] = [];

after(() => {
    for (const dir of tempDirs) removeDir(dir);
});

const SAMPLE = `package com.acme;

public class Sample {
    public void first(String id) {
        alpha.run(id);
        beta.check();
    }

    public void second() {
        gamma.reset();
    }
}
`;

const makeParsed = (): ReturnType<typeof parseSourceFile> => {
    const dir = makeTempDir("feign-tracer-bodies-");
    tempDirs.push(dir);
    const absPath = writeFile(dir, "src/com/acme/Sample.java", SAMPLE);
    return parseSourceFile({
        absPath,
        relPath: "src/com/acme/Sample.java",
        kind: "java",
    });
};

test("body store round-trips call sites and locals", () => {
    const dir = makeTempDir("feign-tracer-bodies-db-");
    tempDirs.push(dir);
    const dbPath = join(dir, "bodies.db");

    const parsed = makeParsed();
    const methods = parsed.types[0].methods;
    const expected = methods.map((method) => ({
        id: method.id,
        calls: (method.calls ?? []).map((call) => call.name),
        locals: (method.locals ?? []).map((local) => local.name),
    }));

    const store = createBodyStore({ path: dbPath });
    try {
        const stats = detachBodies(store, parsed);
        store.flush();

        // 剥离之后内存结构里不再保留方法体。
        assert.equal(
            methods.every((method) => method.calls === undefined && method.locals === undefined),
            true,
        );
        assert.equal(stats.calls, 3);

        for (const entry of expected) {
            const body = store.load(entry.id);
            assert.notEqual(body, undefined);
            assert.deepEqual(
                (body?.calls ?? []).map((call) => call.name),
                entry.calls,
            );
            assert.deepEqual(
                (body?.locals ?? []).map((local) => local.name),
                entry.locals,
            );
        }
    } finally {
        store.close();
    }

    // close 之后工作库文件必须被删除，不留下临时垃圾。
    assert.equal(existsSync(dbPath), false);
});

test("body store returns undefined for unknown methods", () => {
    const store = createBodyStore();
    try {
        assert.equal(store.load("com.acme.Missing#nope/0"), undefined);
    } finally {
        store.close();
    }
});

test("detaching without a store keeps method bodies in memory", () => {
    const parsed = makeParsed();
    const stats = detachBodies(undefined, parsed);
    assert.equal(stats.calls, 3);
    assert.equal(
        parsed.types[0].methods.every((method) => method.calls !== undefined),
        true,
    );
});
