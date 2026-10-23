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

/** 生成一个最小但可解析的 Java 接口，避免测试依赖完整 Spring 样例。 */
export const minimalJavaInterface = (
    packageName: string,
    name: string,
): string => `package ${packageName};

public interface ${name} {
    String load(String id);
}
`;
