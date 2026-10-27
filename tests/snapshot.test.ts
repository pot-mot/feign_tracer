import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { analyzeDirectoryAsync } from "../src/analyze.ts";
import type { AnalysisResult, CallTreeNode } from "../src/model.ts";
import type { DeepReadonly } from "../src/types.ts";
import { dropUndefined } from "./test-utils.ts";

/**
 * 全量特征快照。
 *
 * 只保留「识别产生了什么」：端点、调用树节点及状态标记、Feign 关联、文件依赖、
 * 模块边与统计。时间戳、耗时、选项等易变字段一律剔除，因此任何一处识别逻辑
 * 漂移都会在这里炸出来。
 *
 * 需要更新快照时执行：`UPDATE_SNAPSHOT=1 npx tsx --test tests/snapshot.test.ts`
 * 更新后必须人工过一遍 diff，确认变化是预期的。
 */

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const fixtureDir = join(repoRoot, "tests/fixtures");
const updateSnapshot = process.env.UPDATE_SNAPSHOT === "1";

interface SnapshotNode {
    readonly seq: string;
    readonly label: string;
    readonly kind: string;
    readonly depth: number;
    readonly callCount?: number;
    readonly cyclic?: boolean;
    readonly unresolved?: boolean;
    readonly implementationOf?: string;
    readonly feign?: { service?: string; httpMethod: string; path: string };
    readonly remote?: { endpoint: string; service?: string };
    readonly children: SnapshotNode[];
}

const snapshotNode = (node: DeepReadonly<CallTreeNode>): SnapshotNode => ({
    seq: node.seq,
    label: node.label,
    kind: node.kind,
    depth: node.depth,
    ...(node.callCount !== undefined && node.callCount > 1 ? { callCount: node.callCount } : {}),
    ...(node.cyclic ? { cyclic: true } : {}),
    ...(node.unresolved ? { unresolved: true } : {}),
    ...(node.implementationOf ? { implementationOf: node.implementationOf } : {}),
    ...(node.feign
        ? {
              feign: {
                  ...(node.feign.service ? { service: node.feign.service } : {}),
                  httpMethod: node.feign.httpMethod,
                  path: node.feign.path,
              },
          }
        : {}),
    ...(node.remote
        ? {
              remote: {
                  endpoint: node.remote.endpoint,
                  ...(node.remote.service ? { service: node.remote.service } : {}),
              },
          }
        : {}),
    children: node.children.map(snapshotNode),
});

const snapshot = (result: DeepReadonly<AnalysisResult>): unknown =>
    dropUndefined({
        stats: Object.fromEntries(
            Object.entries(result.stats).filter(([key]) => key !== "durationMs"),
        ),
        modules: result.modules.map((module) => ({
            id: module.id,
            name: module.name,
            buildTool: module.buildTool,
            dir: module.dir,
            fileCount: module.fileCount,
            dependencies: module.dependencies.map((dependency) => ({
                to: dependency.to,
                artifactId: dependency.artifactId,
                external: dependency.external,
            })),
        })),
        moduleEdges: result.moduleEdges.map((edge) => [edge.from, edge.to, edge.count]),
        endpoints: result.endpoints.map((endpoint) => ({
            id: endpoint.id,
            httpMethod: endpoint.httpMethod,
            paths: [...endpoint.paths],
            handler: endpoint.handler,
            handlerLabel: endpoint.handlerLabel,
            controller: endpoint.controller,
            moduleId: endpoint.moduleId,
            file: endpoint.file,
            line: endpoint.line,
            treeBuilt: endpoint.treeBuilt,
            tree: snapshotNode(endpoint.tree),
        })),
        traces: result.traces.map((trace) => ({
            id: trace.id,
            className: trace.className,
            methodName: trace.methodName,
            kind: trace.kind,
            implementationOf: trace.implementationOf,
            treeBuilt: trace.treeBuilt,
            tree: snapshotNode(trace.tree),
        })),
        feignClients: result.feignClients.map((client) => ({
            id: client.id,
            name: client.name,
            serviceName: client.serviceName,
            url: client.url,
            file: client.file,
            methods: client.methods.map((method) => ({
                id: method.id,
                httpMethod: method.httpMethod,
                paths: [...method.paths],
                signature: method.signature,
            })),
        })),
        feignOperations: result.feignOperations.map((operation) => ({
            id: operation.id,
            client: operation.client,
            httpMethod: operation.httpMethod,
            path: operation.path,
            serviceName: operation.serviceName,
            targetEndpoints: [...operation.targetEndpoints],
        })),
        files: result.files.map((file) => ({
            path: file.path,
            language: file.language,
            moduleId: file.moduleId,
            packageName: file.packageName,
            imports: [...file.imports],
            types: [...file.types],
            calls: file.calls,
            parseErrors: file.parseErrors,
            dependencies: file.dependencies.map((dependency) => ({
                to: dependency.to,
                kinds: [...dependency.kinds],
                count: dependency.count,
            })),
        })),
        warnings: [...result.warnings],
    });

interface SnapshotCase {
    readonly name: string;
    readonly root: string;
    readonly options: Record<string, unknown>;
}

const CASES: readonly SnapshotCase[] = [
    {
        name: "shop",
        root: join(repoRoot, "examples/shop"),
        options: {},
    },
    {
        name: "cycles",
        root: join(repoRoot, "examples/cycles"),
        options: { classNames: ["CycleService"], methodNames: ["a"] },
    },
    {
        name: "gradle-shop",
        root: join(repoRoot, "examples/gradle-shop"),
        options: {},
    },
];

for (const testCase of CASES) {
    test(`识别结果快照：${testCase.name}`, async () => {
        const result = await analyzeDirectoryAsync({
            root: testCase.root,
            useCache: false,
            parseWorkers: 1,
            ...testCase.options,
        });
        const actual = snapshot(result);
        const fixturePath = join(fixtureDir, `${testCase.name}.snapshot.json`);

        if (updateSnapshot) {
            mkdirSync(dirname(fixturePath), { recursive: true });
            writeFileSync(fixturePath, `${JSON.stringify(actual, null, 4)}\n`, "utf8");
            return;
        }

        assert.equal(
            existsSync(fixturePath),
            true,
            `缺少快照 ${fixturePath}；用 UPDATE_SNAPSHOT=1 生成`,
        );
        const expected: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));
        assert.deepEqual(actual, expected);
    });
}
