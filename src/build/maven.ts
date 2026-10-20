import { readFileSync } from "node:fs";
import { posix } from "node:path";
import type { ModuleDependency, ModuleInfo } from "../model.ts";
import { xmlChild, xmlChildren, xmlText, parseXml } from "./xml.ts";
import { directoryOf } from "../scan.ts";

export interface RawPomDependency {
    groupId?: string;
    artifactId?: string;
    version?: string;
    scope?: string;
    optional?: boolean;
    type?: string;
    classifier?: string;
}

export interface PomInfo {
    relPath: string;
    dir: string;
    groupId?: string;
    artifactId?: string;
    version?: string;
    packaging?: string;
    parentGav?: { groupId?: string; artifactId?: string; version?: string; relativePath?: string };
    properties: Record<string, string>;
    modulePaths: string[];
    dependencies: RawPomDependency[];
    parseErrors: number;
}

export const parsePom = (absPath: string, relPath: string): PomInfo | undefined => {
    let source: string;
    try {
        source = readFileSync(absPath, "utf8");
    } catch {
        return undefined;
    }
    const { root, errors } = parseXml(source);
    if (!root) return undefined;
    const project = root.name === "project" ? root : xmlChild(root, "project");
    if (!project) return undefined;

    const parent = xmlChild(project, "parent");
    const properties: Record<string, string> = {};
    const propertiesNode = xmlChild(project, "properties");
    if (propertiesNode) {
        for (const property of propertiesNode.children) {
            properties[property.name] = property.text;
        }
    }

    const dependencies: RawPomDependency[] = [];
    const dependenciesNode = xmlChild(project, "dependencies");
    if (dependenciesNode) {
        for (const dependency of xmlChildren(dependenciesNode, "dependency")) {
            dependencies.push({
                groupId: xmlText(dependency, "groupId"),
                artifactId: xmlText(dependency, "artifactId"),
                version: xmlText(dependency, "version"),
                scope: xmlText(dependency, "scope"),
                optional: xmlText(dependency, "optional") === "true",
                type: xmlText(dependency, "type"),
                classifier: xmlText(dependency, "classifier"),
            });
        }
    }

    return {
        relPath,
        dir: directoryOf(relPath),
        groupId: xmlText(project, "groupId"),
        artifactId: xmlText(project, "artifactId"),
        version: xmlText(project, "version"),
        packaging: xmlText(project, "packaging"),
        parentGav: parent
            ? {
                  groupId: xmlText(parent, "groupId"),
                  artifactId: xmlText(parent, "artifactId"),
                  version: xmlText(parent, "version"),
                  relativePath: xmlText(parent, "relativePath"),
              }
            : undefined,
        properties,
        modulePaths: xmlChildren(xmlChild(project, "modules"), "module")
            .map((node) => node.text)
            .filter(Boolean),
        dependencies,
        parseErrors: errors.length,
    };
};

interface EffectivePom {
    pom: PomInfo;
    groupId?: string;
    artifactId?: string;
    version?: string;
    properties: Record<string, string>;
    parent?: EffectivePom;
}

export const buildMavenModules = (
    poms: PomInfo[],
): {
    modules: ModuleInfo[];
    byCoordinate: Map<string, string>;
    errors: string[];
} => {
    const errors: string[] = [];
    const byDir = new Map(poms.map((pom) => [pom.dir, pom]));
    const byGav = new Map<string, PomInfo>();
    for (const pom of poms) {
        if (pom.groupId && pom.artifactId) {
            byGav.set(`${pom.groupId}:${pom.artifactId}`, pom);
        }
    }

    // 查找父工程；找不到时回退到 Maven 约定的 ../pom.xml。
    const parents = new Map<PomInfo, PomInfo>();
    for (const pom of poms) {
        const gav = pom.parentGav;
        if (!gav) continue;
        const relative = gav.relativePath ?? "../pom.xml";
        const parentDir =
            relative === "" || relative === "."
                ? pom.dir
                : posix.normalize(posix.join(pom.dir || ".", posix.dirname(relative)));
        const normalizedParentDir = parentDir === "." ? "" : parentDir;
        const candidate =
            (gav.groupId && gav.artifactId
                ? byGav.get(`${gav.groupId}:${gav.artifactId}`)
                : undefined) ?? byDir.get(normalizedParentDir);
        if (candidate && candidate !== pom) parents.set(pom, candidate);
    }

    const effectiveCache = new Map<PomInfo, EffectivePom>();
    const effective = (pom: PomInfo, stack = new Set<PomInfo>()): EffectivePom => {
        const cached = effectiveCache.get(pom);
        if (cached) return cached;
        if (stack.has(pom)) {
            errors.push(`Maven parent cycle at ${pom.relPath}`);
            const fallback: EffectivePom = { pom, ...pom, properties: { ...pom.properties } };
            effectiveCache.set(pom, fallback);
            return fallback;
        }
        stack.add(pom);
        const parentPom = parents.get(pom);
        const parent = parentPom ? effective(parentPom, stack) : undefined;
        const mergedProperties: Record<string, string> = {
            ...(parent?.properties ?? {}),
            ...pom.properties,
        };
        const result: EffectivePom = {
            pom,
            groupId: pom.groupId ?? parent?.groupId,
            artifactId: pom.artifactId,
            version: pom.version ?? parent?.version,
            properties: mergedProperties,
            parent,
        };
        effectiveCache.set(pom, result);
        return result;
    };

    const allEffective = poms.map((pom) => effective(pom));

    // 分配稳定且可读的 id；artifactId 唯一时优先使用它。
    const idCounts = new Map<string, number>();
    for (const info of allEffective)
        idCounts.set(info.artifactId ?? "", (idCounts.get(info.artifactId ?? "") ?? 0) + 1);
    const idByPom = new Map<PomInfo, string>();
    for (const info of allEffective) {
        const artifact = info.artifactId || info.pom.dir || "module";
        const id =
            (idCounts.get(info.artifactId ?? "") ?? 0) > 1
                ? `${artifact}@${info.pom.dir || "."}`
                : artifact;
        idByPom.set(info.pom, id);
    }

    const byCoordinate = new Map<string, string>();
    for (const info of allEffective) {
        const groupId = interpolate(info.groupId, info);
        const artifactId = interpolate(info.artifactId, info);
        const id = idByPom.get(info.pom);
        if (groupId && artifactId && id) byCoordinate.set(`${groupId}:${artifactId}`, id);
    }

    const modules: ModuleInfo[] = allEffective.map((info) => {
        const id = idByPom.get(info.pom) ?? info.artifactId ?? info.pom.dir ?? "module";
        const dependencies: ModuleDependency[] = info.pom.dependencies.map((dependency) => {
            const groupId = interpolate(dependency.groupId, info);
            const artifactId = interpolate(dependency.artifactId, info);
            const version = interpolate(dependency.version, info);
            const internalId =
                groupId && artifactId ? byCoordinate.get(`${groupId}:${artifactId}`) : undefined;
            return {
                to: internalId,
                groupId,
                artifactId,
                version,
                scope: dependency.scope ?? "compile",
                optional: dependency.optional,
                external: !internalId,
                raw: [groupId, artifactId, version].filter(Boolean).join(":"),
            };
        });

        const childModules: string[] = [];
        for (const modulePath of info.pom.modulePaths) {
            const dir = posix.normalize(posix.join(info.pom.dir || ".", modulePath));
            const child = byDir.get(dir === "." ? "" : dir);
            const childId = child ? idByPom.get(child) : undefined;
            if (childId) childModules.push(childId);
            else
                errors.push(
                    `Maven module ${modulePath} referenced from ${info.pom.relPath} was not found`,
                );
        }

        return {
            id,
            name: info.artifactId || id,
            buildTool: "maven",
            dir: info.pom.dir,
            buildFile: info.pom.relPath,
            parentId: info.parent ? idByPom.get(info.parent.pom) : undefined,
            groupId: interpolate(info.groupId, info),
            artifactId: interpolate(info.artifactId, info),
            version: interpolate(info.version, info),
            dependencies,
            modules: childModules,
            fileCount: 0,
        };
    });

    return { modules, byCoordinate, errors };
};

const interpolate = (value: string | undefined, info: EffectivePom): string | undefined => {
    if (value === undefined) return undefined;
    const parent = info.parent;
    const variables: Record<string, string | undefined> = {
        ...info.properties,
        "project.groupId": info.groupId,
        "pom.groupId": info.groupId,
        "project.artifactId": info.artifactId,
        "pom.artifactId": info.artifactId,
        "project.version": info.version,
        "pom.version": info.version,
        "project.parent.version": parent?.version,
        "parent.version": parent?.version,
        "project.parent.groupId": parent?.groupId,
        revision: info.properties["revision"] ?? info.version,
        sha1: info.properties["sha1"],
        changelist: info.properties["changelist"],
    };

    let result = value;
    for (let round = 0; round < 8; round++) {
        const next = result.replace(/\$\{([^}]+)\}/g, (match, key: string) => {
            const replacement = variables[key.trim()];
            return replacement !== undefined ? replacement : match;
        });
        if (next === result) break;
        result = next;
    }
    return result;
};
