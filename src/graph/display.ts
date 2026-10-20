import type { CallTreeNode, MethodInfo } from "../model.ts";
import type { DeepReadonly } from "../types.ts";

export interface DisplayMode {
    /** 显示 `(a, b)` 参数列表。 */
    readonly params: boolean;
    /** 显示参数类型，例如 `(id: String)`。 */
    readonly paramTypes: boolean;
    /** 在方法前显示可见性（`public`、`private` 等）。 */
    readonly visibility: boolean;
}

export const DEFAULT_DISPLAY_MODE: DisplayMode = {
    params: true,
    paramTypes: false,
    visibility: false,
};

const VISIBILITY_ORDER = ["private", "protected", "internal", "public"] as const;

/**
 * Java 默认 package-private，Kotlin/Groovy 默认 public；
 * 显式修饰符始终优先。
 */
export const visibilityOf = (method: MethodInfo, filePath?: string): string => {
    if (method.ownerKind === "interface" || method.ownerKind === "annotation") return "public";
    const modifiers = method.modifiers.map((modifier) => modifier.toLowerCase());
    for (const visibility of VISIBILITY_ORDER) {
        if (modifiers.includes(visibility)) return visibility;
    }
    return filePath?.endsWith(".java") ? "package" : "public";
};

export const paramsOf = (method: MethodInfo): Array<{ name: string; type: string }> => {
    return method.params.map((param) => ({ name: param.name, type: param.type }));
};

/**
 * 按显示模式渲染节点标签。未解析的合成叶子没有结构化参数，
 * 因此保留其预渲染标签。
 */
export const formatNodeLabel = (node: DeepReadonly<CallTreeNode>, mode: DisplayMode): string => {
    if (!node.params) return node.label;

    const paren = node.label.indexOf("(");
    const head = paren >= 0 ? node.label.slice(0, paren) : node.label;
    const dot = head.lastIndexOf(".");
    const owner = dot >= 0 ? head.slice(0, dot) : "";
    const name = dot >= 0 ? head.slice(dot + 1) : head;

    const params = mode.params
        ? `(${node.params
              .map((param) => (mode.paramTypes ? `${param.name}: ${param.type}` : param.name))
              .join(", ")})`
        : "";
    const base = owner ? `${owner}.${name}${params}` : `${name}${params}`;
    return mode.visibility && node.visibility ? `${node.visibility} ${base}` : base;
};
