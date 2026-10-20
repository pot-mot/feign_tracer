import type { CallTreeNode, EndpointInfo, MethodInfo, MethodTrace, TypeInfo } from "../model.ts";
import { methodLabel } from "../languages/common.ts";
import type { ProjectIndex } from "./index.ts";
import { paramsOf, visibilityOf } from "./display.ts";
import { signatureOf } from "./endpoints.ts";

export interface TraceSelection {
    /** 精确类简单名或全限定名；空表示任意类。 */
    readonly classNames: readonly string[];
    /** 精确方法名；空表示所选类的所有方法。 */
    readonly methodNames: readonly string[];
}

export interface TraceBuildResult {
    traces: MethodTrace[];
    warnings: string[];
}

/** 将端点关键词的 AND 语义应用到调用链元数据。 */
export const filterTracesByKeywords = (
    traces: MethodTrace[],
    keywords: string[],
): MethodTrace[] => {
    const active = keywords.map((keyword) => keyword.trim()).filter(Boolean);
    if (active.length === 0) return traces;
    return traces.filter((trace) => {
        const haystack = [
            trace.id,
            trace.className,
            trace.methodName,
            trace.label,
            trace.implementationOf ?? "",
        ]
            .join("\n")
            .toLowerCase();
        return active.every((keyword) => {
            const regex = /^\/(.+)\/([a-z]*)$/i.exec(keyword);
            if (!regex) return haystack.includes(keyword.toLowerCase());
            try {
                return new RegExp(regex[1], `${regex[2].replace(/[gi]/g, "")}i`).test(haystack);
            } catch {
                return haystack.includes(keyword.toLowerCase());
            }
        });
    });
};

const MAX_TRACES = 100;

/**
 * 为精确类名/函数名选择构建方法级调用链。即使类不是控制器，也能直接
 * 追踪 `OrderService#list`；当选中的方法属于接口或抽象类时，每个具体
 * 实现都会成为独立的调用链根。
 */
export const buildMethodTraces = (
    index: ProjectIndex,
    selection: TraceSelection,
    endpoints: EndpointInfo[],
): TraceBuildResult => {
    const classNames = selection.classNames.map((name) => name.trim()).filter(Boolean);
    const methodNames = selection.methodNames.map((name) => name.trim()).filter(Boolean);
    const warnings: string[] = [];
    const traces: MethodTrace[] = [];

    if (classNames.length === 0 && methodNames.length === 0) {
        return { traces, warnings };
    }

    const endpointHandlers = new Set(endpoints.map((endpoint) => endpoint.handler));
    const matchedTypes = selectTypes(index, classNames);

    if (classNames.length > 0 && matchedTypes.length === 0) {
        warnings.push(
            `No class matched exact name(s) ${classNames.join(", ")}; no method traces were built.`,
        );
        return { traces, warnings };
    }

    outer: for (const type of matchedTypes) {
        const methods = type.methods.filter((method) => {
            if (method.isConstructor) return false;
            if (methodNames.length === 0) return true;
            return methodNames.includes(method.name);
        });

        for (const method of methods) {
            const expanded = expandRootMethod(index, type, method, endpointHandlers);
            for (const trace of expanded) {
                if (traces.length >= MAX_TRACES) {
                    warnings.push(
                        `Method trace selection was truncated at ${MAX_TRACES} roots; narrow --class-name/--method-name.`,
                    );
                    break outer;
                }
                traces.push(trace);
            }
        }
    }

    if (traces.length === 0) {
        warnings.push(
            `No traceable method matched ${
                methodNames.length > 0
                    ? `method name(s) ${methodNames.join(", ")}`
                    : "the selection"
            }${classNames.length > 0 ? ` in class(es) ${classNames.join(", ")}` : ""}.`,
        );
    }

    return { traces, warnings };
};

/** 收集某个类型/方法对的具体方法，并展开其实现。 */
const expandRootMethod = (
    index: ProjectIndex,
    type: TypeInfo,
    method: MethodInfo,
    endpointHandlers: Set<string>,
): MethodTrace[] => {
    const isAbstract = type.kind === "interface" || type.kind === "trait" || method.isAbstract;

    if (!isAbstract) {
        if (endpointHandlers.has(method.id)) return [];
        return [makeTrace(index, type, method)];
    }

    const implementations: MethodInfo[] = [];
    const seen = new Set<string>();
    for (const implementation of index.implementationsOf(type)) {
        for (const candidate of index.findMethods(
            implementation,
            method.name,
            method.params.length,
        )) {
            if (candidate.isAbstract || candidate.bodyStart === undefined) continue;
            if (candidate.ownerFqn === type.fqn) continue;
            if (seen.has(candidate.id)) continue;
            seen.add(candidate.id);
            implementations.push(candidate);
        }
    }

    // 无重写的接口默认方法：直接追踪默认实现体。
    if (implementations.length === 0 && method.bodyStart !== undefined && !method.isAbstract) {
        return [makeTrace(index, type, method)];
    }

    return implementations
        .sort((left, right) => left.ownerFqn.localeCompare(right.ownerFqn))
        .map((implementation) => {
            const implementationType = index.typesByFqn.get(implementation.ownerFqn) ?? type;
            return makeTrace(index, implementationType, implementation, type);
        });
};

const makeTrace = (
    index: ProjectIndex,
    type: TypeInfo,
    method: MethodInfo,
    implementationOf?: TypeInfo,
): MethodTrace => {
    const root: CallTreeNode = {
        seq: "0",
        path: "(0)",
        order: 0,
        depth: 0,
        id: method.id,
        label: methodLabel(type.name, method.name, method.params),
        signature: signatureOf(method),
        params: paramsOf(method),
        visibility: visibilityOf(method, type.filePath),
        kind: index.kindOf(type),
        moduleId: type.moduleId,
        file: type.filePath,
        line: method.line,
        children: [],
    };

    return {
        id: `TRACE ${method.id}`,
        className: type.fqn,
        methodName: method.name,
        label: root.label,
        kind: root.kind,
        moduleId: type.moduleId,
        file: type.filePath,
        line: method.line,
        implementationOf: implementationOf?.fqn,
        treeBuilt: false,
        tree: root,
    };
};

const selectTypes = (index: ProjectIndex, classNames: string[]): TypeInfo[] => {
    if (classNames.length === 0) {
        return [...index.typesByFqn.values()];
    }

    const result: TypeInfo[] = [];
    const seen = new Set<string>();
    for (const name of classNames) {
        const byFqn = index.typesByFqn.get(name);
        if (byFqn && !seen.has(byFqn.fqn)) {
            seen.add(byFqn.fqn);
            result.push(byFqn);
            continue;
        }
        for (const candidate of index.typesByName.get(name) ?? []) {
            if (seen.has(candidate.fqn)) continue;
            seen.add(candidate.fqn);
            result.push(candidate);
        }
    }
    return result.sort((left, right) => left.fqn.localeCompare(right.fqn));
};
