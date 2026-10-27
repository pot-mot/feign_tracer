import type { Parser, ParserRuleContext } from "antlr4ng";
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
import { Java20Lexer } from "../generated/java/Java20Lexer.ts";
import { Java20Parser } from "../generated/java/Java20Parser.ts";
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
    splitTopLevel,
    startOffset,
    textOf,
    tokenIndexRange,
    walkTree,
    type ParseOutcome,
} from "./common.ts";
import { KEYWORDS, scanTokenCalls } from "./callscan.ts";

const TYPE_RULES = new Set([
    "normalClassDeclaration",
    "normalInterfaceDeclaration",
    "enumDeclaration",
    "recordDeclaration",
    "annotationInterfaceDeclaration",
]);

const TYPE_MODIFIER_RULES = new Set([
    "classModifier",
    "interfaceModifier",
    "recordModifier",
    "enumModifier",
    "constantModifier",
    "interfaceMethodModifier",
    "annotationInterfaceElementModifier",
    "variableModifier",
    "constructorModifier",
]);

const MEMBER_WRAPPERS = new Set([
    "classBodyDeclaration",
    "interfaceMemberDeclaration",
    "recordBodyDeclaration",
    "annotationInterfaceMemberDeclaration",
    "enumBodyDeclarations",
    "classMemberDeclaration",
]);

export const parseJavaFile = (absPath: string, relPath: string, moduleId?: string): ParsedFile => {
    const source = readFileSync(absPath, "utf8");
    const outcome = parseWith(Java20Lexer, Java20Parser, source, (parser) =>
        parser.compilationUnit(),
    );

    const file: ParsedFile = {
        path: relPath,
        absPath,
        language: "java",
        moduleId,
        packageName: "",
        imports: [],
        types: [],
        parseErrors: outcome.errors.length,
        lineCount: source.split(/\r?\n/).length,
    };

    const root = outcome.tree;
    const packageCtx = findFirstByRule(outcome, root, "packageDeclaration");
    if (packageCtx) file.packageName = packageText(textOf(packageCtx));

    for (const importCtx of findAllByRule(outcome, root, "importDeclaration")) {
        file.imports.push(parseJavaImport(textOf(importCtx)));
    }

    collectTypes(outcome, root, file, undefined, moduleId);
    return file;
};

const packageText = (text: string): string => {
    return text
        .replace(/^package/, "")
        .replace(/;$/, "")
        .trim();
};

const findFirstByRule = (
    outcome: ParseOutcome<ParserRuleContext>,
    root: ParserRuleContext,
    rule: string,
): ParserRuleContext | undefined => {
    let found: ParserRuleContext | undefined;
    walkTree(root, (node) => {
        if (!found && ruleName(outcome.parser, node) === rule) found = node;
    });
    return found;
};

const findAllByRule = (
    outcome: ParseOutcome<ParserRuleContext>,
    root: ParserRuleContext,
    rule: string,
): ParserRuleContext[] => {
    const found: ParserRuleContext[] = [];
    walkTree(root, (node) => {
        if (ruleName(outcome.parser, node) === rule) found.push(node);
    });
    return found;
};

/**
 * `textOf()` 不保留 token 之间的空格，`import static a.b.C.d;` 会变成
 * `importstatica.b.C.d;`，因此不能用 `"static "` 判断静态导入。
 * Java 里 `static` 是关键字，且只能紧跟在 `import` 之后，用前缀判断是安全的。
 */
const parseJavaImport = (text: string): ImportInfo => {
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
    moduleId?: string,
): void => {
    for (const child of childRules(ctx)) {
        const rule = ruleName(outcome.parser, child);
        if (TYPE_RULES.has(rule)) {
            const typeInfo = extractType(outcome, child, file, parent, moduleId);
            if (parent) parent.nested.push(typeInfo);
            else file.types.push(typeInfo);
            const body = findTypeBody(outcome.parser, child);
            if (body) collectTypes(outcome, body, file, typeInfo, moduleId);
            continue;
        }
        collectTypes(outcome, child, file, parent, moduleId);
    }
};

const findTypeBody = (parser: Parser, ctx: ParserRuleContext): ParserRuleContext | undefined => {
    return (
        firstChildRule(parser, ctx, "classBody") ??
        firstChildRule(parser, ctx, "interfaceBody") ??
        firstChildRule(parser, ctx, "enumBody") ??
        firstChildRule(parser, ctx, "recordBody") ??
        firstChildRule(parser, ctx, "annotationInterfaceBody")
    );
};

const extractType = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
    file: ParsedFile,
    parent: TypeInfo | undefined,
    moduleId?: string,
): TypeInfo => {
    const rule = ruleName(outcome.parser, ctx);
    const nameCtx = firstChildRule(outcome.parser, ctx, "typeIdentifier");
    const name = textOf(nameCtx) || "Anonymous";
    const kind: TypeKind =
        rule === "normalInterfaceDeclaration"
            ? "interface"
            : rule === "enumDeclaration"
              ? "enum"
              : rule === "recordDeclaration"
                ? "record"
                : rule === "annotationInterfaceDeclaration"
                  ? "annotation"
                  : "class";

    const annotations: AnnotationInfo[] = [];
    const modifiers: string[] = [];
    for (const child of childRules(ctx)) {
        const childRule = ruleName(outcome.parser, child);
        if (TYPE_MODIFIER_RULES.has(childRule)) {
            collectModifiers(outcome.parser, child, annotations, modifiers);
        }
    }

    const superTypes: string[] = [];
    for (const extendsCtx of childRulesNamed(outcome.parser, ctx, "classExtends")) {
        superTypes.push(...typeListFrom(textOf(extendsCtx), "extends"));
    }
    for (const extendsCtx of childRulesNamed(outcome.parser, ctx, "interfaceExtends")) {
        superTypes.push(...typeListFrom(textOf(extendsCtx), "extends"));
    }
    for (const implCtx of childRulesNamed(outcome.parser, ctx, "classImplements")) {
        superTypes.push(...typeListFrom(textOf(implCtx), "implements"));
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

    const body = findTypeBody(outcome.parser, ctx);
    if (body) extractMembers(outcome, body, typeInfo);
    return typeInfo;
};

const collectModifiers = (
    parser: Parser,
    ctx: ParserRuleContext,
    annotations: AnnotationInfo[],
    modifiers: string[],
): void => {
    for (const child of childRules(ctx)) {
        const rule = ruleName(parser, child);
        if (rule === "annotation" || rule.endsWith("Annotation")) {
            annotations.push(parseAnnotation(textOf(child)));
        } else if (!rule.endsWith("Modifier")) {
            const text = textOf(child);
            if (text && !text.startsWith("@")) modifiers.push(text);
        }
    }
    if (childRules(ctx).length === 0) {
        const text = textOf(ctx);
        if (text.startsWith("@")) annotations.push(parseAnnotation(text));
        else if (text) modifiers.push(text);
    }
};

const typeListFrom = (text: string, keyword: string): string[] => {
    const stripped = text.startsWith(keyword) ? text.slice(keyword.length) : text;
    return splitTopLevel(stripped)
        .map((item) => item.trim())
        .filter(Boolean);
};

const extractMembers = (
    outcome: ParseOutcome<ParserRuleContext>,
    body: ParserRuleContext,
    typeInfo: TypeInfo,
): void => {
    for (const wrapper of childRules(body)) {
        const member = unwrapMember(outcome.parser, wrapper);
        if (!member) continue;
        const rule = ruleName(outcome.parser, member);
        if (rule === "fieldDeclaration" || rule === "constantDeclaration") {
            typeInfo.fields.push(...extractFields(outcome, member));
        } else if (
            rule === "methodDeclaration" ||
            rule === "interfaceMethodDeclaration" ||
            rule === "annotationInterfaceElementDeclaration"
        ) {
            const method = extractMethod(outcome, member, typeInfo);
            if (method) typeInfo.methods.push(method);
        } else if (rule === "constructorDeclaration" || rule === "compactConstructorDeclaration") {
            const method = extractConstructor(outcome, member, typeInfo);
            if (method) typeInfo.methods.push(method);
        }
    }
};

const unwrapMember = (
    parser: Parser,
    wrapper: ParserRuleContext,
): ParserRuleContext | undefined => {
    let member = wrapper;
    for (let depth = 0; depth < 6; depth++) {
        const rule = ruleName(parser, member);
        if (!MEMBER_WRAPPERS.has(rule)) return member;
        const inner = childRules(member);
        if (inner.length === 0) return undefined;
        member = inner[0];
    }
    return member;
};

const extractFields = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
): FieldInfo[] => {
    const annotations: AnnotationInfo[] = [];
    const modifiers: string[] = [];
    for (const child of childRules(ctx)) {
        const rule = ruleName(outcome.parser, child);
        if (rule === "fieldModifier" || rule === "constantModifier") {
            collectModifiers(outcome.parser, child, annotations, modifiers);
        }
    }
    const typeCtx = firstChildRule(outcome.parser, ctx, "unannType");
    const type = textOf(typeCtx);
    const list = firstChildRule(outcome.parser, ctx, "variableDeclaratorList");
    if (!list) return [];

    const fields: FieldInfo[] = [];
    for (const declarator of childRulesNamed(outcome.parser, list, "variableDeclarator")) {
        const idCtx = firstChildRule(outcome.parser, declarator, "variableDeclaratorId");
        const name = textOf(idCtx).replace(/\[\s*\]/g, "");
        const init = childRules(declarator).find(
            (child) => ruleName(outcome.parser, child) === "variableInitializer",
        );
        fields.push({
            name,
            type,
            annotations: [...annotations],
            modifiers: [...modifiers],
            initializer: init ? textOf(init) : undefined,
            line: lineOf(declarator),
        });
    }
    return fields;
};

const extractMethod = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
    typeInfo: TypeInfo,
): MethodInfo | undefined => {
    const header = firstChildRule(outcome.parser, ctx, "methodHeader");
    if (!header) return undefined;

    const annotations: AnnotationInfo[] = [];
    const modifiers: string[] = [];
    for (const child of childRules(ctx)) {
        const rule = ruleName(outcome.parser, child);
        if (rule.endsWith("Modifier"))
            collectModifiers(outcome.parser, child, annotations, modifiers);
    }
    for (const annotation of childRulesNamed(outcome.parser, header, "annotation")) {
        annotations.push(parseAnnotation(textOf(annotation)));
    }

    const declarator = firstChildRule(outcome.parser, header, "methodDeclarator");
    if (!declarator) return undefined;
    const nameCtx = firstChildRule(outcome.parser, declarator, "identifier");
    const name = textOf(nameCtx);
    const params = extractParams(outcome, declarator);
    const resultCtx = firstChildRule(outcome.parser, header, "result");
    const returnType = textOf(resultCtx) || "void";
    const body = firstChildRule(outcome.parser, ctx, "methodBody");
    const block = body ? firstChildRule(outcome.parser, body, "block") : undefined;

    const isAbstract =
        !block ||
        modifiers.includes("abstract") ||
        (typeInfo.kind === "interface" &&
            !modifiers.includes("default") &&
            !modifiers.includes("static") &&
            !modifiers.includes("private"));

    return {
        id: `${typeInfo.fqn}#${name}/${params.length}`,
        name,
        ownerFqn: typeInfo.fqn,
        ownerSimpleName: typeInfo.name,
        ownerKind: typeInfo.kind,
        annotations,
        modifiers,
        returnType,
        params,
        line: lineOf(ctx),
        endLine: block ? endLineOf(block) : lineOf(ctx),
        bodyStart: block ? startOffset(block) : undefined,
        bodyEnd: block ? endOffset(block) : undefined,
        calls: block ? extractCalls(outcome, block) : [],
        locals: block ? extractLocals(outcome, block) : [],
        isConstructor: false,
        isAbstract,
    };
};

const extractConstructor = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
    typeInfo: TypeInfo,
): MethodInfo | undefined => {
    const annotations: AnnotationInfo[] = [];
    const modifiers: string[] = [];
    for (const child of childRules(ctx)) {
        if (ruleName(outcome.parser, child).endsWith("Modifier")) {
            collectModifiers(outcome.parser, child, annotations, modifiers);
        }
    }
    const declarator =
        firstChildRule(outcome.parser, ctx, "constructorDeclarator") ??
        firstChildRule(outcome.parser, ctx, "simpleTypeName");
    if (!declarator) return undefined;

    const params = extractParams(outcome, declarator);
    const body =
        firstChildRule(outcome.parser, ctx, "constructorBody") ??
        firstChildRule(outcome.parser, ctx, "block");
    const name = typeInfo.name;

    return {
        id: `${typeInfo.fqn}#${name}/${params.length}`,
        name,
        ownerFqn: typeInfo.fqn,
        ownerSimpleName: typeInfo.name,
        ownerKind: typeInfo.kind,
        annotations,
        modifiers,
        returnType: name,
        params,
        line: lineOf(ctx),
        endLine: body ? endLineOf(body) : lineOf(ctx),
        bodyStart: body ? startOffset(body) : undefined,
        bodyEnd: body ? endOffset(body) : undefined,
        calls: body ? extractCalls(outcome, body) : [],
        locals: body ? extractLocals(outcome, body) : [],
        isConstructor: true,
        isAbstract: false,
    };
};

const extractParams = (
    outcome: ParseOutcome<ParserRuleContext>,
    declarator: ParserRuleContext,
): ParamInfo[] => {
    const list = firstChildRule(outcome.parser, declarator, "formalParameterList");
    if (!list) return [];

    const params: ParamInfo[] = [];
    for (const paramCtx of childRules(list)) {
        const rule = ruleName(outcome.parser, paramCtx);
        if (rule !== "formalParameter" && rule !== "variableArityParameter") continue;

        const annotations: AnnotationInfo[] = [];
        for (const modifier of childRulesNamed(outcome.parser, paramCtx, "variableModifier")) {
            collectModifiers(outcome.parser, modifier, annotations, []);
        }
        for (const annotation of childRulesNamed(outcome.parser, paramCtx, "annotation")) {
            annotations.push(parseAnnotation(textOf(annotation)));
        }

        const typeCtx = firstChildRule(outcome.parser, paramCtx, "unannType");
        const idCtx =
            firstChildRule(outcome.parser, paramCtx, "variableDeclaratorId") ??
            firstChildRule(outcome.parser, paramCtx, "identifier");
        params.push({
            name: textOf(idCtx).replace(/\[\s*\]/g, ""),
            type: textOf(typeCtx),
            annotations,
        });
    }
    return params;
};

const extractCalls = (
    outcome: ParseOutcome<ParserRuleContext>,
    body: ParserRuleContext,
): CallSite[] => {
    const [start, end] = tokenIndexRange(body);
    return scanTokenCalls({
        tokens: outcome.visibleTokens,
        source: outcome.text,
        startTokenIndex: start,
        endTokenIndex: end,
        keywords: KEYWORDS.java,
    });
};

const extractLocals = (
    outcome: ParseOutcome<ParserRuleContext>,
    body: ParserRuleContext,
): LocalVar[] => {
    const locals: LocalVar[] = [];
    walkTree(body, (node) => {
        const rule = ruleName(outcome.parser, node);
        if (rule === "localVariableDeclaration") {
            const typeCtx = firstChildRule(outcome.parser, node, "localVariableType");
            let type = textOf(typeCtx);
            if (type === "var") type = "";
            const list = firstChildRule(outcome.parser, node, "variableDeclaratorList");
            if (!list) return;
            for (const declarator of childRulesNamed(outcome.parser, list, "variableDeclarator")) {
                const id = firstChildRule(outcome.parser, declarator, "variableDeclaratorId");
                locals.push({
                    name: textOf(id).replace(/\[\s*\]/g, ""),
                    type: type || undefined,
                    line: lineOf(declarator),
                });
            }
        } else if (rule === "catchFormalParameter") {
            const typeCtx = firstChildRule(outcome.parser, node, "catchType");
            const id = firstChildRule(outcome.parser, node, "variableDeclaratorId");
            locals.push({
                name: textOf(id),
                type: textOf(typeCtx),
                line: lineOf(node),
            });
        }
    });
    return locals;
};
