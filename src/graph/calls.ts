import type {
    CallTreeNode,
    EndpointInfo,
    FeignOperation,
    MethodInfo,
    MethodTrace,
    TypeInfo,
} from "../model.ts";
import { methodLabel } from "../languages/common.ts";
import type { ProjectIndex } from "./index.ts";
import { resolveCalls, type ResolvedCall } from "./resolve.ts";
import { signatureOf } from "./endpoints.ts";
import { paramsOf, visibilityOf } from "./display.ts";

export interface CallTreeOptions {
    readonly maxDepth: number;
    readonly includeExternal: boolean;
    readonly followFeign: boolean;
    readonly excludeSelfCalls: boolean;
    readonly classFilters: readonly RegExp[];
}

interface TreeContext {
    index: ProjectIndex;
    options: CallTreeOptions;
    feignByMethod: Map<string, FeignOperation[]>;
    endpoints: EndpointInfo[];
    nodeBudget: number;
}

export const buildCallTrees = (
    index: ProjectIndex,
    endpoints: EndpointInfo[],
    feignOperations: FeignOperation[],
    options: CallTreeOptions,
    remoteEndpoints: EndpointInfo[] = endpoints,
): void => {
    const context = createContext(index, remoteEndpoints, feignOperations, options);
    const callCache = new Map<string, ResolvedCall[]>();

    for (const endpoint of endpoints) {
        const handler = index.methodById.get(endpoint.handler);
        if (!handler) continue;
        const ancestors = new Set<string>([handler.id]);
        endpoint.tree.children = expandMethod(context, callCache, handler, "0", 0, ancestors);
        endpoint.treeBuilt = true;
    }
};

/** 展开每个精确类名/函数名调用链的根方法。 */
export const buildTraceTrees = (
    index: ProjectIndex,
    traces: MethodTrace[],
    endpoints: EndpointInfo[],
    feignOperations: FeignOperation[],
    options: CallTreeOptions,
    remoteEndpoints: EndpointInfo[] = endpoints,
): void => {
    if (traces.length === 0) return;
    const context = createContext(index, remoteEndpoints, feignOperations, options);
    const callCache = new Map<string, ResolvedCall[]>();

    for (const trace of traces) {
        const handler = index.methodById.get(trace.tree.id);
        if (!handler) continue;
        const ancestors = new Set<string>([handler.id]);
        trace.tree.children = expandMethod(context, callCache, handler, "0", 0, ancestors);
        trace.treeBuilt = true;
    }
};

const createContext = (
    index: ProjectIndex,
    endpoints: EndpointInfo[],
    feignOperations: FeignOperation[],
    options: CallTreeOptions,
): TreeContext => {
    const feignByMethod = new Map<string, FeignOperation[]>();
    for (const operation of feignOperations) {
        const list = feignByMethod.get(operation.id) ?? [];
        list.push(operation);
        feignByMethod.set(operation.id, list);
    }

    return {
        index,
        options,
        feignByMethod,
        endpoints,
        nodeBudget: 20000,
    };
};

const expandMethod = (
    context: TreeContext,
    cache: Map<string, ResolvedCall[]>,
    method: MethodInfo,
    parentSeq: string,
    depth: number,
    ancestors: Set<string>,
): CallTreeNode[] => {
    if (depth >= context.options.maxDepth || context.nodeBudget <= 0) return [];

    let resolved = cache.get(method.id);
    if (!resolved) {
        resolved = resolveCalls(context.index, method);
        cache.set(method.id, resolved);
    }

    const children: CallTreeNode[] = [];
    const byTarget = new Map<string, CallTreeNode>();

    for (const entry of resolved) {
        if (context.nodeBudget <= 0) break;
        const call = entry.call;
        if (call.isConstructor) continue;

        const targets =
            entry.targets && entry.targets.length > 1
                ? entry.targets
                : entry.target
                  ? [entry.target]
                  : [];

        if (targets.length === 0) {
            const leaf = makeSyntheticLeaf(
                context,
                entry,
                method,
                parentSeq,
                depth,
                children.length,
            );
            if (leaf) {
                children.push(leaf);
                context.nodeBudget--;
            }
            continue;
        }

        const multipleImplementations = targets.length > 1;

        for (const target of targets) {
            if (context.nodeBudget <= 0) break;
            if (target.isConstructor) continue;

            // 过滤 1：跳过停留在调用方自身类中的调用（自调用/辅助方法）。
            if (context.options.excludeSelfCalls && target.ownerFqn === method.ownerFqn) continue;

            const type = context.index.typesByFqn.get(target.ownerFqn);
            const displayName = multipleImplementations
                ? target.ownerSimpleName
                : (entry.declaredOwner?.name ?? target.ownerSimpleName);

            // 过滤 2：仅保留目标类名匹配配置正则的节点。
            if (!matchesClassFilter(type, displayName, context.options.classFilters)) continue;

            const existing = byTarget.get(target.id);
            if (existing) {
                existing.callCount = (existing.callCount ?? 1) + 1;
                // 更深层的重复调用仍需标记为循环。
                if (ancestors.has(target.id)) {
                    existing.cyclic = true;
                    existing.children = [];
                }
                continue;
            }

            const node: CallTreeNode = {
                seq: `${parentSeq}-${children.length}`,
                path: `(${parentSeq}-${children.length})`,
                order: children.length,
                depth: depth + 1,
                id: target.id,
                label: methodLabel(displayName, target.name, target.params),
                signature: signatureOf(target),
                params: paramsOf(target),
                visibility: visibilityOf(target, type?.filePath),
                kind: multipleImplementations && type ? context.index.kindOf(type) : entry.kind,
                moduleId: type?.moduleId,
                file: type?.filePath,
                line: call.line,
                annotations: target.annotations.map((annotation) => annotation.name),
                children: [],
            };
            if (multipleImplementations && entry.declaredOwner) {
                node.implementationOf = entry.declaredOwner.name;
            }

            const feignKind = type ? context.index.kindOf(type) : undefined;
            if (feignKind === "feign") {
                node.kind = "feign";
                const operations = context.feignByMethod.get(target.id) ?? [];
                const operation = operations[0];
                if (operation) {
                    node.feign = {
                        service: operation.serviceName,
                        httpMethod: operation.httpMethod,
                        path: operation.path,
                    };
                }
            }

            children.push(node);
            byTarget.set(target.id, node);
            context.nodeBudget--;

            if (ancestors.has(target.id)) {
                node.cyclic = true;
                node.children = [];
                continue;
            }
            if (depth + 1 >= context.options.maxDepth) continue;

            if (node.kind === "feign" && context.options.followFeign) {
                const nextAncestors = new Set(ancestors);
                nextAncestors.add(target.id);
                node.children = expandFeignTargets(
                    context,
                    cache,
                    node,
                    target,
                    nextAncestors,
                    depth + 1,
                );
                continue;
            }

            if (target.bodyStart !== undefined && !target.isAbstract) {
                const nextAncestors = new Set(ancestors);
                nextAncestors.add(target.id);
                node.children = expandMethod(
                    context,
                    cache,
                    target,
                    node.seq,
                    depth + 1,
                    nextAncestors,
                );
            }
        }
    }

    return children;
};

const expandFeignTargets = (
    context: TreeContext,
    cache: Map<string, ResolvedCall[]>,
    feignNode: CallTreeNode,
    feignMethod: MethodInfo,
    ancestors: Set<string>,
    depth: number,
): CallTreeNode[] => {
    const operations = context.feignByMethod.get(feignMethod.id) ?? [];
    if (operations.length === 0) return [];

    const matches: Array<{ endpoint: EndpointInfo; operation: FeignOperation }> = [];
    const linked = new Set(operations.flatMap((operation) => operation.targetEndpoints));
    for (const endpoint of context.endpoints) {
        if (endpoint.handler === feignMethod.id) continue;
        if (!linked.has(`${endpoint.id}::${endpoint.handler}`)) continue;
        const operation = operations.find((candidate) =>
            candidate.targetEndpoints.includes(`${endpoint.id}::${endpoint.handler}`),
        );
        if (operation) matches.push({ endpoint, operation });
    }

    const children: CallTreeNode[] = [];
    for (const match of matches) {
        if (context.nodeBudget <= 0) break;
        const handler = context.index.methodById.get(match.endpoint.handler);
        if (!handler) continue;
        const controllerType = context.index.typesByFqn.get(handler.ownerFqn);
        const node: CallTreeNode = {
            seq: `${feignNode.seq}-${children.length}`,
            path: `(${feignNode.seq}-${children.length})`,
            order: children.length,
            depth: depth + 1,
            id: handler.id,
            label: methodLabel(
                controllerType?.name ?? handler.ownerSimpleName,
                handler.name,
                handler.params,
            ),
            signature: signatureOf(handler),
            params: paramsOf(handler),
            visibility: visibilityOf(handler, controllerType?.filePath),
            kind: "remote",
            moduleId: controllerType?.moduleId,
            file: controllerType?.filePath,
            line: handler.line,
            annotations: handler.annotations.map((annotation) => annotation.name),
            remote: {
                endpoint: match.endpoint.id,
                service: controllerType?.moduleId,
            },
            children: [],
        };
        children.push(node);
        context.nodeBudget--;

        if (ancestors.has(handler.id)) {
            node.cyclic = true;
            continue;
        }
        if (depth + 1 >= context.options.maxDepth) continue;
        const nextAncestors = new Set(ancestors);
        nextAncestors.add(handler.id);
        node.children = expandMethod(context, cache, handler, node.seq, depth + 1, nextAncestors);
    }
    return children;
};

const makeSyntheticLeaf = (
    context: TreeContext,
    entry: ResolvedCall,
    caller: MethodInfo,
    parentSeq: string,
    depth: number,
    index: number,
): CallTreeNode | undefined => {
    if (!context.options.includeExternal) return undefined;

    const type = entry.receiverType;
    const typeName = type?.name ?? entry.declaredOwner?.name;
    if (!matchesClassFilter(type, typeName, context.options.classFilters)) return undefined;

    const id = `${type?.fqn ?? caller.ownerFqn}#${entry.call.name}`;
    const label = typeName
        ? `${typeName}.${entry.call.name}(${entry.call.args.join(", ")})`
        : `${entry.call.qualifier ? `${entry.call.qualifier}.` : ""}${entry.call.name}(${entry.call.args.join(", ")})`;

    return {
        seq: `${parentSeq}-${index}`,
        path: `(${parentSeq}-${index})`,
        order: index,
        depth: depth + 1,
        id,
        label,
        kind: entry.kind === "external" ? "external" : entry.kind,
        moduleId: type?.moduleId,
        file: type?.filePath,
        line: entry.call.line,
        unresolved: true,
        children: [],
    };
};

export const flattenTree = (node: CallTreeNode, result: CallTreeNode[] = []): CallTreeNode[] => {
    result.push(node);
    for (const child of node.children) flattenTree(child, result);
    return result;
};

/**
 * 将类名与配置的正则列表匹配。依次测试已解析类型的简单名、声明/展示名
 * 和全限定名，因此既可使用 `Service$`（匹配接口展示名，即使实际目标是
 * `OrderServiceImpl`），也可使用 `com\.acme\..*`；列表为空时接受所有类。
 */
const matchesClassFilter = (
    type: TypeInfo | undefined,
    fallbackName: string | undefined,
    filters: readonly RegExp[],
): boolean => {
    if (filters.length === 0) return true;
    const names: string[] = [];
    if (type?.name) names.push(type.name);
    if (fallbackName) names.push(fallbackName);
    if (type?.fqn) names.push(type.fqn);
    if (names.length === 0) return false;
    return filters.some((filter) => names.some((name) => filter.test(name)));
};
