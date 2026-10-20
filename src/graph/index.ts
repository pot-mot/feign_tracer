import type {
    AnnotationInfo,
    ImportInfo,
    MethodInfo,
    ModuleInfo,
    NodeKind,
    ParsedFile,
    TypeInfo,
} from "../model.ts";
import { getAnnotation, hasAnnotation, simpleTypeName } from "../languages/common.ts";

export interface ProjectIndex {
    readonly files: readonly ParsedFile[];
    readonly fileByPath: ReadonlyMap<string, ParsedFile>;
    readonly typesByFqn: ReadonlyMap<string, TypeInfo>;
    readonly typesByName: ReadonlyMap<string, readonly TypeInfo[]>;
    readonly methodsByOwner: ReadonlyMap<string, readonly MethodInfo[]>;
    readonly methodsByName: ReadonlyMap<string, readonly MethodInfo[]>;
    readonly methodById: ReadonlyMap<string, MethodInfo>;
    readonly implementations: ReadonlyMap<string, readonly TypeInfo[]>;
    readonly modules: readonly ModuleInfo[];
    readonly moduleById: ReadonlyMap<string, ModuleInfo>;
    readonly moduleByName: ReadonlyMap<string, ModuleInfo>;
    readonly resolveType: (
        rawName: string | undefined,
        file: ParsedFile | undefined,
        fromType?: TypeInfo,
    ) => TypeInfo | undefined;
    readonly resolveImport: (imported: ImportInfo) => TypeInfo | undefined;
    readonly methodsOf: (
        type: TypeInfo,
        includeInherited?: boolean,
        visited?: Set<string>,
    ) => MethodInfo[];
    readonly findMethods: (type: TypeInfo, name: string, argCount: number) => MethodInfo[];
    readonly findConstructor: (type: TypeInfo, argCount: number) => MethodInfo | undefined;
    readonly implementationsOf: (type: TypeInfo, visited?: Set<string>) => TypeInfo[];
    readonly concreteTypes: (type: TypeInfo) => TypeInfo[];
    readonly moduleOf: (filePath: string) => ModuleInfo | undefined;
    readonly findModule: (nameOrId: string | undefined) => ModuleInfo | undefined;
    readonly kindOf: (type: TypeInfo) => NodeKind;
    readonly typeAnnotation: (type: TypeInfo, ...names: string[]) => AnnotationInfo | undefined;
}

/** 扁平化嵌套类型，调用方可以按文件一次性遍历所有层级。 */
export const flattenTypes = (types: readonly TypeInfo[]): TypeInfo[] => {
    const result: TypeInfo[] = [];
    for (const type of types) {
        result.push(type);
        result.push(...flattenTypes(type.nested));
    }
    return result;
};

/**
 * 项目类型/方法索引。构造阶段只建立 Map，之后对外暴露只读视图；
 * 调用链解析只依赖查询函数，不直接修改索引内容。
 */
export const createProjectIndex = (files: ParsedFile[], modules: ModuleInfo[]): ProjectIndex => {
    const fileByPath = new Map<string, ParsedFile>();
    const typesByFqn = new Map<string, TypeInfo>();
    const typesByName = new Map<string, TypeInfo[]>();
    const methodsByOwner = new Map<string, MethodInfo[]>();
    const methodsByName = new Map<string, MethodInfo[]>();
    const methodById = new Map<string, MethodInfo>();
    const implementations = new Map<string, TypeInfo[]>();
    const moduleById = new Map<string, ModuleInfo>();
    const moduleByName = new Map<string, ModuleInfo>();

    const resolveType = (
        rawName: string | undefined,
        file: ParsedFile | undefined,
        fromType?: TypeInfo,
    ): TypeInfo | undefined => {
        if (!rawName) return undefined;
        let name = rawName.trim();
        if (!name) return undefined;
        if (name.includes(".")) {
            const exact = typesByFqn.get(name);
            if (exact) return exact;
        }

        const simple = simpleTypeName(name);
        if (!simple) return undefined;

        if (fromType) {
            const nested = typesByFqn.get(`${fromType.fqn}.${simple}`);
            if (nested) return nested;
        }

        if (file) {
            const samePackage = typesByFqn.get(
                file.packageName ? `${file.packageName}.${simple}` : simple,
            );
            if (samePackage) return samePackage;

            for (const imported of file.imports) {
                if (imported.wildcard) continue;
                const importedSimple = imported.alias ?? imported.name.split(".").pop() ?? "";
                if (importedSimple === simple) {
                    const found =
                        typesByFqn.get(imported.name) ??
                        (imported.static
                            ? typesByFqn.get(imported.name.split(".").slice(0, -1).join("."))
                            : undefined);
                    if (found) return found;
                }
            }

            for (const imported of file.imports) {
                if (!imported.wildcard) continue;
                const found = typesByFqn.get(`${imported.name}.${simple}`);
                if (found) return found;
            }
        }

        const candidates = typesByName.get(simple) ?? [];
        if (candidates.length === 1) return candidates[0];
        if (candidates.length > 1) {
            const sameModule = file
                ? candidates.filter((candidate) => candidate.moduleId === file.moduleId)
                : [];
            if (sameModule.length === 1) return sameModule[0];
            const samePackage = file
                ? candidates.filter((candidate) => candidate.packageName === file.packageName)
                : [];
            if (samePackage.length === 1) return samePackage[0];
            const nonNested = candidates.filter(
                (candidate) => !candidate.fqn.includes(`.${candidate.name}.`),
            );
            if (nonNested.length === 1) return nonNested[0];
        }
        return undefined;
    };

    const resolveImport = (imported: ImportInfo): TypeInfo | undefined => {
        if (imported.wildcard) return undefined;
        const direct = typesByFqn.get(imported.name);
        if (direct) return direct;
        if (imported.static) {
            const owner = imported.name.split(".").slice(0, -1).join(".");
            return typesByFqn.get(owner);
        }
        return undefined;
    };

    const methodsOf = (
        type: TypeInfo,
        includeInherited = true,
        visited = new Set<string>(),
    ): MethodInfo[] => {
        if (visited.has(type.fqn)) return [];
        visited.add(type.fqn);
        const methods = [...type.methods];
        if (includeInherited) {
            const file = fileByPath.get(type.filePath);
            for (const superName of type.superTypes) {
                const superType = resolveType(superName, file, type);
                if (superType) methods.push(...methodsOf(superType, true, visited));
            }
        }
        return methods;
    };

    const findMethods = (type: TypeInfo, name: string, argCount: number): MethodInfo[] => {
        const candidates = methodsOf(type).filter(
            (method) => !method.isConstructor && method.name === name,
        );
        const exact = candidates.filter((method) => method.params.length === argCount);
        if (exact.length > 0) return exact;
        // Kotlin 默认参数 / Groovy 可选参数：允许实参少于形参。
        const compatible = candidates.filter((method) => argCount <= method.params.length);
        return compatible.length === 1 ? compatible : [];
    };

    const findConstructor = (type: TypeInfo, argCount: number): MethodInfo | undefined =>
        methodsOf(type, false).find(
            (method) => method.isConstructor && method.params.length === argCount,
        );

    const implementationsOf = (type: TypeInfo, visited = new Set<string>()): TypeInfo[] => {
        if (visited.has(type.fqn)) return [];
        visited.add(type.fqn);
        const direct = implementations.get(type.fqn) ?? [];
        const result = [...direct];
        for (const child of direct) result.push(...implementationsOf(child, visited));
        return result;
    };

    const concreteTypes = (type: TypeInfo): TypeInfo[] => {
        if (type.kind === "interface" || type.modifiers.includes("abstract")) {
            return [type, ...implementationsOf(type)];
        }
        return [type];
    };

    const moduleOf = (filePath: string): ModuleInfo | undefined => {
        let best: ModuleInfo | undefined;
        for (const module of modules) {
            const dir = module.dir === "." ? "" : module.dir;
            if (dir === "" || filePath === dir || filePath.startsWith(`${dir}/`)) {
                if (!best || dir.length > (best.dir === "." ? 0 : best.dir.length)) best = module;
            }
        }
        return best;
    };

    const findModule = (nameOrId: string | undefined): ModuleInfo | undefined => {
        if (!nameOrId) return undefined;
        return moduleById.get(nameOrId) ?? moduleByName.get(nameOrId);
    };

    const extendsRepository = (type: TypeInfo): boolean =>
        type.superTypes.some((superName) => {
            const simple = simpleTypeName(superName);
            return (
                /Repository$/.test(simple) ||
                /^JpaRepository$/.test(simple) ||
                /^CrudRepository$/.test(simple)
            );
        });

    const kindOf = (type: TypeInfo): NodeKind => {
        const annotations = type.annotations;
        if (hasAnnotation(annotations, "RestController", "Controller")) return "controller";
        if (hasAnnotation(annotations, "FeignClient")) return "feign";
        if (hasAnnotation(annotations, "Mapper") || /Mapper$/.test(type.name)) return "mapper";
        if (hasAnnotation(annotations, "Repository") || extendsRepository(type)) {
            return "repository";
        }
        if (hasAnnotation(annotations, "Service")) return "service";
        if (hasAnnotation(annotations, "Component")) return "component";
        if (type.kind === "object") return "component";
        return "component";
    };

    const typeAnnotation = (type: TypeInfo, ...names: string[]): AnnotationInfo | undefined =>
        getAnnotation(type.annotations, ...names);

    const registerType = (type: TypeInfo): void => {
        typesByFqn.set(type.fqn, type);
        const list = typesByName.get(type.name) ?? [];
        list.push(type);
        typesByName.set(type.name, list);

        for (const method of type.methods) {
            if (!method.isConstructor) {
                const byName = methodsByName.get(method.name) ?? [];
                byName.push(method);
                methodsByName.set(method.name, byName);
            }
            const byOwner = methodsByOwner.get(type.fqn) ?? [];
            byOwner.push(method);
            methodsByOwner.set(type.fqn, byOwner);
            methodById.set(method.id, method);
        }
        for (const nested of type.nested) registerType(nested);
    };

    const buildImplementations = (): void => {
        for (const type of typesByFqn.values()) {
            for (const superName of type.superTypes) {
                const superType = resolveType(
                    simpleTypeName(superName),
                    fileByPath.get(type.filePath),
                    type,
                );
                if (!superType || superType.fqn === type.fqn) continue;
                const list = implementations.get(superType.fqn) ?? [];
                list.push(type);
                implementations.set(superType.fqn, list);
            }
        }
    };

    for (const module of modules) {
        moduleById.set(module.id, module);
        moduleByName.set(module.name, module);
        if (module.artifactId) moduleByName.set(module.artifactId, module);
    }
    for (const file of files) {
        fileByPath.set(file.path, file);
        for (const type of flattenTypes(file.types)) registerType(type);
    }
    buildImplementations();

    return {
        files,
        fileByPath,
        typesByFqn,
        typesByName,
        methodsByOwner,
        methodsByName,
        methodById,
        implementations,
        modules,
        moduleById,
        moduleByName,
        resolveType,
        resolveImport,
        methodsOf,
        findMethods,
        findConstructor,
        implementationsOf,
        concreteTypes,
        moduleOf,
        findModule,
        kindOf,
        typeAnnotation,
    };
};
