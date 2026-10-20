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
import { KotlinLexer } from "../generated/kotlin/KotlinLexer.ts";
import { KotlinParser } from "../generated/kotlin/KotlinParser.ts";
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
    startOffset,
    textOf,
    walkTree,
    type ParseOutcome,
} from "./common.ts";
import { KEYWORDS, scanTokenCalls } from "./callscan.ts";
import { visibleTokens } from "./common.ts";

const TYPE_RULES = new Set(["classDeclaration", "objectDeclaration", "companionObject"]);

export const parseKotlinFile = (
    absPath: string,
    relPath: string,
    moduleId?: string,
): ParsedFile => {
    const source = readFileSync(absPath, "utf8");
    const outcome = parseWith(KotlinLexer, KotlinParser, source, (parser) => parser.kotlinFile());

    const file: ParsedFile = {
        path: relPath,
        absPath,
        language: "kotlin",
        moduleId,
        packageName: "",
        imports: [],
        types: [],
        parseErrors: outcome.errors.length,
        lineCount: source.split(/\r?\n/).length,
    };

    const packageCtx = findFirst(outcome, outcome.tree, "packageHeader");
    if (packageCtx) {
        file.packageName = textOf(packageCtx)
            .replace(/^package/, "")
            .replace(/;$/, "")
            .trim();
    }

    for (const importCtx of findEvery(outcome, outcome.tree, "importHeader")) {
        file.imports.push(parseKotlinImport(textOf(importCtx)));
    }

    collectTypes(outcome, outcome.tree, file, undefined, moduleId);
    return file;
};

const findFirst = (
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

const findEvery = (
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

const parseKotlinImport = (text: string): ImportInfo => {
    let value = text
        .replace(/^import/, "")
        .replace(/;$/, "")
        .trim();
    let alias: string | undefined;
    const asMatch = value.match(/\s+as\s+([A-Za-z_][\w]*)$/);
    if (asMatch) {
        alias = asMatch[1];
        value = value.slice(0, asMatch.index).trim();
    }
    const wildcard = value.endsWith(".*") || value.endsWith("*");
    if (wildcard) value = value.replace(/\.?\*$/, "");
    return { name: value, alias, static: false, wildcard };
};

const collectTypes = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
    file: ParsedFile,
    parent: TypeInfo | undefined,
    moduleId?: string,
): void => {
    for (const child of childRules(ctx)) {
        if (TYPE_RULES.has(ruleName(outcome.parser, child))) {
            const typeInfo = extractType(outcome, child, file, parent, moduleId);
            if (parent) parent.nested.push(typeInfo);
            else file.types.push(typeInfo);
            const body =
                firstChildRule(outcome.parser, child, "classBody") ??
                firstChildRule(outcome.parser, child, "enumClassBody");
            if (body) collectTypes(outcome, body, file, typeInfo, moduleId);
            continue;
        }
        collectTypes(outcome, child, file, parent, moduleId);
    }
};

const extractType = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
    file: ParsedFile,
    parent: TypeInfo | undefined,
    moduleId?: string,
): TypeInfo => {
    const rule = ruleName(outcome.parser, ctx);
    const modifierList = firstChildRule(outcome.parser, ctx, "modifierList");
    const annotations = modifierList ? annotationsOf(outcome, modifierList) : [];
    const modifiers = modifierList ? modifiersOf(outcome, modifierList) : [];

    let name = "Companion";
    let kind: TypeKind = "object";
    if (rule === "classDeclaration") {
        const nameCtx = childRules(ctx).find(
            (child) => ruleName(outcome.parser, child) === "simpleIdentifier",
        );
        name = textOf(nameCtx) || "Anonymous";
        const hasInterface = childRules(ctx).some(
            (child) => ruleName(outcome.parser, child) === "INTERFACE",
        );
        kind = hasInterface ? "interface" : "class";
    } else if (rule === "objectDeclaration") {
        const nameCtx = childRules(ctx).find(
            (child) => ruleName(outcome.parser, child) === "simpleIdentifier",
        );
        name = textOf(nameCtx) || "Companion";
        kind = "object";
    } else {
        const nameCtx = childRules(ctx).find(
            (child) => ruleName(outcome.parser, child) === "simpleIdentifier",
        );
        name = textOf(nameCtx) || "Companion";
        kind = "object";
    }

    const superTypes: string[] = [];
    const delegation = firstChildRule(outcome.parser, ctx, "delegationSpecifiers");
    if (delegation) {
        for (const specifier of childRulesNamed(
            outcome.parser,
            delegation,
            "delegationSpecifier",
        )) {
            const userType = findFirst(outcome, specifier, "userType");
            if (userType) superTypes.push(textOf(userType));
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

    const primary = firstChildRule(outcome.parser, ctx, "primaryConstructor");
    if (primary) {
        for (const field of extractConstructorProperties(outcome, primary)) {
            typeInfo.fields.push(field);
        }
    }

    const body =
        firstChildRule(outcome.parser, ctx, "classBody") ??
        firstChildRule(outcome.parser, ctx, "enumClassBody");
    if (body) extractMembers(outcome, body, typeInfo);

    return typeInfo;
};

const annotationsOf = (
    outcome: ParseOutcome<ParserRuleContext>,
    modifierList: ParserRuleContext,
): AnnotationInfo[] => {
    const result: AnnotationInfo[] = [];
    for (const annotations of childRulesNamed(outcome.parser, modifierList, "annotations")) {
        const walkAnnotations = (node: ParserRuleContext) => {
            for (const child of childRules(node)) {
                const rule = ruleName(outcome.parser, child);
                if (rule === "annotation" || rule === "unescapedAnnotation") {
                    const parsed = parseAnnotation(textOf(child));
                    if (
                        !result.some((item) => item.raw === parsed.raw && item.name === parsed.name)
                    ) {
                        result.push(parsed);
                    }
                } else {
                    walkAnnotations(child);
                }
            }
        };
        walkAnnotations(annotations);
    }
    return result;
};

const modifiersOf = (
    outcome: ParseOutcome<ParserRuleContext>,
    modifierList: ParserRuleContext,
): string[] => {
    const result: string[] = [];
    for (const child of childRules(modifierList)) {
        const rule = ruleName(outcome.parser, child);
        if (rule === "modifier" || rule === "visibilityModifier" || rule === "classModifier") {
            const text = textOf(child);
            if (text && !text.startsWith("@")) result.push(text);
        }
    }
    return result;
};

const extractConstructorProperties = (
    outcome: ParseOutcome<ParserRuleContext>,
    primary: ParserRuleContext,
): FieldInfo[] => {
    const params = firstChildRule(outcome.parser, primary, "classParameters");
    if (!params) return [];
    const fields: FieldInfo[] = [];

    for (const classParam of childRulesNamed(outcome.parser, params, "classParameter")) {
        const isProperty = (classParam.children ?? []).some((child) => {
            const text = child.getText();
            return text === "val" || text === "var";
        });
        if (!isProperty) continue;
        const modifierList = firstChildRule(outcome.parser, classParam, "modifierList");
        const nameCtx = firstChildRule(outcome.parser, classParam, "simpleIdentifier");
        const typeCtx = firstChildRule(outcome.parser, classParam, "type");
        fields.push({
            name: textOf(nameCtx),
            type: textOf(typeCtx),
            annotations: modifierList ? annotationsOf(outcome, modifierList) : [],
            modifiers: modifierList ? modifiersOf(outcome, modifierList) : [],
            line: lineOf(classParam),
        });
    }
    return fields;
};

const extractMembers = (
    outcome: ParseOutcome<ParserRuleContext>,
    body: ParserRuleContext,
    typeInfo: TypeInfo,
): void => {
    for (const wrapper of childRules(body)) {
        if (ruleName(outcome.parser, wrapper) !== "classMemberDeclaration") continue;
        const member = childRules(wrapper).find((child) => {
            const rule = ruleName(outcome.parser, child);
            return !["anysemi", "semi"].includes(rule);
        });
        if (!member) continue;

        const rule = ruleName(outcome.parser, member);
        if (rule === "functionDeclaration") {
            typeInfo.methods.push(extractFunction(outcome, member, typeInfo));
        } else if (rule === "propertyDeclaration") {
            const field = extractProperty(outcome, member);
            if (field) typeInfo.fields.push(field);
            const setter = firstChildRule(outcome.parser, member, "setter");
            if (setter) {
                const block = findFirst(outcome, setter, "block");
                if (block) {
                    typeInfo.methods.push(
                        propertyAccessorMethod(outcome, member, typeInfo, "set", block),
                    );
                }
            }
        } else if (rule === "secondaryConstructor") {
            typeInfo.methods.push(extractSecondaryConstructor(outcome, member, typeInfo));
        }
    }
};

const extractFunction = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
    typeInfo: TypeInfo,
): MethodInfo => {
    const modifierList = firstChildRule(outcome.parser, ctx, "functionModifierList");
    const annotations = modifierList ? annotationsOf(outcome, modifierList) : [];
    const modifiers = modifierList ? modifiersOf(outcome, modifierList) : [];

    const nameCtx = childRules(ctx).find(
        (child) => ruleName(outcome.parser, child) === "identifier",
    );
    const name = textOf(nameCtx) || "<anonymous>";

    const paramsCtx = firstChildRule(outcome.parser, ctx, "functionValueParameters");
    const params = paramsCtx ? extractKotlinParams(outcome, paramsCtx) : [];

    const children = childRules(ctx);
    const paramsIndex = paramsCtx ? children.indexOf(paramsCtx) : -1;
    let returnType = "Unit";
    for (let i = paramsIndex + 1; i < children.length; i++) {
        if (ruleName(outcome.parser, children[i]) === "type") {
            returnType = textOf(children[i]);
            break;
        }
    }

    const functionBody = firstChildRule(outcome.parser, ctx, "functionBody");
    const bodyNode = functionBody ?? undefined;
    const isAbstract = !functionBody;

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
        endLine: functionBody ? endLineOf(functionBody) : lineOf(ctx),
        bodyStart: bodyNode ? startOffset(bodyNode) : undefined,
        bodyEnd: bodyNode ? endOffset(bodyNode) : undefined,
        calls: bodyNode ? extractCalls(outcome, bodyNode) : [],
        locals: bodyNode ? extractLocals(outcome, bodyNode) : [],
        isConstructor: false,
        isAbstract,
    };
};

const extractKotlinParams = (
    outcome: ParseOutcome<ParserRuleContext>,
    paramsCtx: ParserRuleContext,
): ParamInfo[] => {
    const params: ParamInfo[] = [];
    for (const wrapper of childRulesNamed(outcome.parser, paramsCtx, "functionValueParameter")) {
        const parameter = firstChildRule(outcome.parser, wrapper, "parameter");
        if (!parameter) continue;
        const modifierList = firstChildRule(outcome.parser, wrapper, "modifierList");
        const nameCtx = firstChildRule(outcome.parser, parameter, "simpleIdentifier");
        const typeCtx = firstChildRule(outcome.parser, parameter, "type");
        params.push({
            name: textOf(nameCtx),
            type: textOf(typeCtx),
            annotations: modifierList ? annotationsOf(outcome, modifierList) : [],
        });
    }
    return params;
};

const extractProperty = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
): FieldInfo | undefined => {
    const modifierList = firstChildRule(outcome.parser, ctx, "modifierList");
    const variable = firstChildRule(outcome.parser, ctx, "variableDeclaration");
    if (!variable) return undefined;
    const nameCtx = firstChildRule(outcome.parser, variable, "simpleIdentifier");
    const typeCtx = firstChildRule(outcome.parser, variable, "type");
    return {
        name: textOf(nameCtx),
        type: textOf(typeCtx),
        annotations: modifierList ? annotationsOf(outcome, modifierList) : [],
        modifiers: modifierList ? modifiersOf(outcome, modifierList) : [],
        line: lineOf(ctx),
    };
};

const propertyAccessorMethod = (
    outcome: ParseOutcome<ParserRuleContext>,
    property: ParserRuleContext,
    typeInfo: TypeInfo,
    kind: "get" | "set",
    block: ParserRuleContext,
): MethodInfo => {
    const variable = firstChildRule(outcome.parser, property, "variableDeclaration");
    const name = textOf(
        variable ? firstChildRule(outcome.parser, variable, "simpleIdentifier") : undefined,
    );
    const name2 = kind === "get" ? `get${capitalize(name)}` : `set${capitalize(name)}`;
    return {
        id: `${typeInfo.fqn}#${name2}/0`,
        name: name2,
        ownerFqn: typeInfo.fqn,
        ownerSimpleName: typeInfo.name,
        ownerKind: typeInfo.kind,
        annotations: [],
        modifiers: [],
        returnType: "Unit",
        params: [],
        line: lineOf(block),
        endLine: endLineOf(block),
        bodyStart: startOffset(block),
        bodyEnd: endOffset(block),
        calls: extractCalls(outcome, block),
        locals: extractLocals(outcome, block),
        isConstructor: false,
        isAbstract: false,
    };
};

const extractSecondaryConstructor = (
    outcome: ParseOutcome<ParserRuleContext>,
    ctx: ParserRuleContext,
    typeInfo: TypeInfo,
): MethodInfo => {
    const modifierList = firstChildRule(outcome.parser, ctx, "modifierList");
    const paramsCtx = firstChildRule(outcome.parser, ctx, "functionValueParameters");
    const params = paramsCtx ? extractKotlinParams(outcome, paramsCtx) : [];
    const block = firstChildRule(outcome.parser, ctx, "block");
    return {
        id: `${typeInfo.fqn}#${typeInfo.name}/${params.length}`,
        name: typeInfo.name,
        ownerFqn: typeInfo.fqn,
        ownerSimpleName: typeInfo.name,
        ownerKind: typeInfo.kind,
        annotations: modifierList ? annotationsOf(outcome, modifierList) : [],
        modifiers: modifierList ? modifiersOf(outcome, modifierList) : [],
        returnType: typeInfo.name,
        params,
        line: lineOf(ctx),
        endLine: block ? endLineOf(block) : lineOf(ctx),
        bodyStart: block ? startOffset(block) : undefined,
        bodyEnd: block ? endOffset(block) : undefined,
        calls: block ? extractCalls(outcome, block) : [],
        locals: block ? extractLocals(outcome, block) : [],
        isConstructor: true,
        isAbstract: false,
    };
};

const capitalize = (value: string): string => {
    return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
};

const extractCalls = (
    outcome: ParseOutcome<ParserRuleContext>,
    body: ParserRuleContext,
): CallSite[] => {
    return scanTokenCalls({
        tokens: visibleTokens(outcome.tokens),
        source: outcome.text,
        startTokenIndex: body.start?.tokenIndex ?? 0,
        endTokenIndex: body.stop?.tokenIndex ?? 0,
        keywords: KEYWORDS.kotlin,
    });
};

const extractLocals = (
    outcome: ParseOutcome<ParserRuleContext>,
    body: ParserRuleContext,
): LocalVar[] => {
    const locals: LocalVar[] = [];
    walkTree(body, (node) => {
        const rule = ruleName(outcome.parser, node);
        if (rule === "propertyDeclaration") {
            const variable = firstChildRule(outcome.parser, node, "variableDeclaration");
            if (!variable) return;
            const name = textOf(firstChildRule(outcome.parser, variable, "simpleIdentifier"));
            const type = textOf(firstChildRule(outcome.parser, variable, "type"));
            locals.push({ name, type: type || undefined, line: lineOf(node) });
        } else if (rule === "parameter") {
            const name = textOf(firstChildRule(outcome.parser, node, "simpleIdentifier"));
            const type = textOf(firstChildRule(outcome.parser, node, "type"));
            if (name) locals.push({ name, type: type || undefined, line: lineOf(node) });
        }
    });
    return locals;
};
