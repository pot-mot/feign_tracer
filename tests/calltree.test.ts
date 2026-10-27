import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { analyzeDirectoryAsync } from "../src/analyze.ts";
import type { CallTreeNode } from "../src/model.ts";
import type { DeepReadonly } from "../src/types.ts";
import { createProject, javaPath, removeDir } from "./test-utils.ts";

/**
 * 调用树「状态标记」的识别回归。
 *
 * 调用链的价值几乎全在这些标记上：是不是循环、是不是没解析到、是不是接口多实现、
 * 同一个目标被调了几次、Feign 有没有跳到远端 Controller。这里逐条锁定语义。
 */

const SOURCES: Readonly<Record<string, string>> = {
    [javaPath("com.acme.tree.controller", "TreeController")]: `package com.acme.tree.controller;

import com.acme.tree.client.TreeClient;
import com.acme.tree.service.ApiPay;
import com.acme.tree.service.TreeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/tree")
public class TreeController {

    private final TreeService service;
    private final ApiPay pay;
    private final TreeClient client;

    public TreeController(TreeService service, ApiPay pay, TreeClient client) {
        this.service = service;
        this.pay = pay;
        this.client = client;
    }

    @GetMapping("/run")
    public void run() {
        service.a();
    }

    @GetMapping("/twice")
    public void twice() {
        service.a();
        service.a();
    }

    @GetMapping("/pay")
    public void pay() {
        pay.charge(1);
    }

    @GetMapping("/ext")
    public void ext() {
        external.call();
    }

    @GetMapping("/feign")
    public void feign() {
        client.ping();
    }
}
`,
    [javaPath("com.acme.tree.service", "TreeService")]: `package com.acme.tree.service;

public interface TreeService {
    void a();
}
`,
    [javaPath("com.acme.tree.service", "TreeServiceImpl")]: `package com.acme.tree.service;

import org.springframework.stereotype.Service;

@Service
public class TreeServiceImpl implements TreeService {

    @Override
    public void a() {
        b();
    }

    private void b() {
        a();
    }
}
`,
    [javaPath("com.acme.tree.service", "ApiPay")]: `package com.acme.tree.service;

public interface ApiPay {
    void charge(int amount);
}
`,
    [javaPath("com.acme.tree.service", "PayA")]: `package com.acme.tree.service;

public class PayA implements ApiPay {
    @Override
    public void charge(int amount) {}
}
`,
    [javaPath("com.acme.tree.service", "PayB")]: `package com.acme.tree.service;

public class PayB implements ApiPay {
    @Override
    public void charge(int amount) {}
}
`,
    [javaPath("com.acme.tree.client", "TreeClient")]: `package com.acme.tree.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient(name = "remote-svc", path = "/remote")
public interface TreeClient {

    @GetMapping("/ping")
    void ping();
}
`,
    [javaPath("com.acme.tree.remote", "RemoteController")]: `package com.acme.tree.remote;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/remote")
public class RemoteController {

    @GetMapping("/ping")
    public void ping() {
    }
}
`,
};

interface FlatNode {
    readonly seq: string;
    readonly depth: number;
    readonly label: string;
    readonly kind: string;
    readonly cyclic: boolean;
    readonly unresolved: boolean;
    readonly callCount?: number;
    readonly implementationOf?: string;
    readonly feign?: { httpMethod: string; path: string };
    readonly remote?: { endpoint: string };
}

const flatten = (node: DeepReadonly<CallTreeNode>): FlatNode[] => {
    const result: FlatNode[] = [
        {
            seq: node.seq,
            depth: node.depth,
            label: node.label,
            kind: node.kind,
            cyclic: node.cyclic === true,
            unresolved: node.unresolved === true,
            callCount: node.callCount,
            implementationOf: node.implementationOf,
            feign: node.feign
                ? { httpMethod: node.feign.httpMethod, path: node.feign.path }
                : undefined,
            remote: node.remote ? { endpoint: node.remote.endpoint } : undefined,
        },
    ];
    for (const child of node.children) result.push(...flatten(child));
    return result;
};

const findEndpoint = <T extends { id: string }>(items: readonly T[], id: string): T => {
    const found = items.find((item) => item.id === id);
    assert.notEqual(found, undefined, `缺少端点 ${id}`);
    if (!found) throw new Error(`missing endpoint ${id}`);
    return found;
};

let root = "";

before(() => {
    root = createProject("feign-tracer-tree-", SOURCES).root;
});

after(() => {
    removeDir(root);
});

const analyze = (options: Record<string, unknown> = {}) =>
    analyzeDirectoryAsync({ root, useCache: false, parseWorkers: 1, ...options });

test("端点树：根节点是 controller，接口调用展开到实现体", async () => {
    const result = await analyze({ classNames: ["TreeController"], methodNames: ["run"] });
    const endpoint = findEndpoint(result.endpoints, "GET /tree/run");

    assert.equal(endpoint.treeBuilt, true);
    assert.deepEqual(
        flatten(endpoint.tree).map((node) => [node.seq, node.label, node.kind, node.cyclic]),
        [
            ["0", "TreeController.run()", "controller", false],
            ["0-0", "TreeService.a()", "service", false],
            ["0-0-0", "TreeServiceImpl.b()", "service", false],
            // a → b → a：回到祖先节点时标记循环并停止继续展开。
            ["0-0-0-0", "TreeServiceImpl.a()", "service", true],
        ],
    );
    // 节点展示名用接口名（declaredOwner），展开体来自唯一实现；
    // 循环节点自身不再有子节点。
    const nodes = flatten(endpoint.tree);
    assert.equal(nodes[nodes.length - 1].cyclic, true);
    assert.equal(nodes.length, 4);
});

test("循环调用在回到祖先时标记 cyclic 并剪掉子树", async () => {
    const result = await analyze({ classNames: ["TreeServiceImpl"], methodNames: ["a"] });
    const trace = result.traces[0];
    assert.equal(trace.treeBuilt, true);

    const nodes = flatten(trace.tree);
    assert.deepEqual(
        nodes.map((node) => [node.seq, node.label, node.cyclic]),
        [
            ["0", "TreeServiceImpl.a()", false],
            ["0-0", "TreeServiceImpl.b()", false],
            ["0-0-0", "TreeServiceImpl.a()", true],
        ],
    );
});

test("同一目标被调用多次折叠成一个节点并累加 callCount", async () => {
    const result = await analyze({ classNames: ["TreeController"], methodNames: ["twice"] });
    const endpoint = findEndpoint(result.endpoints, "GET /tree/twice");
    const topLevel = flatten(endpoint.tree).filter((node) => node.depth === 1);

    assert.equal(topLevel.length, 1);
    assert.equal(topLevel[0].label, "TreeService.a()");
    assert.equal(topLevel[0].callCount, 2);
});

test("接口多实现时每个实现各成一个节点并带 implementationOf", async () => {
    const result = await analyze({
        classNames: ["TreeController"],
        methodNames: ["pay"],
        // 默认类名过滤会剪掉 PayA/PayB，这里只看多实现展开本身。
        classFilters: [],
    });
    const endpoint = findEndpoint(result.endpoints, "GET /tree/pay");
    const nodes = flatten(endpoint.tree).filter((node) => node.depth === 1);

    assert.deepEqual(
        nodes.map((node) => [node.label, node.implementationOf]),
        [
            ["PayA.charge(amount)", "ApiPay"],
            ["PayB.charge(amount)", "ApiPay"],
        ],
    );
    // 默认过滤下这两个实现类不在白名单里，因此整棵子树被剪掉。
    const filtered = await analyze({
        classNames: ["TreeController"],
        methodNames: ["pay"],
    });
    assert.equal(flatten(findEndpoint(filtered.endpoints, "GET /tree/pay").tree).length, 1);
});

test("未解析调用默认丢弃，includeExternal 时作为 unresolved 叶子保留", async () => {
    const withoutExternal = await analyze({
        classNames: ["TreeController"],
        methodNames: ["ext"],
    });
    assert.deepEqual(flatten(findEndpoint(withoutExternal.endpoints, "GET /tree/ext").tree), [
        flatten(findEndpoint(withoutExternal.endpoints, "GET /tree/ext").tree)[0],
    ]);

    const withExternal = await analyze({
        classNames: ["TreeController"],
        methodNames: ["ext"],
        includeExternal: true,
        classFilters: [],
    });
    const nodes = flatten(findEndpoint(withExternal.endpoints, "GET /tree/ext").tree);
    assert.equal(nodes.length, 2);
    assert.equal(nodes[1].unresolved, true);
    assert.equal(nodes[1].kind, "external");
    assert.equal(nodes[1].label, "external.call()");
});

test("maxDepth 限制展开层级", async () => {
    const full = await analyze({ classNames: ["TreeController"], methodNames: ["run"] });
    const limited = await analyze({
        classNames: ["TreeController"],
        methodNames: ["run"],
        maxDepth: 1,
    });

    assert.equal(flatten(findEndpoint(full.endpoints, "GET /tree/run").tree).length, 4);
    assert.deepEqual(
        flatten(findEndpoint(limited.endpoints, "GET /tree/run").tree).map((node) => node.seq),
        ["0", "0-0"],
    );
});

test("classFilters 按目标类名剪枝", async () => {
    const result = await analyze({
        classNames: ["TreeController"],
        methodNames: ["run"],
        classFilters: ["Controller$"],
    });
    assert.equal(flatten(findEndpoint(result.endpoints, "GET /tree/run").tree).length, 1);
});

test("excludeSelfCalls 跳过停留在调用方自身类中的调用", async () => {
    const result = await analyze({
        classNames: ["TreeServiceImpl"],
        methodNames: ["a"],
        excludeSelfCalls: true,
    });
    const nodes = flatten(result.traces[0].tree);
    assert.deepEqual(
        nodes.map((node) => node.label),
        ["TreeServiceImpl.a()"],
    );
});

test("Feign 调用展开到远端 Controller 并带上 remote 信息", async () => {
    const result = await analyze({ classNames: ["TreeController"], methodNames: ["feign"] });
    const nodes = flatten(findEndpoint(result.endpoints, "GET /tree/feign").tree);

    assert.equal(nodes.length, 3);
    assert.equal(nodes[1].kind, "feign");
    assert.deepEqual(nodes[1].feign, { httpMethod: "GET", path: "/remote/ping" });
    assert.equal(nodes[2].kind, "remote");
    assert.equal(nodes[2].remote?.endpoint, "GET /remote/ping");
});

test("buildTrees=false 时只索引端点，树保持未构建", async () => {
    const result = await analyze({ buildTrees: false });
    assert.equal(result.endpoints.length > 0, true);
    assert.equal(
        result.endpoints.every((endpoint) => endpoint.treeBuilt === false),
        true,
    );
    assert.equal(
        result.endpoints.every((endpoint) => endpoint.tree.children.length === 0),
        true,
    );
    assert.equal(result.stats.endpointsBuilt, 0);
    assert.equal(
        result.warnings.some((warning) => warning.includes("--no-trees")),
        true,
    );
});

test("接口方法按精确类名追踪时每个实现各成一棵树", async () => {
    const result = await analyze({ classNames: ["ApiPay"], methodNames: ["charge"] });
    assert.deepEqual(
        result.traces.map((trace) => [trace.className, trace.implementationOf]),
        [
            ["com.acme.tree.service.PayA", "com.acme.tree.service.ApiPay"],
            ["com.acme.tree.service.PayB", "com.acme.tree.service.ApiPay"],
        ],
    );
    assert.equal(
        result.traces.every((trace) => trace.treeBuilt),
        true,
    );
});
