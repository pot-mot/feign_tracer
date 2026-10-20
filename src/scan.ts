import { readdirSync, statSync, type Dirent } from "node:fs";
import { join, relative, sep } from "node:path";

export type ScanKind =
    "java" | "kotlin" | "groovy" | "maven" | "gradle" | "gradle-settings" | "gradle-other";

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

export const scanProject = (
    root: string,
    options: { maxFiles: number; ignore: string[] },
): { files: ScannedFile[]; truncated: boolean; ignoredDirs: string[] } => {
    const ignore = new Set([...DEFAULT_IGNORES, ...options.ignore]);
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
        entries.sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            if (files.length >= options.maxFiles) {
                truncated = true;
                break;
            }
            const absPath = join(dir, entry.name);
            if (entry.isSymbolicLink()) continue;
            if (entry.isDirectory()) {
                if (ignore.has(entry.name)) {
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
    if (name.endsWith(".gradle") || name.endsWith(".gradle.kts")) return "gradle-other";
    if (name.endsWith(".java")) return "java";
    if (name.endsWith(".kt")) return "kotlin";
    if (name.endsWith(".groovy")) return "groovy";
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
