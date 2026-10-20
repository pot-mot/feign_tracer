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

    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        const tokenIndex = token.tokenIndex ?? -1;
        if (tokenIndex < startTokenIndex || tokenIndex > endTokenIndex) continue;

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

const qualifierText = (tokens: Token[], source: string, endIndex: number): string | undefined => {
    if (endIndex < 0) return undefined;
    let cursor = endIndex;
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
