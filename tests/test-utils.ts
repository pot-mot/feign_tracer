import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** 每个测试用例独立临时目录，结束后由调用方清理。 */
export const makeTempDir = (prefix: string): string => mkdtempSync(join(tmpdir(), prefix));

export const writeFile = (root: string, relPath: string, content: string): string => {
    const absPath = join(root, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, content, "utf8");
    return absPath;
};

export const removeDir = (dir: string): void => {
    rmSync(dir, { recursive: true, force: true });
};

/**
 * 把一组「相对路径 -> 内容」写成临时工程。
 *
 * 回归用例需要多文件互相引用（同包、import、通配符、继承链），直接在临时目录
 * 里生成比往仓库里塞一堆源码更干净，也不会被 `feign-tracer .` 扫到。
 */
export const createProject = (
    prefix: string,
    files: Readonly<Record<string, string>>,
): { root: string; cleanup: () => void } => {
    const root = makeTempDir(prefix);
    for (const [relPath, content] of Object.entries(files)) writeFile(root, relPath, content);
    return { root, cleanup: () => removeDir(root) };
};

/** Java 源码放在 Maven 约定的目录下，便于模块/端点识别逻辑正常工作。 */
export const javaPath = (packageName: string, className: string): string =>
    `src/main/java/${packageName.split(".").join("/")}/${className}.java`;

export const kotlinPath = (packageName: string, className: string): string =>
    `src/main/kotlin/${packageName.split(".").join("/")}/${className}.kt`;

export const groovyPath = (packageName: string, className: string): string =>
    `src/main/groovy/${packageName.split(".").join("/")}/${className}.groovy`;

/**
 * 去掉时间戳、耗时和选项，用于比较两次分析的业务结果。
 * 选项里包含缓存目录与 worker 数，天然会随运行方式变化。
 */
export const sanitizeResult = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map((item) => sanitizeResult(item));
    if (typeof value === "object" && value !== null) {
        const result: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value)) {
            if (key === "durationMs" || key === "generatedAt" || key === "options") continue;
            // 缓存 JSON 会省略 undefined 可选字段，归一化后再比较。
            if (item === undefined) continue;
            result[key] = sanitizeResult(item);
        }
        return result;
    }
    return value;
};

/**
 * 递归删除值为 `undefined` 的键。
 *
 * 快照要和磁盘上的 JSON 比较，而 `JSON.stringify` 会丢掉 undefined 属性，
 * 不归一化就会把「字段缺失」和「字段存在但为 undefined」判成不等。
 */
export const dropUndefined = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map((item) => dropUndefined(item));
    if (typeof value === "object" && value !== null) {
        const result: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value)) {
            if (item === undefined) continue;
            result[key] = dropUndefined(item);
        }
        return result;
    }
    return value;
};

/** 生成一个最小但可解析的 Java 接口，避免测试依赖完整 Spring 样例。 */
export const minimalJavaInterface = (
    packageName: string,
    name: string,
): string => `package ${packageName};

public interface ${name} {
    String load(String id);
}
`;
