import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isSourceKind, scanProject } from "../src/scan.ts";
import { makeTempDir, removeDir, writeFile } from "./test-utils.ts";

let root = "";

before(() => {
    root = makeTempDir("feign-tracer-scan-");
});

after(() => {
    removeDir(root);
});

test("scanProject classifies source and build files", () => {
    writeFile(root, "pom.xml", "<project/>");
    writeFile(root, "settings.gradle.kts", "");
    writeFile(root, "build.gradle", "");
    writeFile(root, "custom.gradle", "");
    writeFile(root, "src/main/java/com/acme/A.java", "class A {}");
    writeFile(root, "src/main/kotlin/com/acme/B.kt", "class B");
    writeFile(root, "src/main/groovy/com/acme/C.groovy", "class C {}");
    writeFile(root, "README.md", "# ignore me");

    const result = scanProject(root, { maxFiles: 100, ignore: [] });
    const byPath = new Map(result.files.map((file) => [file.relPath, file.kind]));

    assert.equal(byPath.get("pom.xml"), "maven");
    assert.equal(byPath.get("settings.gradle.kts"), "gradle-settings");
    assert.equal(byPath.get("build.gradle"), "gradle");
    assert.equal(byPath.get("custom.gradle"), "gradle-other");
    assert.equal(byPath.get("src/main/java/com/acme/A.java"), "java");
    assert.equal(byPath.get("src/main/kotlin/com/acme/B.kt"), "kotlin");
    assert.equal(byPath.get("src/main/groovy/com/acme/C.groovy"), "groovy");
    assert.equal(byPath.has("README.md"), false);
    assert.equal(result.truncated, false);
});

test("scanProject skips default and custom ignore directories", () => {
    writeFile(root, "node_modules/pkg/ignored.java", "class Ignored {}");
    writeFile(root, "target/ignored.java", "class Ignored {}");
    writeFile(root, "generated-sources/ignored.java", "class Ignored {}");

    const result = scanProject(root, { maxFiles: 100, ignore: ["generated-sources"] });

    assert.equal(
        result.files.some((file) => file.relPath.includes("node_modules")),
        false,
    );
    assert.equal(
        result.files.some((file) => file.relPath.includes("target/")),
        false,
    );
    assert.equal(
        result.files.some((file) => file.relPath.includes("generated-sources")),
        false,
    );
    assert.deepEqual([...result.ignoredDirs].sort(), [
        "generated-sources",
        "node_modules",
        "target",
    ]);
});

test("scanProject truncates at maxFiles", () => {
    const limitRoot = makeTempDir("feign-tracer-scan-limit-");
    try {
        for (let index = 0; index < 8; index++) {
            writeFile(limitRoot, `pkg/Type${index}.java`, "class Type {}");
        }
        const result = scanProject(limitRoot, { maxFiles: 3, ignore: [] });
        assert.equal(result.truncated, true);
        assert.equal(result.files.length, 3);
    } finally {
        removeDir(limitRoot);
    }
});

test("isSourceKind only accepts parseable languages", () => {
    assert.equal(isSourceKind("java"), true);
    assert.equal(isSourceKind("kotlin"), true);
    assert.equal(isSourceKind("groovy"), true);
    assert.equal(isSourceKind("maven"), false);
    assert.equal(isSourceKind("gradle"), false);
});
