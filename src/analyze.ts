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
} from "./model.ts";
import type { DeepReadonly } from "./types.ts";
import { isSourceKind, scanProject, type ScannedFile } from "./scan.ts";
import { buildMavenModules, parsePom } from "./build/maven.ts";
import { buildGradleModules, parseGradleSettings, type GradleSettings } from "./build/gradle.ts";
import { createProjectIndex, type ProjectIndex } from "./graph/index.ts";
import { buildEndpoints, linkFeignEndpoints } from "./graph/endpoints.ts";
import { buildCallTrees, buildTraceTrees } from "./graph/calls.ts";
import { analyzeFiles } from "./graph/files.ts";
import { selectEndpoints } from "./graph/select.ts";
import { buildMethodTraces, filterTracesByKeywords } from "./graph/traces.ts";
import { resolveCalls } from "./graph/resolve.ts";
import { createParseCache, type ParseCacheOptions } from "./cache.ts";
import { parseTask, type ParseTask, type ParseTaskOutcome } from "./languages/parse-file.ts";
import { parseFilesInPool } from "./parse-pool.ts";
import { createBodyStore, detachBodies, type BodyStore } from "./store/bodies.ts";
import { createTreeSpool, type TreeSpool } from "./store/tree-spool.ts";
import { ensureDatabaseReady } from "./store/sqlite.ts";
import {
    createProjectWriter,
    loadProjectManifest,
    loadReusedProjectFiles,
    type ProjectWriter,
} from "./store/project.ts";

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
    parseWorkers: 0,
    workDb: true,
    maxFiles: 50000,
    ignore: [],
};

export interface AnalyzeAsyncOptions {
    /** 解析进度回调；worker 回退到单线程时不会触发。 */
    readonly onProgress?: (completed: number, total: number) => void;
    /**
     * 调用树暂存文件路径。提供后每棵调用树展开完成即写入该文件并从内存释放，
     * 常驻内存只与「当前正在展开的根」有关；调用方需要在写库时把它交给
     * `writeAnalysisToSqlite` 的 `treeSpool` 选项。
     */
    readonly treeSpoolPath?: string;
    /**
     * 项目索引持久化数据库。提供后优先按 `projects.base_dir` 复用已解析文件，
     * 只对新增/修改/删除的文件更新数据库中的项目索引。
     */
    readonly projectDbPath?: string;
}

interface GradleBuildFile {
    readonly absPath: string;
    readonly relPath: string;
    readonly dir: string;
}

/**
 * 扫描、模块解析与解析任务准备。所有共享可变状态（模块 fileCount）
 * 都只在这里之后由主线程统一写入，确保并行解析结果与单线程一致。
 */
interface PreparedAnalysis {
    readonly started: number;
    readonly root: string;
    readonly options: AnalyzeOptions;
    readonly warnings: string[];
    readonly scanned: ReturnType<typeof scanProject>;
    readonly pomFiles: ScannedFile[];
    readonly settingsFiles: ScannedFile[];
    readonly gradleBuildFiles: GradleBuildFile[];
    readonly modules: ModuleInfo[];
    readonly tasks: ParseTask[];
    readonly taskModules: Array<ModuleInfo | undefined>;
    readonly cacheOptions: ParseCacheOptions | undefined;
}

/**
 * 可复用的项目分析基座。
 *
 * 它只包含与「选择哪些调用树」无关的部分：扫描得到的模块、解析后的符号索引、
 * 文件依赖与底层解析警告。调用树选项（关键词、深度、类名过滤等）在
 * `finalizeAnalysis` 中应用，因此同一份基座可以服务多次增量构建。
 */
interface AnalysisBase {
    readonly prepared: PreparedAnalysis;
    readonly parsedFiles: ParsedFile[];
    readonly index: ProjectIndex;
    readonly files: AnalysisResult["files"];
    readonly calls: number;
    readonly resolvedCalls: number;
    readonly warnings: string[];
}

/** 每落库这么多方法体提交一次事务，避免回滚日志和页缓存无限增长。 */
const BODY_FLUSH_METHODS = 2000;

/**
 * 解析阶段的累加器。
 *
 * 结果按任务下标存放而不是追加，因此 worker 的完成顺序不影响最终输出；
 * 每个文件在这里完成「剥离方法体 → 计入统计」，之后除了轻量符号信息
 * 之外不会再有别的对象被保留。
 */
interface ParseAccumulator {
    readonly fileSlots: Array<ParsedFile | undefined>;
    readonly warningSlots: Array<string | undefined>;
    calls: number;
    pendingWrites: number;
}

export const analyzeDirectory = (
    input: Partial<AnalyzeOptions> & { root: string },
): DeepReadonly<AnalysisResult> => {
    const prepared = prepareAnalysis(input);
    const store = prepared.options.workDb ? createBodyStore() : undefined;
    try {
        const accumulator = createAccumulator(prepared);
        const cache = prepared.cacheOptions ? createParseCache(prepared.cacheOptions) : undefined;
        for (let index = 0; index < prepared.tasks.length; index++) {
            const outcome = parseTask(prepared.tasks[index], cache);
            acceptOutcome(prepared, accumulator, store, index, outcome);
        }
        const base = createAnalysisBase(
            prepared,
            accumulator,
            store,
            prepared.options.includeSource,
            accumulator.calls,
        );
        return finalizeAnalysis(base, prepared.options, prepared.started, undefined);
    } finally {
        store?.close();
    }
};

/**
 * 并行解析版本：按 CPU 核数启动 worker，解析完成后复用同一套图分析流程。
 * 单线程版本 `analyzeDirectory` 保留给需要同步结果的调用方。
 */
export const analyzeDirectoryAsync = async (
    input: Partial<AnalyzeOptions> & { root: string },
    asyncOptions: AnalyzeAsyncOptions = {},
): Promise<DeepReadonly<AnalysisResult>> => {
    if (asyncOptions.projectDbPath) ensureDatabaseReady(asyncOptions.projectDbPath);
    const prepared = prepareAnalysis(input);
    const store = prepared.options.workDb ? createBodyStore() : undefined;
    let writer: ProjectWriter | undefined;
    try {
        const plan = planProjectReuse(
            prepared,
            asyncOptions.projectDbPath,
            input.forceReparse === true,
        );
        const accumulator = createAccumulator(prepared);

        // 复用文件与本次解析文件走同一条接收路径，保证统计口径一致。
        for (let index = 0; index < prepared.tasks.length; index++) {
            const parsed = plan.reused.get(prepared.tasks[index].relPath);
            if (!parsed) continue;
            acceptOutcome(prepared, accumulator, store, index, { parsed, cacheHit: true });
        }

        if (
            asyncOptions.projectDbPath &&
            (plan.tasksToParse.length > 0 || plan.removed.length > 0)
        ) {
            writer = createProjectWriter(asyncOptions.projectDbPath, prepared.root);
            writer.removeFiles(plan.removed);
        }

        if (plan.tasksToParse.length > 0) {
            const poolResult = await parseFilesInPool(plan.tasksToParse, {
                ...(prepared.cacheOptions ?? { root: prepared.root }),
                jobs: prepared.options.parseWorkers,
                onProgress: asyncOptions.onProgress,
                onFile: (subsetIndex, outcome) => {
                    const taskIndex = plan.taskIndexes[subsetIndex];
                    writer?.saveFile(prepared.tasks[taskIndex], outcome.parsed);
                    acceptOutcome(prepared, accumulator, store, taskIndex, outcome);
                },
            });
            prepared.warnings.push(...poolResult.warnings);
        }

        const base = createAnalysisBase(
            prepared,
            accumulator,
            store,
            prepared.options.includeSource,
            accumulator.calls,
        );

        if (writer) {
            // 调用边需要完整索引才能解析；只更新本次写入文件对应的行。
            writer.updateCallees((methodKey) => {
                const method = base.index.methodById.get(methodKey);
                if (!method) return [];
                return resolveCalls(base.index, method).map((entry) => entry.target?.id);
            });
            writer.close();
            writer = undefined;
        }

        return finalizeAnalysis(
            base,
            prepared.options,
            prepared.started,
            asyncOptions.treeSpoolPath,
        );
    } finally {
        writer?.abort();
        store?.close();
    }
};

interface ProjectReusePlan {
    readonly reused: ReadonlyMap<string, ParsedFile>;
    readonly tasksToParse: readonly ParseTask[];
    readonly taskIndexes: readonly number[];
    readonly removed: readonly string[];
}

/**
 * 根据项目索引数据库规划本次需要解析的文件。
 *
 * 匹配键是文件相对路径 + mtime + size + 模块归属；命中时直接复用
 * project_files.parsed_json 中的解析结果。删除的文件会从索引中移除，
 * 新增或修改的文件进入解析队列。
 */
const planProjectReuse = (
    prepared: PreparedAnalysis,
    dbPath: string | undefined,
    forceReparse: boolean,
): ProjectReusePlan => {
    const sourcePaths = new Set(prepared.tasks.map((task) => task.relPath));
    const manifest = dbPath ? loadProjectManifest(dbPath, prepared.root) : undefined;
    const removed = manifest
        ? [...manifest.files.keys()].filter((path) => !sourcePaths.has(path))
        : [];

    if (!dbPath || !manifest || forceReparse) {
        return {
            reused: new Map(),
            tasksToParse: prepared.tasks,
            taskIndexes: prepared.tasks.map((_task, index) => index),
            removed,
        };
    }

    const rebuildDir = prepared.options.rebuildDir;
    const mustReparse = (relPath: string): boolean =>
        rebuildDir !== undefined &&
        (rebuildDir === "." || relPath === rebuildDir || relPath.startsWith(`${rebuildDir}/`));

    const candidates = new Set<string>();
    for (const task of prepared.tasks) {
        if (mustReparse(task.relPath)) continue;
        const stored = manifest.files.get(task.relPath);
        if (!stored) continue;
        if (stored.language !== task.kind) continue;
        if ((stored.moduleId ?? "") !== (task.moduleId ?? "")) continue;
        // Date 精度只到毫秒，NTFS 的 mtime 可能更细；允许 1ms 内的误差。
        const mtimeMatches =
            task.mtimeMs !== undefined && Math.abs(stored.mtimeMs - task.mtimeMs) < 1;
        if (!mtimeMatches || stored.size !== (task.bytes ?? -1)) {
            continue;
        }
        candidates.add(task.relPath);
    }

    const loaded = loadReusedProjectFiles(dbPath, manifest.projectId, candidates);
    const reused = new Map<string, ParsedFile>();
    const tasksToParse: ParseTask[] = [];
    const taskIndexes: number[] = [];
    for (let index = 0; index < prepared.tasks.length; index++) {
        const task = prepared.tasks[index];
        const parsed = loaded.get(task.relPath);
        if (parsed) {
            // 模块归属已在上面比对过，这里以当前任务的值为准。
            parsed.moduleId = task.moduleId;
            reused.set(task.relPath, parsed);
            continue;
        }
        tasksToParse.push(task);
        taskIndexes.push(index);
    }

    return { reused, tasksToParse, taskIndexes, removed };
};

const createAccumulator = (prepared: PreparedAnalysis): ParseAccumulator => {
    const fileSlots = new Array<ParsedFile | undefined>(prepared.tasks.length);
    const warningSlots = new Array<string | undefined>(prepared.tasks.length);
    return { fileSlots, warningSlots, calls: 0, pendingWrites: 0 };
};

/** 用已解析文件构建符号索引、文件依赖与警告快照。 */
const buildAnalysisBase = (
    prepared: PreparedAnalysis,
    parsedFiles: ParsedFile[],
    store: BodyStore | undefined,
    includeSource: boolean,
    calls: number | undefined,
    warnings: string[],
): AnalysisBase => {
    const index = createProjectIndex(parsedFiles, prepared.modules, store);
    const fileResult = analyzeFiles(index, includeSource);
    return {
        prepared,
        parsedFiles,
        index,
        files: fileResult.files,
        // 初始构建沿用解析阶段统计；目录重建时直接取依赖遍历的全量计数。
        calls: calls ?? fileResult.totalCalls,
        resolvedCalls: fileResult.resolvedCalls,
        warnings,
    };
};

const createAnalysisBase = (
    prepared: PreparedAnalysis,
    accumulator: ParseAccumulator,
    store: BodyStore | undefined,
    includeSource: boolean,
    calls: number,
): AnalysisBase => {
    // `collectParsedFiles` 会把解析警告并入 prepared.warnings，快照必须在它之后取。
    const parsedFiles = collectParsedFiles(prepared, accumulator);
    return buildAnalysisBase(prepared, parsedFiles, store, includeSource, calls, [
        ...prepared.warnings,
    ]);
};

/**
 * 接收单个文件的解析结果：统计、剥离方法体、按需提交工作库。
 * 同一个下标重复交付会被忽略，避免模块文件数或统计口径被重复累加。
 */
const acceptOutcome = (
    prepared: PreparedAnalysis,
    accumulator: ParseAccumulator,
    store: BodyStore | undefined,
    index: number,
    outcome: ParseTaskOutcome,
): void => {
    if (accumulator.fileSlots[index] !== undefined) return;
    accumulator.fileSlots[index] = outcome.parsed;
    if (outcome.warning) accumulator.warningSlots[index] = outcome.warning;

    // 方法体转存到工作库，并立刻从内存结构中移除。
    const distilled = detachBodies(store, outcome.parsed);
    accumulator.calls += distilled.calls;
    accumulator.pendingWrites += distilled.methods;
    if (store && accumulator.pendingWrites >= BODY_FLUSH_METHODS) {
        store.flush();
        accumulator.pendingWrites = 0;
    }

    // 模块文件数只在没有解析警告时累加，与原先的合并顺序保持一致。
    if (!outcome.warning) {
        const module = prepared.taskModules[index];
        if (module) module.fileCount++;
    }
};

/**
 * 文件可能在扫描后、解析前被删除或改名；大小只用于内存调度，
 * 读不到时退回 undefined，让 worker 使用默认估算值。
 */
const fileStat = (
    absPath: string,
): { readonly size: number; readonly mtimeMs: number } | undefined => {
    try {
        const stat = statSync(absPath);
        return { size: stat.size, mtimeMs: stat.mtimeMs };
    } catch {
        return undefined;
    }
};

/** 统一归一化调用方输入；会话缓存与完整分析必须使用同一套默认值。 */
const resolveAnalyzeOptions = (
    input: Partial<AnalyzeOptions> & { root: string },
    root: string,
): AnalyzeOptions => {
    return {
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
};

const prepareAnalysis = (input: Partial<AnalyzeOptions> & { root: string }): PreparedAnalysis => {
    const started = Date.now();
    const root = resolve(input.root);
    if (!existsSync(root) || !statSync(root).isDirectory()) {
        throw new Error(`Not a directory: ${root}`);
    }

    const options = resolveAnalyzeOptions(input, root);
    const warnings: string[] = [];
    const rebuildDirAbs = options.rebuildDir ? resolve(root, options.rebuildDir) : undefined;

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

    const gradleBuildFiles: GradleBuildFile[] = scanned.files
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
        { settings: GradleSettings | undefined; builds: GradleBuildFile[] }
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

    // 先完成模块解析再生成解析任务，使每个文件都能关联到模块。
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

    const tasks: ParseTask[] = [];
    const taskModules: Array<ModuleInfo | undefined> = [];
    for (const file of scanned.files) {
        if (!isSourceKind(file.kind)) continue;
        const module = assignModule(file.relPath);
        const stat = fileStat(file.absPath);
        tasks.push({
            absPath: file.absPath,
            relPath: file.relPath,
            kind: file.kind,
            moduleId: module?.id,
            bytes: stat?.size,
            mtimeMs: stat?.mtimeMs,
        });
        taskModules.push(module);
    }

    return {
        started,
        root,
        options,
        warnings,
        scanned,
        pomFiles,
        settingsFiles,
        gradleBuildFiles,
        modules,
        tasks,
        taskModules,
        cacheOptions: options.useCache
            ? {
                  cacheDir: options.cacheDir,
                  root,
                  // 强制重扫描时把整个根目录视为待重建目录，从而绕过所有缓存条目。
                  rebuildDir: input.forceReparse ? root : rebuildDirAbs,
              }
            : undefined,
    };
};

/**
 * 按任务顺序收集解析结果，并统一输出警告。
 * 模块文件数在 `acceptOutcome` 中已累加，这里只负责排序与错误检查。
 */
const collectParsedFiles = (
    prepared: PreparedAnalysis,
    accumulator: ParseAccumulator,
): ParsedFile[] => {
    const parsedFiles: ParsedFile[] = [];
    for (let index = 0; index < accumulator.fileSlots.length; index++) {
        const file = accumulator.fileSlots[index];
        if (!file) {
            throw new Error(`Parsing did not finish for ${prepared.tasks[index].relPath}`);
        }
        const warning = accumulator.warningSlots[index];
        if (warning) prepared.warnings.push(warning);
        parsedFiles.push(file);
    }
    return parsedFiles;
};

/**
 * 在可复用基座上应用本次选择并展开调用树。
 *
 * 基座本身不保存任何调用树，所以同一个项目可以在关键词变化时反复进入这里，
 * 而不需要重新扫描、解析或重建索引。
 */
const finalizeAnalysis = (
    base: AnalysisBase,
    options: AnalyzeOptions,
    started: number,
    treeSpoolPath: string | undefined,
): DeepReadonly<AnalysisResult> => {
    const { prepared } = base;
    const {
        root,
        warnings: baseWarnings,
        scanned,
        pomFiles,
        settingsFiles,
        gradleBuildFiles,
        modules,
    } = prepared;
    // 每次调用都复制警告，避免某次增量构建的错误提示污染后续结果。
    const warnings = [...baseWarnings];

    // 类名过滤只影响本次调用树，不能缓存：用户可能在两次分析之间修改过滤正则。
    const classFilterRegexes: RegExp[] = [];
    for (const source of options.classFilters) {
        try {
            classFilterRegexes.push(new RegExp(source));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            warnings.push(`Ignoring invalid --class-filter ${JSON.stringify(source)}: ${message}`);
        }
    }

    const endpointResult = buildEndpoints(base.index);
    linkFeignEndpoints(base.index, endpointResult.endpoints, endpointResult.feignOperations);

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
    /*
     * 只有需要 SQLite 输出时才把调用树外写到暂存文件：JSON 输出必须内联整棵树，
     * 因此那条路径仍然保留在内存里（并在 CLI 侧给出对应提示）。
     */
    const treeSpool: TreeSpool | undefined =
        treeSpoolPath && options.buildTrees ? createTreeSpool(treeSpoolPath) : undefined;

    try {
        if (options.buildTrees) {
            buildCallTrees(
                base.index,
                selectedEndpoints,
                endpointResult.feignOperations,
                treeOptions,
                endpointResult.endpoints,
                treeSpool?.sink,
            );

            if (options.classNames.length > 0 || options.methodNames.length > 0) {
                const traceResult = buildMethodTraces(
                    base.index,
                    { classNames: options.classNames, methodNames: options.methodNames },
                    endpointResult.endpoints,
                );
                traces = filterTracesByKeywords(traceResult.traces, options.keywords);
                warnings.push(...traceResult.warnings);
                buildTraceTrees(
                    base.index,
                    traces,
                    endpointResult.endpoints,
                    endpointResult.feignOperations,
                    treeOptions,
                    endpointResult.endpoints,
                    treeSpool?.sink,
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
                    options.classNames.length > 0
                        ? `class(es) ${options.classNames.join(", ")}`
                        : "",
                    options.methodNames.length > 0
                        ? `method(s) ${options.methodNames.join(", ")}`
                        : "",
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
    } finally {
        // 暂存文件在写入数据库之前必须完整落盘。
        treeSpool?.close();
    }

    const files = options.includeSource ? base.files : [];
    const moduleEdges = buildModuleEdges(modules);

    const stats: AnalysisStats = {
        filesScanned: scanned.files.length,
        sourceFiles: base.parsedFiles.length,
        javaFiles: base.parsedFiles.filter((file) => file.language === "java").length,
        kotlinFiles: base.parsedFiles.filter((file) => file.language === "kotlin").length,
        groovyFiles: base.parsedFiles.filter((file) => file.language === "groovy").length,
        buildFiles: pomFiles.length + gradleBuildFiles.length + settingsFiles.length,
        modules: modules.length,
        types: base.index.typesByFqn.size,
        methods: [...base.index.typesByFqn.values()].reduce(
            (sum, type) => sum + type.methods.length,
            0,
        ),
        calls: base.calls,
        resolvedCalls: base.resolvedCalls,
        endpoints: endpointResult.endpoints.length,
        endpointsBuilt: endpointResult.endpoints.filter((endpoint) => endpoint.treeBuilt).length,
        traces: traces.length,
        tracesBuilt: traces.filter((trace) => trace.treeBuilt).length,
        feignClients: endpointResult.feignClients.length,
        feignOperations: endpointResult.feignOperations.length,
        parseErrors: base.parsedFiles.reduce((sum, file) => sum + file.parseErrors, 0),
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
