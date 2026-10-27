import type { CallSite, MethodInfo, NodeKind, ParsedFile, TypeInfo } from "../model.ts";
import type { ProjectIndex } from "./index.ts";

export interface ResolvedCall {
    call: CallSite;
    target?: MethodInfo;
    /**
     * 接口/抽象接收者方法的全部具体实现。仅在存在多个实现时出现；
     * `target` 仍保存主目标，以兼容展示与单实现场景。
     */
    targets?: MethodInfo[];
    /** 用于展示/标记调用边的类型（通常是声明的接口）。 */
    declaredOwner?: TypeInfo;
    receiverType?: TypeInfo;
    kind: NodeKind;
    ambiguous?: boolean;
    /** 接收者已明确是项目类型，但未找到对应成员。 */
    unresolvedMember?: boolean;
}

interface MethodEnv {
    owner: TypeInfo;
    file: ParsedFile | undefined;
    variables: Map<string, string>;
    /** 含继承字段的类型视图，由索引按类型记忆化，避免逐方法重算。 */
    fields: ReadonlyMap<string, string>;
}

export const resolveCalls = (index: ProjectIndex, method: MethodInfo): ResolvedCall[] => {
    const owner = index.typesByFqn.get(method.ownerFqn);
    if (!owner) return [];
    const file = index.fileByPath.get(owner.filePath);
    const calls = index.callsOf(method);
    if (calls.length === 0) return [];
    const env = buildEnvironment(index, method, owner, file);

    return calls.map((call) => resolveOne(index, method, env, call));
};

const buildEnvironment = (
    index: ProjectIndex,
    method: MethodInfo,
    owner: TypeInfo,
    file: ParsedFile | undefined,
): MethodEnv => {
    const variables = new Map<string, string>();
    for (const param of method.params) {
        if (param.name) variables.set(param.name, param.type);
    }
    // 局部变量同样可能已被剥离到工作库，统一走索引访问器。
    for (const local of index.localsOf(method)) {
        if (local.name && local.type) variables.set(local.name, local.type);
    }

    return { owner, file, variables, fields: index.fieldTypesOf(owner) };
};

const resolveOne = (
    index: ProjectIndex,
    caller: MethodInfo,
    env: MethodEnv,
    call: CallSite,
): ResolvedCall => {
    if (call.isConstructor) {
        const type = index.resolveType(call.qualifier ?? call.name, env.file, env.owner);
        if (type) {
            return {
                call,
                target: index.findConstructor(type, call.argCount),
                declaredOwner: type,
                receiverType: type,
                kind: index.kindOf(type),
            };
        }
        return { call, kind: "external" };
    }

    let receiverType: TypeInfo | undefined;

    if (call.qualifierKind === "implicit" || call.qualifierKind === "this") {
        receiverType = env.owner;
    } else if (call.qualifierKind === "type") {
        receiverType = index.resolveType(call.qualifier, env.file, env.owner);
    } else if (call.qualifierKind === "expr") {
        receiverType = resolveExpressionType(index, env, call.qualifier);
    }

    if (receiverType) {
        const found = lookupInType(index, receiverType, call.name, call.argCount);
        if (found.length > 0) {
            const target = chooseMethod(found, caller, receiverType);
            return {
                call,
                target,
                targets: implementationTargets(found, receiverType),
                declaredOwner: receiverType,
                receiverType,
                kind: target ? kindOfMethod(index, target) : index.kindOf(receiverType),
                ambiguous: found.length > 1,
            };
        }

        if (receiverType.kind === "interface" || receiverType.modifiers.includes("abstract")) {
            const impls = index.concreteTypes(receiverType).slice(1);
            const fromImpls: MethodInfo[] = [];
            for (const impl of impls) {
                fromImpls.push(...index.findMethods(impl, call.name, call.argCount));
            }
            if (fromImpls.length > 0) {
                const target = chooseMethod(fromImpls, caller, receiverType);
                return {
                    call,
                    target,
                    targets: implementationTargets(fromImpls, receiverType),
                    declaredOwner: receiverType,
                    receiverType,
                    kind: target ? kindOfMethod(index, target) : index.kindOf(receiverType),
                    ambiguous: fromImpls.length > 1,
                };
            }
        }

        return {
            call,
            declaredOwner: receiverType,
            receiverType,
            kind: index.kindOf(receiverType),
            unresolvedMember: true,
        };
    }

    // 没有接收者类型信息：尝试定位唯一的项目方法。
    const candidates = (index.methodsByName.get(call.name) ?? []).filter(
        (method) => !method.isConstructor && method.params.length === call.argCount,
    );
    if (candidates.length === 0) return { call, kind: "external" };

    const scored = candidates
        .map((candidate) => ({
            method: candidate,
            score: scoreCandidate(index, caller, call, candidate),
        }))
        .sort((left, right) => right.score - left.score);
    const best = scored[0];
    if (!best) return { call, kind: "external" };

    if (scored.length === 1 || (best.score >= 35 && best.score > (scored[1]?.score ?? 0))) {
        return {
            call,
            target: best.method,
            declaredOwner: index.typesByFqn.get(best.method.ownerFqn),
            kind: kindOfMethod(index, best.method),
            ambiguous: scored.filter((entry) => entry.score === best.score).length > 1,
        };
    }

    return { call, kind: "external", ambiguous: true };
};

const lookupInType = (
    index: ProjectIndex,
    type: TypeInfo,
    name: string,
    argCount: number,
): MethodInfo[] => {
    const results: MethodInfo[] = [];
    for (const concrete of index.concreteTypes(type)) {
        results.push(...index.findMethods(concrete, name, argCount));
    }
    // 去重解析到相同 owner/name/arity 的重写方法。
    const seen = new Set<string>();
    return results.filter((method) => {
        if (seen.has(method.id)) return false;
        seen.add(method.id);
        return true;
    });
};

const chooseMethod = (
    methods: MethodInfo[],
    caller: MethodInfo,
    receiverType: TypeInfo,
): MethodInfo | undefined => {
    if (methods.length === 1) return methods[0];
    const withBody = methods.filter(
        (method) => !method.isAbstract && method.bodyStart !== undefined,
    );
    const pool = withBody.length > 0 ? withBody : methods;
    const exactOwner = pool.find((method) => method.ownerFqn === receiverType.fqn);
    if (exactOwner) return exactOwner;
    const sameModule = pool.filter((method) => method.ownerFqn !== caller.ownerFqn);
    return sameModule[0] ?? pool[0];
};

/**
 * 返回接口/抽象方法的全部具体实现，每个实现类一项。没有或只有一个
 * 具体实现时返回 undefined，此时使用普通单目标调用边。
 */
const implementationTargets = (
    methods: MethodInfo[],
    receiverType: TypeInfo,
): MethodInfo[] | undefined => {
    const byOwner = new Map<string, MethodInfo>();
    for (const method of methods) {
        if (method.isAbstract || method.bodyStart === undefined) continue;
        if (method.ownerFqn === receiverType.fqn) continue;
        if (!byOwner.has(method.ownerFqn)) byOwner.set(method.ownerFqn, method);
    }
    if (byOwner.size <= 1) return undefined;
    return [...byOwner.values()].sort((left, right) => left.ownerFqn.localeCompare(right.ownerFqn));
};

const kindOfMethod = (index: ProjectIndex, method: MethodInfo): NodeKind => {
    const type = index.typesByFqn.get(method.ownerFqn);
    return type ? index.kindOf(type) : "component";
};

const resolveExpressionType = (
    index: ProjectIndex,
    env: MethodEnv,
    raw: string | undefined,
): TypeInfo | undefined => {
    if (!raw) return undefined;
    let expression = raw.trim();
    if (expression.startsWith("this.")) expression = expression.slice(5);
    if (expression.startsWith("super.")) expression = expression.slice(6);

    const parts = expression.split(".").filter(Boolean);
    if (parts.length === 0) return env.owner;

    let currentType: TypeInfo | undefined;
    const first = parts[0];
    const declared =
        env.variables.get(first) ??
        env.fields.get(first) ??
        (first === "this" ? env.owner.name : undefined);

    if (declared) {
        currentType = index.resolveType(declared, env.file, env.owner);
    } else {
        currentType = index.resolveType(first, env.file, env.owner);
    }
    if (!currentType) return undefined;

    for (const part of parts.slice(1)) {
        if (part === "this") continue;
        const field = findField(index, currentType, part);
        if (field) {
            currentType = index.resolveType(field, env.file, currentType);
            if (!currentType) return undefined;
        } else if (index.methodsOf(currentType).some((method) => method.name === part)) {
            // 方法调用链；此处不跟踪返回类型。
            return undefined;
        } else {
            return undefined;
        }
    }
    return currentType;
};

const findField = (
    index: ProjectIndex,
    type: TypeInfo,
    name: string,
    visited = new Set<string>(),
): string | undefined => {
    if (visited.has(type.fqn)) return undefined;
    visited.add(type.fqn);
    const field = type.fields.find((candidate) => candidate.name === name);
    if (field) return field.type;
    const file = index.fileByPath.get(type.filePath);
    for (const superName of type.superTypes) {
        const superType = index.resolveType(superName, file, type);
        if (!superType) continue;
        const inherited = findField(index, superType, name, visited);
        if (inherited) return inherited;
    }
    return undefined;
};

const scoreCandidate = (
    index: ProjectIndex,
    caller: MethodInfo,
    call: CallSite,
    candidate: MethodInfo,
): number => {
    let score = 0;
    if (candidate.ownerFqn === caller.ownerFqn) score += 100;
    const callerType = index.typesByFqn.get(caller.ownerFqn);
    const candidateType = index.typesByFqn.get(candidate.ownerFqn);

    if (callerType && candidateType) {
        if (candidateType.packageName === callerType.packageName) score += 40;
        if (candidateType.moduleId && callerType.moduleId === candidateType.moduleId) score += 20;
    }

    const callerFile = index.fileByPath.get(callerType?.filePath ?? "");
    if (callerFile && candidateType) {
        for (const imported of callerFile.imports) {
            if (imported.name === candidateType.fqn) score += 60;
            if (imported.wildcard && candidateType.fqn.startsWith(`${imported.name}.`)) score += 30;
            if (imported.alias && imported.alias === call.name) score += 20;
        }
    }

    const qualifier =
        (call.qualifier ?? "")
            .replace(/^this\./, "")
            .split(".")
            .pop() ?? "";
    if (qualifier && candidateType) {
        const qualifierLower = qualifier.toLowerCase();
        const ownerLower = candidateType.name.toLowerCase();
        const normalizedOwner = ownerLower.replace(/impl$/, "");
        if (
            ownerLower === qualifierLower ||
            normalizedOwner === qualifierLower ||
            ownerLower === `${qualifierLower}impl`
        ) {
            score += 80;
        }
    }

    if (candidateType) {
        const kind = index.kindOf(candidateType);
        if (kind === "mapper" || kind === "repository" || kind === "feign") score += 5;
    }
    return score;
};

export { kindOfMethod };
