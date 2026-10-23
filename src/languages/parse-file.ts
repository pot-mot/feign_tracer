import type { ParsedFile } from "../model.ts";
import type { ParseCache } from "../cache.ts";
import type { SourceScanKind } from "../scan.ts";
import { parseJavaFile } from "./java.ts";
import { parseKotlinFile } from "./kotlin.ts";
import { parseGroovyFile } from "./groovy.ts";

/** 一条待解析的源码任务，主线程与 worker 共用同一结构。 */
export interface ParseTask {
    readonly absPath: string;
    readonly relPath: string;
    readonly kind: SourceScanKind;
    readonly moduleId?: string;
}

/** 单文件解析结果；失败时仍返回占位 ParsedFile，保证后续分析不中断。 */
export interface ParseTaskOutcome {
    readonly parsed: ParsedFile;
    readonly warning?: string;
    readonly cacheHit: boolean;
}

/** 按语言分派到具体提取器；worker 与单线程路径必须共用这里。 */
export const parseSourceFile = (task: ParseTask): ParsedFile => {
    const { absPath, relPath, moduleId } = task;
    switch (task.kind) {
        case "java":
            return parseJavaFile(absPath, relPath, moduleId);
        case "kotlin":
            return parseKotlinFile(absPath, relPath, moduleId);
        case "groovy":
            return parseGroovyFile(absPath, relPath, moduleId);
    }
};

const emptyParsedFile = (task: ParseTask): ParsedFile => ({
    path: task.relPath,
    absPath: task.absPath,
    language: task.kind,
    moduleId: task.moduleId,
    packageName: "",
    imports: [],
    types: [],
    parseErrors: 1,
    lineCount: 0,
});

/**
 * 单文件解析 + 缓存读写。worker 和单线程回退路径都走这里，
 * 从而保证两条路径的命中条件、失败占位和警告文本完全一致。
 */
export const parseTask = (task: ParseTask, cache: ParseCache | undefined): ParseTaskOutcome => {
    const cached = cache?.load(task.absPath, task.moduleId);
    if (cached) return { parsed: cached, cacheHit: true };

    try {
        const parsed = parseSourceFile(task);
        cache?.save(task.absPath, parsed, task.moduleId);
        return { parsed, cacheHit: false };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            parsed: emptyParsedFile(task),
            warning: `Failed to parse ${task.relPath}: ${message}`,
            cacheHit: false,
        };
    }
};

/** 同步回退实现，供小项目、--jobs 1 以及 worker 启动失败时使用。 */
export const parseTasksInline = (
    tasks: readonly ParseTask[],
    cache: ParseCache | undefined,
): ParseTaskOutcome[] => tasks.map((task) => parseTask(task, cache));
