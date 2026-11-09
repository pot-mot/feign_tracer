import assert from "node:assert/strict";
import { after, test } from "node:test";
import { statSync, utimesSync } from "node:fs";
import { join } from "node:path";
import sqlite3 from "node-sqlite3-wasm";
import { analyzeDirectoryAsync } from "../src/analyze.ts";
import { loadProjectOptions } from "../src/store/db-admin.ts";
import { writeAnalysisToSqlite } from "../src/store/sqlite.ts";
import { createProject, javaPath, writeFile } from "./test-utils.ts";

const { Database } = sqlite3;

/**
 * 项目索引持久化回归：
 * - 同一 baseDir 的第二次扫描不再解析未变化文件；
 * - project_files / classes / methods / calls 的层级外键可查询；
 * - 强制重扫描会重新读取磁盘并刷新索引。
 */

const projects: Array<{ cleanup: () => void }> = [];
after(() => {
    for (const project of projects) project.cleanup();
});

const controller = (path: string, body: string): string => `package com.acme.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/alpha")
public class AlphaController {

    private final AlphaService service;

    public AlphaController(AlphaService service) {
        this.service = service;
    }

    @GetMapping("${path}")
    public void handle() {
        ${body}
    }
}
`;

const source = (path: string, body: string): Record<string, string> => ({
    [javaPath("com.acme.api", "AlphaController")]: controller(path, body),
    [javaPath("com.acme.api", "AlphaService")]: `package com.acme.api;

public interface AlphaService {
    void work();
}
`,
    [javaPath("com.acme.api", "AlphaServiceImpl")]: `package com.acme.api;

import org.springframework.stereotype.Service;

@Service
public class AlphaServiceImpl implements AlphaService {
    @Override
    public void work() {}
}
`,
});

const endpointIds = (result: { readonly endpoints: ReadonlyArray<{ readonly id: string }> }) =>
    result.endpoints.map((endpoint) => endpoint.id).sort();

test("项目索引写入数据库并按 baseDir 复用", async () => {
    const project = createProject("feign-tracer-project-", source("/one", "service.work();"));
    projects.push(project);
    const dbPath = join(project.root, "analysis.db");

    const first = await analyzeDirectoryAsync(
        { root: project.root, useCache: false, parseWorkers: 1 },
        { projectDbPath: dbPath },
    );
    assert.deepEqual(endpointIds(first), ["GET /alpha/one"]);

    // 模拟真实写入流程：fresh 写入时必须保留项目索引。
    writeAnalysisToSqlite(first, dbPath, { merge: false, preserveProject: true });

    const db = new Database(dbPath, { readOnly: true });
    try {
        const stored = db.get("SELECT id, base_dir FROM projects");
        assert.equal(typeof stored?.base_dir, "string");
        assert.equal(db.get("SELECT COUNT(*) AS c FROM project_files")?.c, 3);
        assert.equal(db.get("SELECT COUNT(*) AS c FROM project_classes")?.c, 3);
        assert.equal(db.get("SELECT COUNT(*) AS c FROM project_methods")?.c, 4);
        assert.equal(db.get("SELECT COUNT(*) AS c FROM project_calls")?.c, 1);
        const edge = db.get(
            "SELECT callee_method_key FROM project_calls WHERE callee_method_key IS NOT NULL",
        );
        assert.equal(edge?.callee_method_key, "com.acme.api.AlphaServiceImpl#work/0");

        const controllerFile = db.get("SELECT id FROM project_files WHERE path = ?", [
            javaPath("com.acme.api", "AlphaController"),
        ]);
        const controllerFileId = controllerFile?.id;
        assert.equal(
            typeof controllerFileId === "number" || typeof controllerFileId === "bigint",
            true,
        );
        const methods = db.all(
            "SELECT m.method_key FROM project_methods m JOIN project_classes c ON c.id = m.class_id WHERE c.file_id = ?",
            [Number(controllerFileId)],
        );
        assert.equal(methods.length, 2);
    } finally {
        db.close();
    }

    // 同内容、同 mtime/size：第二次扫描直接复用数据库中的解析结果。
    const unchanged = await analyzeDirectoryAsync(
        { root: project.root, keywords: ["/alpha"], useCache: false, parseWorkers: 1 },
        { projectDbPath: dbPath },
    );
    assert.deepEqual(endpointIds(unchanged), ["GET /alpha/one"]);
});

test("磁盘变化按 mtime/size 增量更新，强制重扫描覆盖索引", async () => {
    const project = createProject("feign-tracer-project-force-", source("/one", "service.work();"));
    projects.push(project);
    const dbPath = join(project.root, "analysis.db");
    const controllerPath = join(project.root, javaPath("com.acme.api", "AlphaController"));

    const first = await analyzeDirectoryAsync(
        { root: project.root, useCache: false, parseWorkers: 1 },
        { projectDbPath: dbPath },
    );
    assert.deepEqual(endpointIds(first), ["GET /alpha/one"]);

    const before = statSync(controllerPath);
    writeFile(
        project.root,
        javaPath("com.acme.api", "AlphaController"),
        controller("/two", "service.work();"),
    );
    // 保持 size + mtime 不变，模拟「文件内容变化但元数据未变」的极端场景。
    utimesSync(controllerPath, before.atime, before.mtime);

    const reused = await analyzeDirectoryAsync(
        { root: project.root, useCache: false, parseWorkers: 1 },
        { projectDbPath: dbPath },
    );
    assert.deepEqual(endpointIds(reused), ["GET /alpha/one"]);

    const forced = await analyzeDirectoryAsync(
        {
            root: project.root,
            useCache: false,
            parseWorkers: 1,
            forceReparse: true,
        },
        { projectDbPath: dbPath },
    );
    assert.deepEqual(endpointIds(forced), ["GET /alpha/two"]);
});

test("筛选候选来自当前项目的持久化索引", async () => {
    const project = createProject("feign-tracer-options-", source("/one", "service.work();"));
    projects.push(project);
    const dbPath = join(project.root, "analysis.db");

    const result = await analyzeDirectoryAsync(
        { root: project.root, useCache: false, parseWorkers: 1 },
        { projectDbPath: dbPath },
    );
    writeAnalysisToSqlite(result, dbPath, { preserveProject: true });

    assert.deepEqual(loadProjectOptions(dbPath, project.root, "class", "Alpha").sort(), [
        "com.acme.api.AlphaController",
        "com.acme.api.AlphaService",
        "com.acme.api.AlphaServiceImpl",
    ]);
    assert.deepEqual(loadProjectOptions(dbPath, project.root, "method", "wor"), ["work"]);
    assert.deepEqual(loadProjectOptions(dbPath, project.root, "endpoint", "alpha"), [
        "GET /alpha/one",
    ]);
});
