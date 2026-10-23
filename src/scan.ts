import { readdirSync, statSync, type Dirent } from "node:fs";
import { join, relative, sep } from "node:path";

export type ScanKind =
    "java" | "kotlin" | "groovy" | "maven" | "gradle" | "gradle-settings" | "gradle-other";

/** 需要交给语言解析器的文件类型。 */
export type SourceScanKind = Extract<ScanKind, "java" | "kotlin" | "groovy">;

export const isSourceKind = (kind: ScanKind): kind is SourceScanKind =>
    kind === "java" || kind === "kotlin" || kind === "groovy";

export interface ScannedFile {
    absPath: string;
    /** 相对分析根目录的 POSIX 风格路径。 */
    relPath: string;
    name: string;
    kind: ScanKind;
}

const DEFAULT_IGNORES = new Set([
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    ".idea",
    ".vscode",
    ".gradle",
    ".mvn",
    "target",
    "build",
    "dist",
    "out",
    "bin",
    "obj",
    "coverage",
    ".next",
    ".nuxt",
    ".cache",
    ".turbo",
]);

export const toPosix = (value: string): string => {
    return value.split(sep).join("/");
};

/** 目录名比较只用于保证扫描顺序稳定，代码单元比较比 localeCompare 快得多。 */
const compareNames = (left: string, right: string): number => {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
};

export const scanProject = (
    root: string,
    options: { maxFiles: number; ignore: string[] },
): { files: ScannedFile[]; truncated: boolean; ignoredDirs: string[] } => {
    // Windows 文件系统大小写不敏感，忽略目录名统一按小写匹配。
    const ignore = new Set(
        [...DEFAULT_IGNORES, ...options.ignore].map((name) => name.toLowerCase()),
    );
    const files: ScannedFile[] = [];
    const ignoredDirs: string[] = [];
    let truncated = false;

    const stack: string[] = [root];
    while (stack.length > 0 && !truncated) {
        const dir = stack.pop();
        if (dir === undefined) break;
        let entries: Dirent[];
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        entries.sort((left, right) => compareNames(left.name, right.name));

        for (const entry of entries) {
            if (files.length >= options.maxFiles) {
                truncated = true;
                break;
            }
            const absPath = join(dir, entry.name);
            if (entry.isSymbolicLink()) continue;
            if (entry.isDirectory()) {
                if (ignore.has(entry.name.toLowerCase())) {
                    ignoredDirs.push(toPosix(relative(root, absPath)));
                    continue;
                }
                stack.push(absPath);
                continue;
            }
            if (!entry.isFile()) continue;

            const kind = classify(entry.name);
            if (!kind) continue;
            files.push({
                absPath,
                relPath: toPosix(relative(root, absPath)),
                name: entry.name,
                kind,
            });
        }
    }

    return { files, truncated, ignoredDirs };
};

const classify = (name: string): ScanKind | undefined => {
    if (name === "pom.xml") return "maven";
    if (name === "settings.gradle" || name === "settings.gradle.kts") return "gradle-settings";
    if (name === "build.gradle" || name === "build.gradle.kts") return "gradle";
    // 先判断高频源码后缀，避免对大目录逐条执行多次 endsWith。
    const dot = name.lastIndexOf(".");
    if (dot < 0) return undefined;
    const extension = name.slice(dot);
    if (extension === ".java") return "java";
    if (extension === ".kt") return "kotlin";
    if (extension === ".groovy") return "groovy";
    if (extension === ".gradle" || name.endsWith(".gradle.kts")) return "gradle-other";
    return undefined;
};

export const directoryOf = (relPath: string): string => {
    const index = relPath.lastIndexOf("/");
    return index < 0 ? "" : relPath.slice(0, index);
};

export const isDirectory = (dir: string): boolean => {
    try {
        return statSync(dir).isDirectory();
    } catch {
        return false;
    }
};
