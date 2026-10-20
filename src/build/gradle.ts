import { readFileSync } from "node:fs";
import type { ModuleDependency, ModuleInfo } from "../model.ts";
import { directoryOf } from "../scan.ts";

export interface GradleSettings {
    relPath: string;
    rootDir: string;
    rootProjectName?: string;
    includes: Map<string, string>;
    errors: string[];
}

export const parseGradleSettings = (
    absPath: string,
    relPath: string,
): GradleSettings | undefined => {
    let source: string;
    try {
        source = readFileSync(absPath, "utf8");
    } catch {
        return undefined;
    }
    const errors: string[] = [];
    const includes = new Map<string, string>();

    const rootNameMatch = source.match(/rootProject\s*\.\s*name\s*=\s*["']([^"']+)["']/);
    const rootProjectName = rootNameMatch?.[1];

    const includeCalls = [
        ...source.matchAll(/\binclude\s*\(([\s\S]*?)\)/g),
        ...source.matchAll(/\binclude\s+([^\n;]+)/g),
    ];
    for (const match of includeCalls) {
        for (const quoted of match[1].matchAll(/["']([^"']+)["']/g)) {
            const projectPath = normalizeProjectPath(quoted[1]);
            if (projectPath) includes.set(projectPath, projectPath.slice(1).replace(/:/g, "/"));
        }
    }

    for (const match of source.matchAll(
        /project\s*\(\s*["'](:[^"']+)["']\s*\)\s*\.\s*projectDir\s*=\s*file\s*\(\s*["']([^"']+)["']\s*\)/g,
    )) {
        const projectPath = normalizeProjectPath(match[1]);
        const dir = match[2].replace(/^\.\//, "").replace(/\\/g, "/").replace(/\/+$/, "");
        if (projectPath) includes.set(projectPath, dir);
    }

    return {
        relPath,
        rootDir: directoryOf(relPath),
        rootProjectName,
        includes,
        errors,
    };
};

const normalizeProjectPath = (value: string): string => {
    let path = value.trim();
    if (!path) return "";
    if (!path.startsWith(":")) path = `:${path}`;
    path = path.replace(/:+/g, ":");
    if (path.length > 1 && path.endsWith(":")) path = path.slice(0, -1);
    return path;
};

export interface GradleBuildFile {
    absPath: string;
    relPath: string;
    dir: string;
}

export const buildGradleModules = (
    builds: GradleBuildFile[],
    settings: GradleSettings | undefined,
): { modules: ModuleInfo[]; errors: string[] } => {
    const errors: string[] = [];
    const byDir = new Map<string, string>();
    if (settings) {
        for (const [projectPath, dir] of settings.includes) byDir.set(dir, projectPath);
    }

    const modules = new Map<string, ModuleInfo>();

    if (settings) {
        for (const [projectPath, dir] of settings.includes) {
            const name =
                projectPath.split(":").filter(Boolean).pop() ?? settings.rootProjectName ?? "root";
            modules.set(projectPath, {
                id: projectPath,
                name,
                buildTool: "gradle",
                dir,
                dependencies: [],
                modules: [],
                fileCount: 0,
            });
        }

        if (!modules.has(":")) {
            modules.set(":", {
                id: ":",
                name: settings.rootProjectName ?? "root",
                buildTool: "gradle",
                dir: settings.rootDir,
                dependencies: [],
                modules: [],
                fileCount: 0,
            });
        }
    }

    for (const build of builds) {
        let projectPath = byDir.get(build.dir);
        if (!projectPath) {
            projectPath =
                build.dir === (settings?.rootDir ?? "")
                    ? ":"
                    : `:${build.dir.split("/").filter(Boolean).join(":")}`;
        }
        if (!modules.has(projectPath)) {
            modules.set(projectPath, {
                id: projectPath,
                name:
                    projectPath === ":"
                        ? (settings?.rootProjectName ?? "root")
                        : (projectPath.split(":").filter(Boolean).pop() ?? "module"),
                buildTool: "gradle",
                dir: build.dir,
                dependencies: [],
                modules: [],
                fileCount: 0,
            });
        }
        const module = modules.get(projectPath);
        if (!module) continue;
        module.buildFile = build.relPath;
        module.dependencies = parseGradleDependencies(build.absPath, errors);
    }

    // 根据 settings 的 include 补全聚合关系。
    for (const [projectPath, module] of modules) {
        const parentPath =
            projectPath === ":" ? undefined : projectPath.slice(0, projectPath.lastIndexOf(":"));
        if (parentPath !== undefined) {
            const parent = modules.get(parentPath || ":");
            if (parent) {
                parent.modules ??= [];
                parent.modules.push(projectPath);
            } else {
                module.parentId = undefined;
            }
        }
    }
    for (const module of modules.values()) {
        if (module.parentId === undefined) {
            const parentPath =
                module.id === ":" ? undefined : module.id.slice(0, module.id.lastIndexOf(":"));
            if (parentPath !== undefined && modules.has(parentPath || ":")) {
                module.parentId = parentPath || ":";
            }
        }
    }

    return { modules: [...modules.values()], errors };
};

const parseGradleDependencies = (absPath: string, errors: string[]): ModuleDependency[] => {
    let source: string;
    try {
        source = readFileSync(absPath, "utf8");
    } catch {
        errors.push(`Unable to read Gradle build file ${absPath}`);
        return [];
    }

    const text = stripComments(source);
    const result: ModuleDependency[] = [];

    for (const block of dependencyBlocks(text)) {
        const projectPattern =
            /(\w+)\s*(?:\(\s*)?(?:platform\s*\(\s*)?project\s*\(\s*(?:path\s*[:=]\s*)?["']([^"']+)["']/g;
        for (const match of block.matchAll(projectPattern)) {
            const configuration = match[1];
            const projectPath = normalizeProjectPath(match[2]);
            result.push({
                to: projectPath,
                configuration,
                external: false,
                raw: `project(${projectPath})`,
            });
        }

        const coordinatePattern =
            /(\w+)\s*(?:\(\s*)?(?:platform\s*\(\s*)?["']([\w.-]+):([\w.$-]+)(?::([^"']+))?["']/g;
        for (const match of block.matchAll(coordinatePattern)) {
            const configuration = match[1];
            if (["id", "version", "kotlin", "apply"].includes(configuration)) continue;
            result.push({
                groupId: match[2],
                artifactId: match[3],
                version: match[4],
                configuration,
                external: true,
                raw: `${match[2]}:${match[3]}${match[4] ? `:${match[4]}` : ""}`,
            });
        }

        const mapPattern =
            /(\w+)\s*(?:\(\s*)?group\s*[:=]\s*["']([^"']+)["']\s*,\s*name\s*[:=]\s*["']([^"']+)["'](?:[^)]*?version\s*[:=]\s*["']([^"']+)["'])?/g;
        for (const match of block.matchAll(mapPattern)) {
            result.push({
                groupId: match[2],
                artifactId: match[3],
                version: match[4],
                configuration: match[1],
                external: true,
                raw: `${match[2]}:${match[3]}${match[4] ? `:${match[4]}` : ""}`,
            });
        }
    }

    const seen = new Set<string>();
    return result.filter((dependency) => {
        const key = `${dependency.configuration}:${dependency.to ?? ""}:${dependency.groupId ?? ""}:${dependency.artifactId ?? ""}:${dependency.version ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const stripComments = (source: string): string => {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
};

/** 返回每个顶层 dependencies { ... } 块的内容。 */
const dependencyBlocks = (source: string): string[] => {
    const blocks: string[] = [];
    const pattern = /\bdependencies\s*\{/g;
    while (pattern.exec(source)) {
        const start = pattern.lastIndex;
        let depth = 1;
        let index = start;
        while (index < source.length && depth > 0) {
            const ch = source[index];
            if (ch === "{") depth++;
            else if (ch === "}") depth--;
            index++;
        }
        blocks.push(source.slice(start, index - 1));
        pattern.lastIndex = index;
    }
    return blocks;
};
