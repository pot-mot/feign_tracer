import type { ParserRuleContext } from "antlr4ng";
import { readFileSync } from "node:fs";
import type {
    AnnotationInfo,
    CallSite,
    FieldInfo,
    ImportInfo,
    LocalVar,
    MethodInfo,
    ParamInfo,
    ParsedFile,
    TypeInfo,
    TypeKind,
} from "../model.ts";
import { GroovyLexer } from "../generated/groovy/GroovyLexer.ts";
import { GroovyParser } from "../generated/groovy/GroovyParser.ts";
import {
    childRules,
    childRulesNamed,
    endLineOf,
    endOffset,
    firstChildRule,
    lineOf,
    parseAnnotation,
    parseWith,
    ruleName,
    simpleTypeName,
    startOffset,
    textOf,
    type ParseOutcome,
} from "./common.ts";
import { KEYWORDS, scanTokenCalls } from "./callscan.ts";

export const parseGroovyFile = (
    absPath: string,
    relPath: string,
    moduleId?: string,
): ParsedFile => {
    const source = readFileSync(absPath, "utf8");
    const outcome = parseWith(GroovyLexer, GroovyParser, source, (parser) => parser.groovyFile());

    const file: ParsedFile = {
        path: relPath,
        absPath,
        language: "groovy",
        moduleId,
        packageName: "",
        imports: [],
        types: [],
        parseErrors: outcome.errors.length,
        lineCount: source.split(/\r?\n/).length,
    };

    const packageCtx = firstChildRule(outcome.parser, outcome.tree, "packageDecl");
    if (packageCtx) {
        file.packageName = textOf(packageCtx)
            .replace(/^package/, "")
            .replace(/;$/, "")
            .trim();
    }

    for (const importCtx of childRulesNamed(outcome.parser, outcome.tree, "importDecl")) {
        file.imports.push(parseGroovyImport(textOf(importCtx)));
    }

    collectTypes(outcome, outcome.tree, file, undefined, moduleId, false);
    return file;
};

/** `textOf()` 不保留空格，`import static a.b.C.d` 会粘连，不能用 `"static "` 判断。 */
const parseGroovyImport = (text: string): ImportInfo => {
    let value = text
        .replace(/^import/, "")
        .replace(/;$/, "")
        .trim();
    let isStatic = false;
    if (value.startsWith("static")) {
        isStatic = true;
        value = value.slice("static".length).trim();
    }
    const wildcard = value.endsWith(".*") || value.endsWith("*");
    if (wildcard) value = value.replace(/\.?\*$/, "");
    return { name: value, static: isStatic, wildcard };
};

const collectTypes = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
    file: ParsedFile,
    parent: TypeInfo | undefined,
    moduleId: string | undefined,
    skipSelf: boolean,
): void => {
    for (const child of childRules(ctx)) {
        if (!skipSelf && ruleName(outcome.parser, child) === "classDecl") {
            const typeInfo = extractType(outcome, child, file, parent, moduleId);
            if (parent) parent.nested.push(typeInfo);
            else file.types.push(typeInfo);
            const body = firstChildRule(outcome.parser, child, "classBody");
            if (body) collectTypes(outcome, body, file, typeInfo, moduleId, false);
            continue;
        }
        collectTypes(outcome, child, file, parent, moduleId, false);
    }
};

const extractType = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
    file: ParsedFile,
    parent: TypeInfo | undefined,
    moduleId?: string,
): TypeInfo => {
    const children = childRules(ctx);
    const annotations: AnnotationInfo[] = [];
    const modifiers: string[] = [];
    for (const child of children) {
        const rule = ruleName(outcome.parser, child);
        if (rule === "annotation") annotations.push(parseAnnotation(textOf(child)));
        else if (rule === "modifier") modifiers.push(textOf(child));
    }

    const nameCtx = children.find((child) => ruleName(outcome.parser, child) === "identifier");
    const name = textOf(nameCtx) || "Anonymous";

    let kind: TypeKind = "class";
    if (children.some((child) => ruleName(outcome.parser, child) === "INTERFACE"))
        kind = "interface";
    else if (children.some((child) => ruleName(outcome.parser, child) === "TRAIT")) kind = "trait";
    else if (children.some((child) => ruleName(outcome.parser, child) === "ENUM")) kind = "enum";

    const superTypes: string[] = [];
    for (const child of children) {
        const rule = ruleName(outcome.parser, child);
        if (rule === "type") superTypes.push(textOf(child));
        else if (rule === "typeList") {
            for (const type of childRulesNamed(outcome.parser, child, "type")) {
                superTypes.push(textOf(type));
            }
        }
    }

    const fqn = parent
        ? `${parent.fqn}.${name}`
        : file.packageName
          ? `${file.packageName}.${name}`
          : name;
    const typeInfo: TypeInfo = {
        fqn,
        name,
        kind,
        packageName: file.packageName,
        filePath: file.path,
        moduleId,
        annotations,
        modifiers,
        superTypes,
        fields: [],
        methods: [],
        nested: [],
        line: lineOf(ctx),
    };

    const body = firstChildRule(outcome.parser, ctx, "classBody");
    if (body) {
        for (const wrapper of childRules(body)) {
            const member =
                ruleName(outcome.parser, wrapper) === "classMember"
                    ? childRules(wrapper).find((child) =>
                          ["methodDecl", "fieldDecl", "classDecl", "block"].includes(
                              ruleName(outcome.parser, child),
                          ),
                      )
                    : wrapper;
            if (!member) continue;
            const rule = ruleName(outcome.parser, member);
            if (rule === "methodDecl")
                typeInfo.methods.push(extractMethod(outcome, member, typeInfo));
            else if (rule === "fieldDecl") {
                const field = extractField(outcome, member);
                if (field) typeInfo.fields.push(field);
            }
        }
    }

    return typeInfo;
};

const extractMethod = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
    typeInfo: TypeInfo,
): MethodInfo => {
    const children = childRules(ctx);
    const annotations: AnnotationInfo[] = [];
    const modifiers: string[] = [];
    for (const child of children) {
        const rule = ruleName(outcome.parser, child);
        if (rule === "annotation") annotations.push(parseAnnotation(textOf(child)));
        else if (rule === "modifier") modifiers.push(textOf(child));
    }

    const typeCtx = children.find((child) => ruleName(outcome.parser, child) === "type");
    const nameCtx = children.find((child) => ruleName(outcome.parser, child) === "identifier");
    const paramsCtx = firstChildRule(outcome.parser, ctx, "paramList");
    const block = firstChildRule(outcome.parser, ctx, "block");

    const name = textOf(nameCtx) || "<anonymous>";
    const params = paramsCtx ? extractParams(outcome, paramsCtx) : [];
    // Groovy 构造器没有返回类型，方法名与类名相同；否则会退化成普通方法，
    // `new Foo(...)` 永远解析不到目标。
    const isConstructor = typeCtx === undefined && name === typeInfo.name;

    return {
        id: `${typeInfo.fqn}#${name}/${params.length}`,
        name,
        ownerFqn: typeInfo.fqn,
        ownerSimpleName: typeInfo.name,
        ownerKind: typeInfo.kind,
        annotations,
        modifiers,
        returnType: isConstructor ? typeInfo.name : textOf(typeCtx) || "def",
        params,
        line: lineOf(ctx),
        endLine: block ? endLineOf(block) : lineOf(ctx),
        bodyStart: block ? startOffset(block) : undefined,
        bodyEnd: block ? endOffset(block) : undefined,
        calls: block ? scanGroovyCalls(outcome, block) : [],
        locals: block ? scanGroovyLocals(textOf(block), lineOf(block), params) : [],
        isConstructor,
        isAbstract: !block,
    };
};

const extractParams = (
    outcome: ParseOutcome<ParserRuleContext>,
    paramsCtx: ParserRuleContext,
): ParamInfo[] => {
    const params: ParamInfo[] = [];
    for (const param of childRulesNamed(outcome.parser, paramsCtx, "param")) {
        const children = childRules(param);
        const annotations: AnnotationInfo[] = [];
        for (const annotation of childRulesNamed(outcome.parser, param, "annotation")) {
            annotations.push(parseAnnotation(textOf(annotation)));
        }
        const typeCtx = children.find((child) => ruleName(outcome.parser, child) === "type");
        const nameCtx = children.find((child) => ruleName(outcome.parser, child) === "identifier");
        params.push({
            name: textOf(nameCtx),
            type: textOf(typeCtx),
            annotations,
        });
    }
    return params;
};

const extractField = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
): FieldInfo | undefined => {
    const children = childRules(ctx);
    const typeCtx = children.find((child) => ruleName(outcome.parser, child) === "type");
    const nameCtx = children.find((child) => ruleName(outcome.parser, child) === "identifier");
    if (!typeCtx || !nameCtx) return undefined;
    return {
        name: textOf(nameCtx),
        type: textOf(typeCtx),
        annotations: [],
        modifiers: [],
        line: lineOf(ctx),
    };
};

const scanGroovyCalls = (
    outcome: ParseOutcome<ParserRuleContext>,
    block: ParserRuleContext,
): CallSite[] => {
    return scanTokenCalls({
        tokens: outcome.visibleTokens,
        source: outcome.text,
        startTokenIndex: block.start?.tokenIndex ?? 0,
        endTokenIndex: block.stop?.tokenIndex ?? 0,
        keywords: KEYWORDS.groovy,
    });
};

const scanGroovyLocals = (text: string, startLine: number, params: ParamInfo[]): LocalVar[] => {
    const locals: LocalVar[] = params.map((param) => ({
        name: param.name,
        type: param.type || undefined,
        line: startLine,
    }));
    const pattern = /\b(?:def|[A-Z][\w$.]*(?:<[^>]*>)?(?:\[\])?)\s+([a-z_$][\w$]*)\s*=/g;
    for (const match of text.matchAll(pattern)) {
        const name = match[1];
        const type = simpleTypeName(
            match[0]
                .replace(/\b(def)\b/, "")
                .replace(/\s*=.*/s, "")
                .trim(),
        );
        if (name && !locals.some((local) => local.name === name)) {
            locals.push({ name, type: type || undefined, line: startLine });
        }
    }
    return locals;
};
