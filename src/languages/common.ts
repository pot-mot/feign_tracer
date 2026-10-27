import {
    BaseErrorListener,
    CharStream,
    CommonTokenStream,
    PredictionMode,
    type Parser,
    ParserRuleContext,
    Token,
    type Lexer,
} from "antlr4ng";
import type { AnnotationInfo, CallSite } from "../model.ts";

export interface ParseOutcome<T extends ParserRuleContext, P extends Parser = Parser> {
    parser: P;
    tokens: CommonTokenStream;
    /** 每个文件只过滤一次；调用点扫描按方法范围复用，避免逐方法复制整份 token。 */
    visibleTokens: Token[];
    tree: T;
    errors: string[];
    text: string;
}

class CollectingErrorListener extends BaseErrorListener {
    public readonly errors: string[] = [];

    public override syntaxError(
        _recognizer: unknown,
        _offendingSymbol: unknown,
        line: number,
        column: number,
        msg: string,
    ): void {
        if (this.errors.length < 50) this.errors.push(`line ${line}:${column} ${msg}`);
    }
}

/** 去除 UTF-8 BOM；部分 Windows 编辑器会添加该字符，ANTLR 会将其视为错误 token。 */
export const stripBom = (text: string): string => {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
};

/**
 * 预测模式策略。
 *
 * 实测本仓库的 Java20 语法在 `return a.b(x)` 这种最常见的限定调用上
 * 无法用 SLL 解析：语法树里 `expressionName`/`ambiguousName` 的右递归
 * 让 SLL 预测选错分支，报 “mismatched input '(' expecting '.'”。
 * 因此 SLL 只能"先试一次"，一旦发现在当前输入集合上不可用就必须停止
 * 重复尝试——否则每个文件都要白跑一遍 SLL 再用 LL 重解析，而小文件上
 * SLL 的耗时可以达到 LL 的 5 倍。
 *
 * auto：连续失败若干次后关闭 SLL；always/never 用于调试与基准对比。
 */
export type PredictionStrategy = "auto" | "always" | "never";

/**
 * SLL 失败几次后彻底关闭。
 *
 * 取 1：worker 各自持有独立状态，每个 worker 只允许浪费一次 SLL 尝试。
 * 若取更大值，8 个 worker 会各自白跑多次（每次都要重新 lex + parse）。
 */
const SLL_FAILURE_LIMIT = 1;

const readStrategy = (): PredictionStrategy => {
    const raw = process.env.FEIGN_TRACER_PREDICTION?.toLowerCase();
    if (raw === "always") return "always";
    if (raw === "never") return "never";
    return "auto";
};

let sllFailures = 0;
let sllDisabled = readStrategy() === "never";

/** 当前运行是否还在使用 SLL；供 CLI 汇报解析策略。 */
export const sllEnabled = (): boolean => !sllDisabled;

/** 仅供测试：重置自适应状态。 */
export const resetPredictionMode = (): void => {
    sllFailures = 0;
    sllDisabled = readStrategy() === "never";
};

export const parseWith = <T extends ParserRuleContext, P extends Parser>(
    LexerClass: new (input: CharStream) => Lexer,
    ParserClass: new (input: CommonTokenStream) => P,
    text: string,
    rule: (parser: P) => T,
): ParseOutcome<T, P> => {
    const clean = stripBom(text);

    /*
     * 先走 SLL，失败再退回 LL。
     *
     * Java 等语法的方法调用表达式在 LL 模式下会产生大量全上下文预测：
     * 一个普通文件里几十个调用就能让解析器占用上百 MB、耗时数秒。
     * SLL 对合法 Java 代码通常给出相同语法树；一旦出现语法错误，说明
     * 该输入需要 LL 的上下文信息，此时重新解析即可保持原有行为。
     */
    const parseOnce = (mode: number): ParseOutcome<T, P> => {
        const lexer = new LexerClass(CharStream.fromString(clean));
        const listener = new CollectingErrorListener();
        lexer.removeErrorListeners();
        lexer.addErrorListener(listener);

        const tokens = new CommonTokenStream(lexer);
        const parser = new ParserClass(tokens);
        parser.interpreter.predictionMode = mode;
        parser.removeErrorListeners();
        parser.addErrorListener(listener);

        const tree = rule(parser);
        return {
            parser,
            tokens,
            visibleTokens: visibleTokens(tokens),
            tree,
            errors: listener.errors,
            text: clean,
        };
    };

    if (!sllDisabled) {
        const fast = parseOnce(PredictionMode.SLL);
        // SLL 的语义保证：要么给出与 LL 相同的树，要么报语法错误。
        if (fast.errors.length === 0) {
            sllFailures = 0;
            return fast;
        }
        sllFailures++;
        if (sllFailures >= SLL_FAILURE_LIMIT) sllDisabled = true;
    }

    return parseOnce(PredictionMode.LL);
};

export const ruleName = (parser: Parser, ctx: ParserRuleContext): string => {
    return parser.ruleNames[ctx.ruleIndex] ?? "";
};

export const childRules = (ctx: ParserRuleContext): ParserRuleContext[] => {
    const result: ParserRuleContext[] = [];
    for (const child of ctx.children ?? []) {
        if (child instanceof ParserRuleContext) result.push(child);
    }
    return result;
};

export const childRulesNamed = (
    parser: Parser,
    ctx: ParserRuleContext,
    name: string,
): ParserRuleContext[] => {
    return childRules(ctx).filter((child) => ruleName(parser, child) === name);
};

export const firstChildRule = (
    parser: Parser,
    ctx: ParserRuleContext,
    name: string,
): ParserRuleContext | undefined => {
    return childRules(ctx).find((child) => ruleName(parser, child) === name);
};

export const walkTree = (
    ctx: ParserRuleContext,
    visit: (node: ParserRuleContext, parent: ParserRuleContext | undefined) => void,
    parent?: ParserRuleContext,
): void => {
    visit(ctx, parent);
    for (const child of ctx.children ?? []) {
        if (child instanceof ParserRuleContext) walkTree(child, visit, ctx);
    }
};

export const findDescendants = (
    parser: Parser,
    ctx: ParserRuleContext,
    names: string | string[],
): ParserRuleContext[] => {
    const wanted = new Set(Array.isArray(names) ? names : [names]);
    const result: ParserRuleContext[] = [];
    walkTree(ctx, (node) => {
        if (wanted.has(ruleName(parser, node))) result.push(node);
    });
    return result;
};

export const textOf = (ctx: ParserRuleContext | undefined): string => {
    return ctx?.getText() ?? "";
};

export const lineOf = (ctx: ParserRuleContext): number => {
    return ctx.start?.line ?? 0;
};

export const endLineOf = (ctx: ParserRuleContext): number => {
    return ctx.stop?.line ?? ctx.start?.line ?? 0;
};

export const startOffset = (ctx: ParserRuleContext): number => {
    return ctx.start?.start ?? 0;
};

export const endOffset = (ctx: ParserRuleContext): number => {
    return ctx.stop?.stop ?? ctx.start?.stop ?? 0;
};

export const tokenIndexRange = (ctx: ParserRuleContext): [number, number] => {
    return [ctx.start?.tokenIndex ?? 0, ctx.stop?.tokenIndex ?? 0];
};

export const visibleTokens = (tokens: CommonTokenStream): Token[] => {
    return tokens.getTokens().filter((token) => token.channel === Token.DEFAULT_CHANNEL);
};

/** 按逗号切分列表，同时尊重 ()、[]、{}、<> 与字符串字面量。 */
export const splitTopLevel = (input: string, separator = ","): string[] => {
    const result: string[] = [];
    let current = "";
    let depth = 0;
    let quote: string | undefined;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (quote) {
            current += ch;
            if (ch === "\\" && i + 1 < input.length) {
                current += input[++i];
            } else if (ch === quote) {
                quote = undefined;
            }
            continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
            quote = ch;
            current += ch;
            continue;
        }
        if (ch === "(" || ch === "[" || ch === "{" || ch === "<") depth++;
        if (ch === ")" || ch === "]" || ch === "}" || ch === ">") depth--;
        if (ch === separator && depth === 0) {
            result.push(current.trim());
            current = "";
            continue;
        }
        current += ch;
    }
    if (current.trim().length > 0) result.push(current.trim());
    return result;
};

/**
 * 注解名统一归约为简单名。
 *
 * Java/Kotlin 允许写全限定名（`@org.springframework.stereotype.Service`），
 * 而下游所有识别逻辑（`hasAnnotation`、端点映射表、`kindOf`）都按简单名匹配，
 * 不归约就会出现「写法不同、识别结果不同」。`raw` 仍保留原文。
 */
const annotationName = (name: string): string => {
    const trimmed = name.trim();
    const dot = trimmed.lastIndexOf(".");
    return dot < 0 ? trimmed : trimmed.slice(dot + 1);
};

export const parseAnnotation = (rawText: string): AnnotationInfo => {
    let raw = rawText.trim();
    if (raw.startsWith("@")) raw = raw.slice(1);

    const paren = raw.indexOf("(");
    if (paren < 0) {
        const text = raw.trim();
        return { name: annotationName(text), raw: `@${text}`, args: {} };
    }

    const name = raw.slice(0, paren).trim();
    const close = raw.lastIndexOf(")");
    const inner = raw.slice(paren + 1, close < 0 ? raw.length : close);
    const args: Record<string, string> = {};
    const positional: string[] = [];

    for (const part of splitTopLevel(inner)) {
        const eq = topLevelEquals(part);
        if (eq >= 0) {
            const key = part.slice(0, eq).trim();
            const value = part.slice(eq + 1).trim();
            if (key) args[key] = value;
        } else if (part.length > 0) {
            positional.push(part);
        }
    }

    if (positional.length > 0) {
        args.value = positional[0];
        positional.slice(1).forEach((value, index) => {
            args[`value${index + 1}`] = value;
        });
    }

    return { name: annotationName(name), raw: `@${name}${raw.slice(paren)}`, args };
};

const topLevelEquals = (input: string): number => {
    let depth = 0;
    let quote: string | undefined;
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (quote) {
            if (ch === "\\") i++;
            else if (ch === quote) quote = undefined;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === "(" || ch === "[" || ch === "{" || ch === "<") depth++;
        else if (ch === ")" || ch === "]" || ch === "}" || ch === ">") depth--;
        else if (ch === "=" && depth === 0) return i;
    }
    return -1;
};

/** 提取注解属性值中的所有字符串字面量。 */
export const stringValues = (value: string | undefined): string[] => {
    if (!value) return [];
    const quoted = [...value.matchAll(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g)].map(
        (match) => match[1] ?? match[2] ?? "",
    );
    if (quoted.length > 0) return quoted;

    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return splitTopLevel(trimmed.slice(1, -1))
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [trimmed];
};

export const hasAnnotation = (annotations: AnnotationInfo[], ...names: string[]): boolean => {
    return annotations.some((annotation) => names.includes(annotation.name));
};

export const getAnnotation = (
    annotations: AnnotationInfo[],
    ...names: string[]
): AnnotationInfo | undefined => {
    return annotations.find((annotation) => names.includes(annotation.name));
};

/**
 * 将声明类型归约为简单名：List<Order>[] -> List，
 * kotlin.collections.List<Order> -> List，? extends Foo -> Foo。
 */
export const simpleTypeName = (raw: string): string => {
    let text = raw.trim();
    text = text.replace(/@[\w.]+(\([^)]*\))?/g, "").trim();
    text = text.replace(/^(?:final|vararg|lateinit|out|in|reified)\s+/g, "").trim();
    text = text.replace(/^[?]\s*(?:extends|super)?\s*/, "").trim();

    const generic = text.indexOf("<");
    if (generic > 0) text = text.slice(0, generic);
    text = text
        .replace(/\[\s*\]/g, "")
        .replace(/\?+$/, "")
        .trim();
    text = text.replace(/<.*$/s, "").trim();

    if (text.includes("->")) return text;
    const parts = text.split(/[.\s]/).filter(Boolean);
    let name = parts[parts.length - 1] ?? text;
    name = name.replace(/[^\w$]/g, "");
    return name;
};

export const qualifiedTypeName = (raw: string): string => {
    let text = raw.trim();
    text = text.replace(/@[\w.]+(\([^)]*\))?/g, "").trim();
    text = text.replace(/^(?:final|vararg|lateinit|out|in|reified)\s+/g, "").trim();
    text = text.replace(/^[?]\s*(?:extends|super)?\s*/, "").trim();
    const generic = text.indexOf("<");
    if (generic > 0) text = text.slice(0, generic);
    text = text
        .replace(/\[\s*\]/g, "")
        .replace(/\?+$/, "")
        .trim();
    return text;
};

/** 类型的顶层泛型参数：Map<String, List<Order>> -> [String, List<Order>]。 */
export const typeArguments = (raw: string): string[] => {
    const start = raw.indexOf("<");
    const end = raw.lastIndexOf(">");
    if (start < 0 || end <= start) return [];
    return splitTopLevel(raw.slice(start + 1, end));
};

export const unquote = (value: string): string => {
    const trimmed = value.trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
};

export const methodLabel = (
    ownerName: string,
    methodName: string,
    params: Array<{ name: string; type: string }>,
    style: "names" | "types" | "none" = "names",
): string => {
    const args =
        style === "names"
            ? params.map((param) => param.name).join(", ")
            : style === "types"
              ? params.map((param) => param.type).join(", ")
              : "";
    return `${ownerName}.${methodName}(${args})`;
};

export const callArgsText = (call: CallSite): string => {
    return call.args.length > 0 ? call.args.join(", ") : "";
};

export const normalizePath = (path: string): string => {
    let result = path.trim();
    if (result.startsWith("http://") || result.startsWith("https://")) {
        try {
            result = new URL(result).pathname;
        } catch {
            // 无法继续简化的部分保持原样
        }
    }
    if (!result.startsWith("/")) result = `/${result}`;
    result = result.replace(/\/{2,}/g, "/");
    if (result.length > 1 && result.endsWith("/")) result = result.slice(0, -1);
    return result;
};

/** 支持通配符的比较，用于把 Feign 操作与控制器关联起来。 */
export const pathMatches = (a: string, b: string): boolean => {
    const left = normalizePath(a).split("/").filter(Boolean);
    const right = normalizePath(b).split("/").filter(Boolean);
    if (left.length !== right.length) return false;
    return left.every((segment, index) => {
        const other = right[index];
        if (segment === other) return true;
        const leftVar = segment.startsWith("{") && segment.endsWith("}");
        const rightVar = other.startsWith("{") && other.endsWith("}");
        if (leftVar && rightVar) return true;
        if ((leftVar || rightVar) && (segment === "*" || other === "*")) return true;
        return false;
    });
};
