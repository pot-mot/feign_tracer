import type {
    FileAnalysis,
    FileDependency,
    FileDependencyKind,
    MethodInfo,
    ParsedFile,
    TypeInfo,
} from "../model.ts";
import { flattenTypes, type ProjectIndex } from "./index.ts";
import { resolveCalls } from "./resolve.ts";

export interface FileAnalysisResult {
    /** `includeSource` 为 false 时为空数组。 */
    readonly files: FileAnalysis[];
    /** 全项目调用点总数（含未解析）。 */
    readonly totalCalls: number;
    /** 成功解析到项目内方法目标的调用边数量。 */
    readonly resolvedCalls: number;
}

/**
 * 逐文件统计依赖边与调用数。
 *
 * 这里刻意不保留跨文件的 `ResolvedCall` 缓存：大项目下所有方法的解析结果
 * 常驻会直接吃掉几百 MB，而每个文件只遍历一次自己的 method，重复读取的
 * 只有方法体——那是 `ProjectIndex.callsOf` 的 LRU 在负责，粒度更细、上限可控。
 */
export const analyzeFiles = (index: ProjectIndex, includeSource: boolean): FileAnalysisResult => {
    const files: FileAnalysis[] = [];
    let totalCalls = 0;
    let resolvedCalls = 0;

    for (const file of index.files) {
        const edges = includeSource ? new Map<string, FileDependency>() : undefined;
        const add = (target: string | undefined, kind: FileDependencyKind, line: number) => {
            if (!edges || !target || target === file.path) return;
            let edge = edges.get(target);
            if (!edge) {
                edge = { to: target, kinds: [], lines: [], count: 0 };
                edges.set(target, edge);
            }
            if (!edge.kinds.includes(kind)) edge.kinds.push(kind);
            if (line > 0 && !edge.lines.includes(line)) edge.lines.push(line);
            edge.count++;
        };

        if (edges) {
            for (const imported of file.imports) {
                const type = index.resolveImport(imported);
                if (type) add(type.filePath, "import", 0);
            }
        }

        let fileCalls = 0;
        let fileResolved = 0;
        for (const type of flattenTypes(file.types)) {
            const counters = analyseType(index, file, type, add);
            fileCalls += counters.calls;
            fileResolved += counters.resolved;
            totalCalls += counters.calls;
            resolvedCalls += counters.resolved;
        }

        if (!edges) continue;
        files.push({
            path: file.path,
            language: file.language,
            moduleId: file.moduleId,
            packageName: file.packageName,
            imports: file.imports.map((imported) =>
                imported.wildcard ? `${imported.name}.*` : imported.name,
            ),
            types: flattenTypes(file.types).map((type) => type.fqn),
            dependencies: [...edges.values()].sort((left, right) =>
                left.to.localeCompare(right.to),
            ),
            calls: fileResolved,
            parseErrors: file.parseErrors,
        });
    }

    return { files, totalCalls, resolvedCalls };
};

interface CallCounters {
    calls: number;
    resolved: number;
}

const analyseType = (
    index: ProjectIndex,
    file: ParsedFile,
    type: TypeInfo,
    add: (target: string | undefined, kind: FileDependencyKind, line: number) => void,
): CallCounters => {
    for (const superType of type.superTypes) {
        add(index.resolveType(superType, file, type)?.filePath, "extends", type.line);
    }
    for (const annotation of type.annotations) {
        add(index.resolveType(annotation.name, file, type)?.filePath, "annotation", type.line);
    }
    for (const field of type.fields) {
        add(index.resolveType(field.type, file, type)?.filePath, "field", field.line);
        for (const annotation of field.annotations) {
            add(index.resolveType(annotation.name, file, type)?.filePath, "annotation", field.line);
        }
    }

    const counters: CallCounters = { calls: 0, resolved: 0 };
    for (const method of type.methods) {
        analyseMethod(index, file, type, method, add, counters);
    }
    return counters;
};

const analyseMethod = (
    index: ProjectIndex,
    file: ParsedFile,
    type: TypeInfo,
    method: MethodInfo,
    add: (target: string | undefined, kind: FileDependencyKind, line: number) => void,
    counters: CallCounters,
): void => {
    const calls = index.callsOf(method);
    counters.calls += calls.length;
    addSignatureDependencies(index, file, type, method, add);
    if (calls.length === 0) return;

    const resolved = resolveCalls(index, method);
    for (const entry of resolved) {
        if (!entry.target) continue;
        const targetType = index.typesByFqn.get(entry.target.ownerFqn);
        if (!targetType) continue;
        counters.resolved += 1;
        const kind = index.kindOf(targetType);
        add(targetType.filePath, "call", entry.call.line);
        if (kind === "feign") add(targetType.filePath, "feign", entry.call.line);
        if (kind === "mapper" || kind === "repository")
            add(targetType.filePath, "mapper", entry.call.line);
    }
};

/** 返回值、参数与注解产生的依赖边，与是否解析方法体无关。 */
const addSignatureDependencies = (
    index: ProjectIndex,
    file: ParsedFile,
    type: TypeInfo,
    method: MethodInfo,
    add: (target: string | undefined, kind: FileDependencyKind, line: number) => void,
): void => {
    add(index.resolveType(method.returnType, file, type)?.filePath, "return", method.line);

    for (const param of method.params) {
        add(index.resolveType(param.type, file, type)?.filePath, "parameter", method.line);
        for (const annotation of param.annotations) {
            add(
                index.resolveType(annotation.name, file, type)?.filePath,
                "annotation",
                method.line,
            );
        }
    }
    for (const annotation of method.annotations) {
        add(index.resolveType(annotation.name, file, type)?.filePath, "annotation", method.line);
    }
};
