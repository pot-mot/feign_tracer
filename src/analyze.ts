import { existsSync, statSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import type {
    AnalysisResult,
    AnalysisStats,
    AnalyzeOptions,
    MethodTrace,
    ModuleEdge,
    ModuleInfo,
    ParsedFile,
    TypeInfo,
} from "./model.ts";
import type { DeepReadonly } from "./types.ts";
import { scanProject } from "./scan.ts";
import { buildMavenModules, parsePom } from "./build/maven.ts";
import { buildGradleModules, parseGradleSettings, type GradleSettings } from "./build/gradle.ts";
import { parseJavaFile } from "./languages/java.ts";
import { parseKotlinFile } from "./languages/kotlin.ts";
import { parseGroovyFile } from "./languages/groovy.ts";
import { createProjectIndex, type ProjectIndex } from "./graph/index.ts";
import { buildEndpoints, linkFeignEndpoints } from "./graph/endpoints.ts";
import { buildCallTrees, buildTraceTrees } from "./graph/calls.ts";
import { buildFileAnalyses } from "./graph/files.ts";
import { selectEndpoints } from "./graph/select.ts";
import { buildMethodTraces, filterTracesByKeywords } from "./graph/traces.ts";
import { resolveCalls, type ResolvedCall } from "./graph/resolve.ts";
import { createParseCache } from "./cache.ts";

const TOOL_VERSION = "1.0.0";

/**
 * 默认保留在调用树中的类。其余类（DTO、工具、配置、日志辅助等）
 * 会被剪枝，以保持调用链可读。
 */
export const DEFAULT_CLASS_FILTERS = [
    "Controller$",
    "Client$",
    "Service$",
    "ServiceImpl$",
    "Mapper$",
    "Repo$",
    "Repository$",
] as const;

export const DEFAULT_OPTIONS: Omit<AnalyzeOptions, "root"> = {
    maxDepth: 12,
    includeExternal: false,
    followFeign: true,
    includeSource: true,
    excludeSelfCalls: false,
    classFilters: [...DEFAULT_CLASS_FILTERS],
    keywords: [],
    classNames: [],
    methodNames: [],
    buildTrees: true,
    useCache: true,
    cacheDir: ".feign-tracer-cache",
    maxFiles: 50000,
    ignore: [],
};

export const analyzeDirectory = (
    input: Partial<AnalyzeOptions> & { root: string },
): DeepReadonly<AnalysisResult> => {
    const started = Date.now();
    const root = resolve(input.root);
    if (!existsSync(root) || !statSync(root).isDirectory()) {
        throw new Error(`Not a directory: ${root}`);
    }

    const options: AnalyzeOptions = {
        ...DEFAULT_OPTIONS,
        ...input,
        root,
        classFilters: [...(input.classFilters ?? DEFAULT_CLASS_FILTERS)],
        keywords: [...(input.keywords ?? [])],
        classNames: [...(input.classNames ?? [])],
        methodNames: [...(input.methodNames ?? [])],
        rebuildDir: input.rebuildDir ? resolveRebuildDir(input.rebuildDir, root) : undefined,
        ignore: [...(input.ignore ?? [])],
    };

    const warnings: string[] = [];
    const rebuildDirAbs = options.rebuildDir ? resolve(root, options.rebuildDir) : undefined;
    const cache = createParseCache({
        cacheDir: options.useCache ? options.cacheDir : undefined,
        root,
        rebuildDir: rebuildDirAbs,
    });
    const classFilterRegexes: RegExp[] = [];
    for (const source of options.classFilters) {
        try {
            classFilterRegexes.push(new RegExp(source));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            warnings.push(`Ignoring invalid --class-filter ${JSON.stringify(source)}: ${message}`);
        }
    }

    const scanned = scanProject(root, options);
    if (scanned.truncated) {
        warnings.push(`File scan stopped at --max-files=${options.maxFiles}`);
    }

    const pomFiles = scanned.files.filter((file) => file.kind === "maven");
    const poms = pomFiles
        .map((file) => parsePom(file.absPath, file.relPath))
        .filter((pom): pom is NonNullable<typeof pom> => pom !== undefined);
    const maven = buildMavenModules(poms);
    warnings.push(...maven.errors);

    const settingsFiles = scanned.files.filter((file) => file.kind === "gradle-settings");
    const settingsList = settingsFiles
        .map((file) => parseGradleSettings(file.absPath, file.relPath))
        .filter((settings): settings is GradleSettings => settings !== undefined);

    const gradleBuildFiles = scanned.files
        .filter((file) => file.kind === "gradle")
        .map((file) => ({
            absPath: file.absPath,
            relPath: file.relPath,
            dir: file.relPath.includes("/")
                ? file.relPath.slice(0, file.relPath.lastIndexOf("/"))
                : "",
        }));

    const gradleModules: ModuleInfo[] = [];
    const gradleErrors: string[] = [];
    const groups = new Map<
        string,
        { settings: GradleSettings | undefined; builds: typeof gradleBuildFiles }
    >();
    groups.set("", { settings: undefined, builds: [] });
    for (const settings of settingsList) groups.set(settings.relPath, { settings, builds: [] });

    for (const build of gradleBuildFiles) {
        const settings = nearestSettings(build.dir, settingsList);
        const key = settings?.relPath ?? "";
        const group = groups.get(key) ?? { settings: undefined, builds: [] };
        group.builds.push(build);
        groups.set(key, group);
    }
    for (const settings of settingsList) {
        const group = groups.get(settings.relPath);
        if (!group) continue;
        const result = buildGradleModules(group.builds, settings);
        gradleModules.push(...result.modules);
        gradleErrors.push(...result.errors);
    }
    const noSettingsGroup = groups.get("");
    if (noSettingsGroup && noSettingsGroup.builds.length > 0) {
        const result = buildGradleModules(noSettingsGroup.builds, undefined);
        gradleModules.push(...result.modules);
        gradleErrors.push(...result.errors);
    }
    warnings.push(...gradleErrors);

    let modules = dedupeModules([...maven.modules, ...gradleModules]);
    if (modules.length === 0) {
        modules = [
            {
                id: "(root)",
                name: basename(root) || "root",
                buildTool: "none",
                dir: "",
                dependencies: [],
                modules: [],
                fileCount: 0,
            },
        ];
    }

    // 先完成模块解析再解析源码，使每个文件都能关联到模块。
    const parsedFiles: ParsedFile[] = [];
    const sortedModules = [...modules].sort(
        (left, right) =>
            (right.dir === "." ? 0 : right.dir.length) - (left.dir === "." ? 0 : left.dir.length),
    );
    const assignModule = (relPath: string): ModuleInfo | undefined => {
        for (const module of sortedModules) {
            const dir = module.dir === "." ? "" : module.dir;
            if (dir === "" || relPath.startsWith(`${dir}/`)) return module;
        }
        return undefined;
    };

    for (const file of scanned.files) {
        if (file.kind !== "java" && file.kind !== "kotlin" && file.kind !== "groovy") continue;
        const module = assignModule(file.relPath);
        const cached = cache.load(file.absPath, module?.id);
        if (cached) {
            parsedFiles.push(cached);
            if (module) module.fileCount++;
            continue;
        }
        try {
            const parsed =
                file.kind === "java"
                    ? parseJavaFile(file.absPath, file.relPath, module?.id)
                    : file.kind === "kotlin"
                      ? parseKotlinFile(file.absPath, file.relPath, module?.id)
                      : parseGroovyFile(file.absPath, file.relPath, module?.id);
            parsedFiles.push(parsed);
            cache.save(file.absPath, parsed, module?.id);
            if (module) module.fileCount++;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            warnings.push(`Failed to parse ${file.relPath}: ${message}`);
            parsedFiles.push({
                path: file.relPath,
                absPath: file.absPath,
                language: file.kind,
                moduleId: module?.id,
                packageName: "",
                imports: [],
                types: [],
                parseErrors: 1,
                lineCount: 0,
            });
        }
    }

    const index = createProjectIndex(parsedFiles, modules);
    const endpointResult = buildEndpoints(index);
    linkFeignEndpoints(index, endpointResult.endpoints, endpointResult.feignOperations);

    const selectedEndpoints = options.buildTrees
        ? selectEndpoints(endpointResult.endpoints, {
              keywords: options.keywords,
              classNames: options.classNames,
              methodNames: options.methodNames,
              rebuildDir: options.rebuildDir,
          })
        : [];

    const treeOptions = {
        maxDepth: options.maxDepth,
        includeExternal: options.includeExternal,
        followFeign: options.followFeign,
        excludeSelfCalls: options.excludeSelfCalls,
        classFilters: classFilterRegexes,
    };

    let traces: MethodTrace[] = [];

    if (options.buildTrees) {
        buildCallTrees(
            index,
            selectedEndpoints,
            endpointResult.feignOperations,
            treeOptions,
            endpointResult.endpoints,
        );

        if (options.classNames.length > 0 || options.methodNames.length > 0) {
            const traceResult = buildMethodTraces(
                index,
                { classNames: options.classNames, methodNames: options.methodNames },
                endpointResult.endpoints,
            );
            traces = filterTracesByKeywords(traceResult.traces, options.keywords);
            warnings.push(...traceResult.warnings);
            buildTraceTrees(
                index,
                traces,
                endpointResult.endpoints,
                endpointResult.feignOperations,
                treeOptions,
                endpointResult.endpoints,
            );
        }

        if (
            selectedEndpoints.length === 0 &&
            (options.keywords.length > 0 ||
                options.classNames.length > 0 ||
                options.methodNames.length > 0 ||
                options.rebuildDir)
        ) {
            const criteria = [
                options.keywords.length > 0 ? `keyword(s) ${options.keywords.join(", ")}` : "",
                options.classNames.length > 0 ? `class(es) ${options.classNames.join(", ")}` : "",
                options.methodNames.length > 0 ? `method(s) ${options.methodNames.join(", ")}` : "",
                options.rebuildDir ? `--rebuild-dir ${options.rebuildDir}` : "",
            ]
                .filter(Boolean)
                .join(", ");
            warnings.push(
                traces.length > 0
                    ? `No controller endpoint matched ${criteria}; ${traces.length} method trace(s) were built instead.`
                    : `No controller endpoint matched ${criteria}; no endpoint call trees were built.`,
            );
        }
    } else {
        warnings.push("Call tree building disabled (--no-trees); endpoints were indexed only.");
    }

    const resolveCache = new Map<string, ResolvedCall[]>();
    const files = options.includeSource ? buildFileAnalyses(index, resolveCache) : [];
    const moduleEdges = buildModuleEdges(modules);

    const stats: AnalysisStats = {
        filesScanned: scanned.files.length,
        sourceFiles: parsedFiles.length,
        javaFiles: parsedFiles.filter((file) => file.language === "java").length,
        kotlinFiles: parsedFiles.filter((file) => file.language === "kotlin").length,
        groovyFiles: parsedFiles.filter((file) => file.language === "groovy").length,
        buildFiles: pomFiles.length + gradleBuildFiles.length + settingsFiles.length,
        modules: modules.length,
        types: index.typesByFqn.size,
        methods: [...index.typesByFqn.values()].reduce((sum, type) => sum + type.methods.length, 0),
        calls: parsedFiles.reduce(
            (sum, file) => sum + file.types.reduce((inner, type) => inner + countCalls(type), 0),
            0,
        ),
        resolvedCalls: countResolvedCalls(index),
        endpoints: endpointResult.endpoints.length,
        endpointsBuilt: endpointResult.endpoints.filter((endpoint) => endpoint.treeBuilt).length,
        traces: traces.length,
        tracesBuilt: traces.filter((trace) => trace.treeBuilt).length,
        feignClients: endpointResult.feignClients.length,
        feignOperations: endpointResult.feignOperations.length,
        parseErrors: parsedFiles.reduce((sum, file) => sum + file.parseErrors, 0),
        durationMs: Date.now() - started,
    };

    if (stats.parseErrors > 0) {
        warnings.push(
            `${stats.parseErrors} ANTLR syntax error(s) were recovered; affected files are still analysed.`,
        );
    }
    if (modules.length === 1 && modules[0].buildTool === "none") {
        warnings.push(
            "No pom.xml/build.gradle found; all sources were grouped into a synthetic root module.",
        );
    }

    return {
        meta: {
            root,
            generatedAt: new Date().toISOString(),
            tool: "feign-tracer",
            version: TOOL_VERSION,
            options,
        },
        stats,
        modules,
        moduleEdges,
        endpoints: endpointResult.endpoints,
        traces,
        feignClients: endpointResult.feignClients,
        feignOperations: endpointResult.feignOperations,
        files,
        warnings,
    };
};

const resolveRebuildDir = (value: string, root: string): string => {
    const absolute = resolve(root, value);
    const rel = relative(root, absolute).replace(/\\/g, "/");
    if (rel === "") return ".";
    if (rel === ".." || rel.startsWith("../")) {
        throw new Error(`--rebuild-dir must stay inside the project root: ${value}`);
    }
    return rel.replace(/\/+$/, "");
};

const nearestSettings = (dir: string, settings: GradleSettings[]): GradleSettings | undefined => {
    let best: GradleSettings | undefined;
    for (const candidate of settings) {
        const rootDir = candidate.rootDir;
        if (rootDir === "" || dir === rootDir || dir.startsWith(`${rootDir}/`)) {
            if (!best || rootDir.length > best.rootDir.length) best = candidate;
        }
    }
    return best;
};

const dedupeModules = (modules: ModuleInfo[]): ModuleInfo[] => {
    const seen = new Map<string, number>();
    for (const module of modules) {
        const count = seen.get(module.id) ?? 0;
        if (count > 0) module.id = `${module.id}#${count + 1}`;
        seen.set(module.id, count + 1);
    }
    return modules;
};

const buildModuleEdges = (modules: ModuleInfo[]): ModuleEdge[] => {
    const edges = new Map<string, ModuleEdge>();
    for (const module of modules) {
        for (const dependency of module.dependencies) {
            if (!dependency.to) continue;
            const key = `${module.id}->${dependency.to}`;
            let edge = edges.get(key);
            if (!edge) {
                edge = { from: module.id, to: dependency.to, count: 0, dependencies: [] };
                edges.set(key, edge);
            }
            edge.count++;
            edge.dependencies.push(dependency);
        }
    }
    return [...edges.values()];
};

const countCalls = (type: TypeInfo): number => {
    let total = 0;
    for (const method of type.methods) total += method.calls.length;
    for (const nested of type.nested) total += countCalls(nested);
    return total;
};

const countResolvedCalls = (index: ProjectIndex): number => {
    let total = 0;
    for (const method of index.methodById.values()) {
        for (const resolved of resolveCalls(index, method)) {
            if (resolved.target) total++;
        }
    }
    return total;
};
