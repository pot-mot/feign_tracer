import type { Parser, ParserRuleContext } from "antlr4ng";
import { XMLLexer } from "../generated/xml/XMLLexer.ts";
import { XMLParser } from "../generated/xml/XMLParser.ts";
import { childRules, parseWith, ruleName, unquote } from "../languages/common.ts";

export interface XmlNode {
    name: string;
    attrs: Record<string, string>;
    text: string;
    children: XmlNode[];
}

export const parseXml = (source: string): { root: XmlNode | undefined; errors: string[] } => {
    const outcome = parseWith(XMLLexer, XMLParser, source, (parser) => parser.document());

    let element: ParserRuleContext | undefined;
    for (const child of childRules(outcome.tree)) {
        if (ruleName(outcome.parser, child) === "element") {
            element = child;
            break;
        }
    }
    return {
        root: element ? convertElement(outcome.parser, element) : undefined,
        errors: outcome.errors,
    };
};

const convertElement = (parser: Parser, ctx: ParserRuleContext): XmlNode => {
    const rawName = (ctx.getChild(1)?.getText() ?? "").trim();
    const attrs: Record<string, string> = {};
    const children: XmlNode[] = [];
    let text = "";

    for (const child of childRules(ctx)) {
        const rule = ruleName(parser, child);
        if (rule === "attribute") {
            const name = child.getChild(0)?.getText() ?? "";
            const value = unquote(child.getChild(2)?.getText() ?? "");
            if (name) attrs[name] = value;
        } else if (rule === "content") {
            for (const contentChild of childRules(child)) {
                const contentRule = ruleName(parser, contentChild);
                if (contentRule === "element") children.push(convertElement(parser, contentChild));
                else if (contentRule === "chardata") text += contentChild.getText();
            }
        }
    }

    return { name: rawName, attrs, text: text.trim(), children };
};

export const xmlChild = (node: XmlNode | undefined, name: string): XmlNode | undefined => {
    return node?.children.find((child) => child.name === name);
};

export const xmlChildren = (node: XmlNode | undefined, name: string): XmlNode[] => {
    return node?.children.filter((child) => child.name === name) ?? [];
};

export const xmlText = (node: XmlNode | undefined, name: string): string | undefined => {
    const found = xmlChild(node, name);
    return found?.text || undefined;
};
