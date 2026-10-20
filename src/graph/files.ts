import type {
    FileAnalysis,
    FileDependency,
    FileDependencyKind,
    MethodInfo,
    ParsedFile,
    TypeInfo,
} from "../model.ts";
import { flattenTypes, type ProjectIndex } from "./index.ts";
import { resolveCalls, type ResolvedCall } from "./resolve.ts";

export const buildFileAnalyses = (
    index: ProjectIndex,
    resolveCache: Map<string, ResolvedCall[]>,
): FileAnalysis[] => {
    const results: FileAnalysis[] = [];

    for (const file of index.files) {
        const edges = new Map<string, FileDependency>();
        const add = (target: string | undefined, kind: FileDependencyKind, line: number) => {
            if (!target || target === file.path) return;
            let edge = edges.get(target);
            if (!edge) {
                edge = { to: target, kinds: [], lines: [], count: 0 };
                edges.set(target, edge);
            }
            if (!edge.kinds.includes(kind)) edge.kinds.push(kind);
            if (line > 0 && !edge.lines.includes(line)) edge.lines.push(line);
            edge.count++;
        };

        for (const imported of file.imports) {
            const type = index.resolveImport(imported);
            if (type) add(type.filePath, "import", 0);
        }

        let callCount = 0;
        for (const type of flattenTypes(file.types)) {
            analyseType(index, file, type, add, resolveCache, () => callCount++);
        }

        const types = flattenTypes(file.types).map((type) => type.fqn);
        results.push({
            path: file.path,
            language: file.language,
            moduleId: file.moduleId,
            packageName: file.packageName,
            imports: file.imports.map((imported) =>
                imported.wildcard ? `${imported.name}.*` : imported.name,
            ),
            types,
            dependencies: [...edges.values()].sort((left, right) =>
                left.to.localeCompare(right.to),
            ),
            calls: callCount,
            parseErrors: file.parseErrors,
        });
    }

    return results;
};

const analyseType = (
    index: ProjectIndex,
    file: ParsedFile,
    type: TypeInfo,
    add: (target: string | undefined, kind: FileDependencyKind, line: number) => void,
    cache: Map<string, ResolvedCall[]>,
    countCall: () => void,
): void => {
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

    for (const method of type.methods) {
        analyseMethod(index, file, type, method, add, cache, countCall);
    }
};

const analyseMethod = (
    index: ProjectIndex,
    file: ParsedFile,
    type: TypeInfo,
    method: MethodInfo,
    add: (target: string | undefined, kind: FileDependencyKind, line: number) => void,
    cache: Map<string, ResolvedCall[]>,
    countCall: () => void,
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

    let resolved = cache.get(method.id);
    if (!resolved) {
        resolved = resolveCalls(index, method);
        cache.set(method.id, resolved);
    }

    for (const entry of resolved) {
        if (!entry.target) continue;
        const targetType = index.typesByFqn.get(entry.target.ownerFqn);
        if (!targetType) continue;
        countCall();
        const kind = index.kindOf(targetType);
        add(targetType.filePath, "call", entry.call.line);
        if (kind === "feign") add(targetType.filePath, "feign", entry.call.line);
        if (kind === "mapper" || kind === "repository")
            add(targetType.filePath, "mapper", entry.call.line);
    }
};
