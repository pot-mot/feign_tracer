import type { Token } from "antlr4ng";
import type { CallSite } from "../model.ts";

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const BOUNDARY = new Set([
    "(",
    ",",
    "=",
    ";",
    "{",
    "}",
    "[",
    "return",
    "if",
    "else",
    "while",
    "for",
    "switch",
    "case",
    "do",
    "throw",
    "assert",
    "yield",
    "new",
    "->",
    "=>",
    "?",
    ":",
    "&&",
    "||",
    "!",
    "+",
    "-",
    "*",
    "/",
    "%",
    "&",
    "|",
    "^",
    "~",
    "==",
    "!=",
    "<",
    ">",
    "<=",
    ">=",
    "++",
    "--",
    "+=",
    "-=",
    "*=",
    "/=",
    "as",
    "in",
    "is",
    "?:",
    "!!",
    "..",
]);

const JAVA_KEYWORDS = new Set([
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "synchronized",
    "return",
    "throw",
    "new",
    "assert",
    "yield",
    "super",
    "this",
    "else",
    "do",
    "try",
    "finally",
    "case",
    "default",
    "instanceof",
    "void",
    "int",
    "long",
    "short",
    "byte",
    "char",
    "float",
    "double",
    "boolean",
    "null",
    "true",
    "false",
    "class",
    "interface",
    "enum",
    "record",
    "extends",
    "implements",
    "import",
    "package",
    "static",
    "final",
    "abstract",
    "native",
    "strictfp",
    "transient",
    "volatile",
    "public",
    "private",
    "protected",
    "goto",
    "const",
    "var",
]);

const KOTLIN_KEYWORDS = new Set([
    "if",
    "else",
    "when",
    "for",
    "while",
    "do",
    "try",
    "catch",
    "finally",
    "return",
    "throw",
    "break",
    "continue",
    "class",
    "object",
    "interface",
    "fun",
    "val",
    "var",
    "is",
    "in",
    "as",
    "typeof",
    "this",
    "super",
    "null",
    "true",
    "false",
    "package",
    "import",
    "typealias",
    "constructor",
    "init",
    "where",
    "by",
    "set",
    "get",
    "it",
    "synchronized",
    "out",
    "reified",
    "dynamic",
]);

const GROOVY_KEYWORDS = new Set([
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "default",
    "do",
    "try",
    "catch",
    "finally",
    "return",
    "throw",
    "throws",
    "new",
    "assert",
    "synchronized",
    "def",
    "class",
    "interface",
    "trait",
    "enum",
    "extends",
    "implements",
    "import",
    "package",
    "static",
    "final",
    "abstract",
    "public",
    "private",
    "protected",
    "void",
    "true",
    "false",
    "null",
    "this",
    "super",
    "in",
    "as",
    "instanceof",
    "it",
]);

export const KEYWORDS = {
    java: JAVA_KEYWORDS,
    kotlin: KOTLIN_KEYWORDS,
    groovy: GROOVY_KEYWORDS,
};

export interface ScanCallOptions {
    tokens: Token[];
    source: string;
    startTokenIndex: number;
    endTokenIndex: number;
    keywords: Set<string>;
}

/** 可见 token 的 tokenIndex 单调递增，用二分定位方法体起点，避免逐方法扫描整份文件。 */
const lowerBound = (tokens: Token[], target: number): number => {
    let low = 0;
    let high = tokens.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if ((tokens[middle].tokenIndex ?? -1) < target) low = middle + 1;
        else high = middle;
    }
    return low;
};

/**
 * 各语言共享的 token 级调用点检测。
 *
 * ANTLR 已给出类型、方法、参数列表、范围等精确结构；调用表达式则从配对
 * token 流中收集。这样提取器无需依赖完整语法中多种方法调用规则
 * （methodInvocation / primaryNoNewArray / postfix chains 等）。
 */
export const scanTokenCalls = (options: ScanCallOptions): CallSite[] => {
    const { tokens, source, startTokenIndex, endTokenIndex, keywords } = options;
    const calls: CallSite[] = [];
    const start = lowerBound(tokens, startTokenIndex);

    for (let index = start; index < tokens.length; index++) {
        const token = tokens[index];
        const tokenIndex = token.tokenIndex ?? -1;
        if (tokenIndex > endTokenIndex) break;

        const text = token.text ?? "";
        if (!IDENTIFIER.test(text)) continue;
        if (keywords.has(text)) continue;
        const previous = tokens[index - 1];
        if (previous?.text === "@") continue;
        if (tokens[index + 1]?.text !== "(") continue;

        let isConstructor = previous?.text === "new";
        if (!isConstructor && previous?.text === ">") {
            // 构造函数调用 new Foo<Bar>(...)：向前跨过类型参数。
            let depth = 0;
            let cursor = index - 1;
            while (cursor >= 0) {
                const value = tokens[cursor].text;
                if (value === ">") depth++;
                else if (value === "<") {
                    depth--;
                    if (depth === 0) {
                        isConstructor = tokens[cursor - 1]?.text === "new";
                        break;
                    }
                }
                cursor--;
            }
        }

        let qualifier: string | undefined;
        let qualifierKind: CallSite["qualifierKind"] = "implicit";

        if (isConstructor) {
            qualifier = text;
            qualifierKind = "constructor";
        } else if (previous?.text === "." || previous?.text === "?.") {
            qualifier = qualifierText(tokens, source, index - 2);
            qualifierKind = classifyQualifier(qualifier);
        }

        const args = collectArguments(tokens, index + 1);

        calls.push({
            name: text,
            qualifier,
            qualifierKind,
            argCount: args.length,
            args,
            line: token.line ?? 0,
            offset: token.start ?? 0,
            isConstructor,
        });
    }

    return calls.sort((left, right) => left.offset - right.offset);
};

/** 闭括号 -> 配对的开始符号；链式调用与下标访问都要整体跳过。 */
const MATCHING_OPEN: Readonly<Record<string, string>> = { ")": "(", "]": "[" };

/**
 * 提取调用点的接收者源码。
 *
 * 链式调用 `a.b(x).c()` 里 `c` 的接收者是前一次调用的**结果**，不是某个名字，
 * 因此先把紧邻的配对括号/下标整体跳过，再往回找边界。否则会把 `id)` 这种
 * 残片当成接收者：既解析不出类型，也会把垃圾字符串写进结果。
 */
const qualifierText = (tokens: Token[], source: string, endIndex: number): string | undefined => {
    if (endIndex < 0) return undefined;
    let cursor = endIndex;

    for (;;) {
        const closer = tokens[cursor]?.text;
        const opener = closer === undefined ? undefined : MATCHING_OPEN[closer];
        if (opener === undefined) break;

        let depth = 0;
        let found = -1;
        for (let index = cursor; index >= 0; index--) {
            const value = tokens[index].text;
            if (value === closer) depth++;
            else if (value === opener) {
                depth--;
                if (depth === 0) {
                    found = index;
                    break;
                }
            }
        }
        if (found < 0) return undefined;
        cursor = found - 1;
    }

    while (cursor >= 0 && !BOUNDARY.has(tokens[cursor].text ?? "")) cursor--;
    const start = tokens[cursor + 1];
    const stop = tokens[endIndex];
    if (!start || !stop) return undefined;
    const value = source.slice(start.start ?? 0, (stop.stop ?? 0) + 1).trim();
    return value.length > 0 ? value : undefined;
};

const classifyQualifier = (qualifier: string | undefined): CallSite["qualifierKind"] => {
    if (!qualifier) return "implicit";
    if (qualifier === "this" || qualifier === "super")
        return qualifier === "this" ? "this" : "implicit";
    if (/^[A-Z][A-Za-z0-9_$.]*$/.test(qualifier)) return "type";
    return "expr";
};

const collectArguments = (tokens: Token[], openIndex: number): string[] => {
    const args: string[] = [];
    if (tokens[openIndex]?.text !== "(") return args;

    let depth = 0;
    let current = "";
    for (let cursor = openIndex; cursor < tokens.length; cursor++) {
        const value = tokens[cursor].text ?? "";
        if (value === "(" || value === "[" || value === "{") {
            depth++;
            if (depth === 1 && value === "(") continue;
        } else if (value === ")" || value === "]" || value === "}") {
            depth--;
            if (depth === 0) {
                if (current.trim()) args.push(current.trim());
                break;
            }
        } else if (value === "," && depth === 1) {
            args.push(current.trim());
            current = "";
            continue;
        }
        current += value;
    }
    return args;
};
