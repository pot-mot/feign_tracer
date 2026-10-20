import type { EndpointInfo } from "../model.ts";

export interface EndpointSelection {
    /** 关键词，不区分大小写匹配 id/path/handler/controller/module。 */
    readonly keywords: readonly string[];
    /** 精确控制器简单名或全限定名。 */
    readonly classNames?: readonly string[];
    /** 精确 handler 方法名。 */
    readonly methodNames?: readonly string[];
    /** 仅保留控制器文件位于该根目录相对路径下的端点。 */
    readonly rebuildDir?: string;
}

export const selectEndpoints = (
    endpoints: EndpointInfo[],
    selection: EndpointSelection,
): EndpointInfo[] => {
    const keywords = selection.keywords.map((keyword) => keyword.trim()).filter(Boolean);
    const classNames = (selection.classNames ?? []).map((name) => name.trim()).filter(Boolean);
    const methodNames = (selection.methodNames ?? []).map((name) => name.trim()).filter(Boolean);
    const dir = selection.rebuildDir ? normalizePath(selection.rebuildDir) : undefined;
    return endpoints.filter(
        (endpoint) =>
            matchesKeywords(endpoint, keywords) &&
            matchesExactSelection(endpoint, classNames, methodNames) &&
            matchesDir(endpoint, dir),
    );
};

/** CLI/UI 输入使用的精确控制器类 + handler 方法匹配。 */
export const matchesExactSelection = (
    endpoint: EndpointInfo,
    classNames: string[],
    methodNames: string[],
): boolean => {
    if (classNames.length > 0) {
        const controller = endpoint.controller.trim();
        const simpleName = controller.split(".").pop() ?? controller;
        if (!classNames.some((name) => name === controller || name === simpleName)) return false;
    }
    if (methodNames.length > 0) {
        const handlerName = handlerMethodName(endpoint);
        if (!handlerName || !methodNames.includes(handlerName)) return false;
    }
    return true;
};

export const handlerMethodName = (endpoint: EndpointInfo): string | undefined => {
    const match = /#([^/]+)\//.exec(endpoint.handler);
    if (match) return match[1];
    return undefined;
};

export const matchesKeywords = (endpoint: EndpointInfo, keywords: string[]): boolean => {
    if (keywords.length === 0) return true;
    const haystack = [
        endpoint.id,
        endpoint.handler,
        endpoint.handlerLabel,
        endpoint.controller,
        endpoint.moduleId ?? "",
        ...endpoint.paths,
    ]
        .join("\n")
        .toLowerCase();

    return keywords.every((keyword) => {
        const regex = parseRegex(keyword);
        if (regex) return regex.test(haystack);
        return haystack.includes(keyword.toLowerCase());
    });
};

const matchesDir = (endpoint: EndpointInfo, dir: string | undefined): boolean => {
    if (!dir || dir === ".") return true;
    const file = endpoint.file ? normalizePath(endpoint.file) : "";
    return file === dir || file.startsWith(`${dir}/`);
};

export const normalizePath = (value: string): string => {
    return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
};

/** 除普通子串外支持 `/regex/flags`；匹配不区分大小写。 */
const parseRegex = (value: string): RegExp | undefined => {
    const match = /^\/(.+)\/([a-z]*)$/i.exec(value);
    if (!match) return undefined;
    try {
        return new RegExp(match[1], `${match[2].replace(/[gi]/g, "")}i`);
    } catch {
        return undefined;
    }
};
