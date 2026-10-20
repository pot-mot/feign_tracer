// @ts-nocheck

import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { XMLParserListener } from "./XMLParserListener.js";
import { XMLParserVisitor } from "./XMLParserVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class XMLParser extends antlr.Parser {
    public static readonly COMMENT = 1;
    public static readonly CDATA = 2;
    public static readonly DTD = 3;
    public static readonly EntityRef = 4;
    public static readonly CharRef = 5;
    public static readonly SEA_WS = 6;
    public static readonly OPEN = 7;
    public static readonly XMLDeclOpen = 8;
    public static readonly TEXT = 9;
    public static readonly CLOSE = 10;
    public static readonly SPECIAL_CLOSE = 11;
    public static readonly SLASH_CLOSE = 12;
    public static readonly SLASH = 13;
    public static readonly EQUALS = 14;
    public static readonly STRING = 15;
    public static readonly Name = 16;
    public static readonly S = 17;
    public static readonly PI = 18;
    public static readonly RULE_document = 0;
    public static readonly RULE_prolog = 1;
    public static readonly RULE_content = 2;
    public static readonly RULE_element = 3;
    public static readonly RULE_reference = 4;
    public static readonly RULE_attribute = 5;
    public static readonly RULE_chardata = 6;
    public static readonly RULE_misc = 7;

    public static readonly literalNames = [
        null, null, null, null, null, null, null, "'<'", null, null, "'>'", 
        null, "'/>'", "'/'", "'='"
    ];

    public static readonly symbolicNames = [
        null, "COMMENT", "CDATA", "DTD", "EntityRef", "CharRef", "SEA_WS", 
        "OPEN", "XMLDeclOpen", "TEXT", "CLOSE", "SPECIAL_CLOSE", "SLASH_CLOSE", 
        "SLASH", "EQUALS", "STRING", "Name", "S", "PI"
    ];
    public static readonly ruleNames = [
        "document", "prolog", "content", "element", "reference", "attribute", 
        "chardata", "misc",
    ];

    public get grammarFileName(): string { return "XMLParser.g4"; }
    public get literalNames(): (string | null)[] { return XMLParser.literalNames; }
    public get symbolicNames(): (string | null)[] { return XMLParser.symbolicNames; }
    public get ruleNames(): string[] { return XMLParser.ruleNames; }
    public get serializedATN(): number[] { return XMLParser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, XMLParser._ATN, XMLParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public document(): DocumentContext {
        let localContext = new DocumentContext(this.context, this.state);
        this.enterRule(localContext, 0, XMLParser.RULE_document);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 17;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 8) {
                {
                this.state = 16;
                this.prolog();
                }
            }

            this.state = 22;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 262210) !== 0)) {
                {
                {
                this.state = 19;
                this.misc();
                }
                }
                this.state = 24;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 25;
            this.element();
            this.state = 29;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 262210) !== 0)) {
                {
                {
                this.state = 26;
                this.misc();
                }
                }
                this.state = 31;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 32;
            this.match(XMLParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public prolog(): PrologContext {
        let localContext = new PrologContext(this.context, this.state);
        this.enterRule(localContext, 2, XMLParser.RULE_prolog);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 34;
            this.match(XMLParser.XMLDeclOpen);
            this.state = 38;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 16) {
                {
                {
                this.state = 35;
                this.attribute();
                }
                }
                this.state = 40;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 41;
            this.match(XMLParser.SPECIAL_CLOSE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public content(): ContentContext {
        let localContext = new ContentContext(this.context, this.state);
        this.enterRule(localContext, 4, XMLParser.RULE_content);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 44;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 6 || _la === 9) {
                {
                this.state = 43;
                this.chardata();
                }
            }

            this.state = 58;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 7, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 51;
                    this.errorHandler.sync(this);
                    switch (this.tokenStream.LA(1)) {
                    case XMLParser.OPEN:
                        {
                        this.state = 46;
                        this.element();
                        }
                        break;
                    case XMLParser.EntityRef:
                    case XMLParser.CharRef:
                        {
                        this.state = 47;
                        this.reference();
                        }
                        break;
                    case XMLParser.CDATA:
                        {
                        this.state = 48;
                        this.match(XMLParser.CDATA);
                        }
                        break;
                    case XMLParser.PI:
                        {
                        this.state = 49;
                        this.match(XMLParser.PI);
                        }
                        break;
                    case XMLParser.COMMENT:
                        {
                        this.state = 50;
                        this.match(XMLParser.COMMENT);
                        }
                        break;
                    default:
                        throw new antlr.NoViableAltException(this);
                    }
                    this.state = 54;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 6 || _la === 9) {
                        {
                        this.state = 53;
                        this.chardata();
                        }
                    }

                    }
                    }
                }
                this.state = 60;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 7, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public element(): ElementContext {
        let localContext = new ElementContext(this.context, this.state);
        this.enterRule(localContext, 6, XMLParser.RULE_element);
        let _la: number;
        try {
            this.state = 85;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 10, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 61;
                this.match(XMLParser.OPEN);
                this.state = 62;
                this.match(XMLParser.Name);
                this.state = 66;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 16) {
                    {
                    {
                    this.state = 63;
                    this.attribute();
                    }
                    }
                    this.state = 68;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 69;
                this.match(XMLParser.CLOSE);
                this.state = 70;
                this.content();
                this.state = 71;
                this.match(XMLParser.OPEN);
                this.state = 72;
                this.match(XMLParser.SLASH);
                this.state = 73;
                this.match(XMLParser.Name);
                this.state = 74;
                this.match(XMLParser.CLOSE);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 76;
                this.match(XMLParser.OPEN);
                this.state = 77;
                this.match(XMLParser.Name);
                this.state = 81;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 16) {
                    {
                    {
                    this.state = 78;
                    this.attribute();
                    }
                    }
                    this.state = 83;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 84;
                this.match(XMLParser.SLASH_CLOSE);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public reference(): ReferenceContext {
        let localContext = new ReferenceContext(this.context, this.state);
        this.enterRule(localContext, 8, XMLParser.RULE_reference);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 87;
            _la = this.tokenStream.LA(1);
            if(!(_la === 4 || _la === 5)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public attribute(): AttributeContext {
        let localContext = new AttributeContext(this.context, this.state);
        this.enterRule(localContext, 10, XMLParser.RULE_attribute);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 89;
            this.match(XMLParser.Name);
            this.state = 90;
            this.match(XMLParser.EQUALS);
            this.state = 91;
            this.match(XMLParser.STRING);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public chardata(): ChardataContext {
        let localContext = new ChardataContext(this.context, this.state);
        this.enterRule(localContext, 12, XMLParser.RULE_chardata);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 93;
            _la = this.tokenStream.LA(1);
            if(!(_la === 6 || _la === 9)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public misc(): MiscContext {
        let localContext = new MiscContext(this.context, this.state);
        this.enterRule(localContext, 14, XMLParser.RULE_misc);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 95;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 262210) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public static readonly _serializedATN: number[] = [
        4,1,18,98,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,1,0,3,0,18,8,0,1,0,5,0,21,8,0,10,0,12,0,24,9,0,1,0,1,0,
        5,0,28,8,0,10,0,12,0,31,9,0,1,0,1,0,1,1,1,1,5,1,37,8,1,10,1,12,1,
        40,9,1,1,1,1,1,1,2,3,2,45,8,2,1,2,1,2,1,2,1,2,1,2,3,2,52,8,2,1,2,
        3,2,55,8,2,5,2,57,8,2,10,2,12,2,60,9,2,1,3,1,3,1,3,5,3,65,8,3,10,
        3,12,3,68,9,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,5,3,80,8,3,
        10,3,12,3,83,9,3,1,3,3,3,86,8,3,1,4,1,4,1,5,1,5,1,5,1,5,1,6,1,6,
        1,7,1,7,1,7,0,0,8,0,2,4,6,8,10,12,14,0,3,1,0,4,5,2,0,6,6,9,9,3,0,
        1,1,6,6,18,18,103,0,17,1,0,0,0,2,34,1,0,0,0,4,44,1,0,0,0,6,85,1,
        0,0,0,8,87,1,0,0,0,10,89,1,0,0,0,12,93,1,0,0,0,14,95,1,0,0,0,16,
        18,3,2,1,0,17,16,1,0,0,0,17,18,1,0,0,0,18,22,1,0,0,0,19,21,3,14,
        7,0,20,19,1,0,0,0,21,24,1,0,0,0,22,20,1,0,0,0,22,23,1,0,0,0,23,25,
        1,0,0,0,24,22,1,0,0,0,25,29,3,6,3,0,26,28,3,14,7,0,27,26,1,0,0,0,
        28,31,1,0,0,0,29,27,1,0,0,0,29,30,1,0,0,0,30,32,1,0,0,0,31,29,1,
        0,0,0,32,33,5,0,0,1,33,1,1,0,0,0,34,38,5,8,0,0,35,37,3,10,5,0,36,
        35,1,0,0,0,37,40,1,0,0,0,38,36,1,0,0,0,38,39,1,0,0,0,39,41,1,0,0,
        0,40,38,1,0,0,0,41,42,5,11,0,0,42,3,1,0,0,0,43,45,3,12,6,0,44,43,
        1,0,0,0,44,45,1,0,0,0,45,58,1,0,0,0,46,52,3,6,3,0,47,52,3,8,4,0,
        48,52,5,2,0,0,49,52,5,18,0,0,50,52,5,1,0,0,51,46,1,0,0,0,51,47,1,
        0,0,0,51,48,1,0,0,0,51,49,1,0,0,0,51,50,1,0,0,0,52,54,1,0,0,0,53,
        55,3,12,6,0,54,53,1,0,0,0,54,55,1,0,0,0,55,57,1,0,0,0,56,51,1,0,
        0,0,57,60,1,0,0,0,58,56,1,0,0,0,58,59,1,0,0,0,59,5,1,0,0,0,60,58,
        1,0,0,0,61,62,5,7,0,0,62,66,5,16,0,0,63,65,3,10,5,0,64,63,1,0,0,
        0,65,68,1,0,0,0,66,64,1,0,0,0,66,67,1,0,0,0,67,69,1,0,0,0,68,66,
        1,0,0,0,69,70,5,10,0,0,70,71,3,4,2,0,71,72,5,7,0,0,72,73,5,13,0,
        0,73,74,5,16,0,0,74,75,5,10,0,0,75,86,1,0,0,0,76,77,5,7,0,0,77,81,
        5,16,0,0,78,80,3,10,5,0,79,78,1,0,0,0,80,83,1,0,0,0,81,79,1,0,0,
        0,81,82,1,0,0,0,82,84,1,0,0,0,83,81,1,0,0,0,84,86,5,12,0,0,85,61,
        1,0,0,0,85,76,1,0,0,0,86,7,1,0,0,0,87,88,7,0,0,0,88,9,1,0,0,0,89,
        90,5,16,0,0,90,91,5,14,0,0,91,92,5,15,0,0,92,11,1,0,0,0,93,94,7,
        1,0,0,94,13,1,0,0,0,95,96,7,2,0,0,96,15,1,0,0,0,11,17,22,29,38,44,
        51,54,58,66,81,85
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!XMLParser.__ATN) {
            XMLParser.__ATN = new antlr.ATNDeserializer().deserialize(XMLParser._serializedATN);
        }

        return XMLParser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(XMLParser.literalNames, XMLParser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return XMLParser.vocabulary;
    }

    private static readonly decisionsToDFA = XMLParser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class DocumentContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public element(): ElementContext {
        return this.getRuleContext(0, ElementContext)!;
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(XMLParser.EOF, 0)!;
    }
    public prolog(): PrologContext | null {
        return this.getRuleContext(0, PrologContext);
    }
    public misc(): MiscContext[];
    public misc(i: number): MiscContext | null;
    public misc(i?: number): MiscContext[] | MiscContext | null {
        if (i === undefined) {
            return this.getRuleContexts(MiscContext);
        }

        return this.getRuleContext(i, MiscContext);
    }
    public override get ruleIndex(): number {
        return XMLParser.RULE_document;
    }
    public override enterRule(listener: XMLParserListener): void {
        if(listener.enterDocument) {
             listener.enterDocument(this);
        }
    }
    public override exitRule(listener: XMLParserListener): void {
        if(listener.exitDocument) {
             listener.exitDocument(this);
        }
    }
    public override accept<Result>(visitor: XMLParserVisitor<Result>): Result | null {
        if (visitor.visitDocument) {
            return visitor.visitDocument(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PrologContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public XMLDeclOpen(): antlr.TerminalNode {
        return this.getToken(XMLParser.XMLDeclOpen, 0)!;
    }
    public SPECIAL_CLOSE(): antlr.TerminalNode {
        return this.getToken(XMLParser.SPECIAL_CLOSE, 0)!;
    }
    public attribute(): AttributeContext[];
    public attribute(i: number): AttributeContext | null;
    public attribute(i?: number): AttributeContext[] | AttributeContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AttributeContext);
        }

        return this.getRuleContext(i, AttributeContext);
    }
    public override get ruleIndex(): number {
        return XMLParser.RULE_prolog;
    }
    public override enterRule(listener: XMLParserListener): void {
        if(listener.enterProlog) {
             listener.enterProlog(this);
        }
    }
    public override exitRule(listener: XMLParserListener): void {
        if(listener.exitProlog) {
             listener.exitProlog(this);
        }
    }
    public override accept<Result>(visitor: XMLParserVisitor<Result>): Result | null {
        if (visitor.visitProlog) {
            return visitor.visitProlog(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ContentContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public chardata(): ChardataContext[];
    public chardata(i: number): ChardataContext | null;
    public chardata(i?: number): ChardataContext[] | ChardataContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ChardataContext);
        }

        return this.getRuleContext(i, ChardataContext);
    }
    public element(): ElementContext[];
    public element(i: number): ElementContext | null;
    public element(i?: number): ElementContext[] | ElementContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ElementContext);
        }

        return this.getRuleContext(i, ElementContext);
    }
    public reference(): ReferenceContext[];
    public reference(i: number): ReferenceContext | null;
    public reference(i?: number): ReferenceContext[] | ReferenceContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ReferenceContext);
        }

        return this.getRuleContext(i, ReferenceContext);
    }
    public CDATA(): antlr.TerminalNode[];
    public CDATA(i: number): antlr.TerminalNode | null;
    public CDATA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(XMLParser.CDATA);
    	} else {
    		return this.getToken(XMLParser.CDATA, i);
    	}
    }
    public PI(): antlr.TerminalNode[];
    public PI(i: number): antlr.TerminalNode | null;
    public PI(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(XMLParser.PI);
    	} else {
    		return this.getToken(XMLParser.PI, i);
    	}
    }
    public COMMENT(): antlr.TerminalNode[];
    public COMMENT(i: number): antlr.TerminalNode | null;
    public COMMENT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(XMLParser.COMMENT);
    	} else {
    		return this.getToken(XMLParser.COMMENT, i);
    	}
    }
    public override get ruleIndex(): number {
        return XMLParser.RULE_content;
    }
    public override enterRule(listener: XMLParserListener): void {
        if(listener.enterContent) {
             listener.enterContent(this);
        }
    }
    public override exitRule(listener: XMLParserListener): void {
        if(listener.exitContent) {
             listener.exitContent(this);
        }
    }
    public override accept<Result>(visitor: XMLParserVisitor<Result>): Result | null {
        if (visitor.visitContent) {
            return visitor.visitContent(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ElementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public OPEN(): antlr.TerminalNode[];
    public OPEN(i: number): antlr.TerminalNode | null;
    public OPEN(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(XMLParser.OPEN);
    	} else {
    		return this.getToken(XMLParser.OPEN, i);
    	}
    }
    public Name(): antlr.TerminalNode[];
    public Name(i: number): antlr.TerminalNode | null;
    public Name(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(XMLParser.Name);
    	} else {
    		return this.getToken(XMLParser.Name, i);
    	}
    }
    public CLOSE(): antlr.TerminalNode[];
    public CLOSE(i: number): antlr.TerminalNode | null;
    public CLOSE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(XMLParser.CLOSE);
    	} else {
    		return this.getToken(XMLParser.CLOSE, i);
    	}
    }
    public content(): ContentContext | null {
        return this.getRuleContext(0, ContentContext);
    }
    public SLASH(): antlr.TerminalNode | null {
        return this.getToken(XMLParser.SLASH, 0);
    }
    public attribute(): AttributeContext[];
    public attribute(i: number): AttributeContext | null;
    public attribute(i?: number): AttributeContext[] | AttributeContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AttributeContext);
        }

        return this.getRuleContext(i, AttributeContext);
    }
    public SLASH_CLOSE(): antlr.TerminalNode | null {
        return this.getToken(XMLParser.SLASH_CLOSE, 0);
    }
    public override get ruleIndex(): number {
        return XMLParser.RULE_element;
    }
    public override enterRule(listener: XMLParserListener): void {
        if(listener.enterElement) {
             listener.enterElement(this);
        }
    }
    public override exitRule(listener: XMLParserListener): void {
        if(listener.exitElement) {
             listener.exitElement(this);
        }
    }
    public override accept<Result>(visitor: XMLParserVisitor<Result>): Result | null {
        if (visitor.visitElement) {
            return visitor.visitElement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ReferenceContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EntityRef(): antlr.TerminalNode | null {
        return this.getToken(XMLParser.EntityRef, 0);
    }
    public CharRef(): antlr.TerminalNode | null {
        return this.getToken(XMLParser.CharRef, 0);
    }
    public override get ruleIndex(): number {
        return XMLParser.RULE_reference;
    }
    public override enterRule(listener: XMLParserListener): void {
        if(listener.enterReference) {
             listener.enterReference(this);
        }
    }
    public override exitRule(listener: XMLParserListener): void {
        if(listener.exitReference) {
             listener.exitReference(this);
        }
    }
    public override accept<Result>(visitor: XMLParserVisitor<Result>): Result | null {
        if (visitor.visitReference) {
            return visitor.visitReference(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AttributeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Name(): antlr.TerminalNode {
        return this.getToken(XMLParser.Name, 0)!;
    }
    public EQUALS(): antlr.TerminalNode {
        return this.getToken(XMLParser.EQUALS, 0)!;
    }
    public STRING(): antlr.TerminalNode {
        return this.getToken(XMLParser.STRING, 0)!;
    }
    public override get ruleIndex(): number {
        return XMLParser.RULE_attribute;
    }
    public override enterRule(listener: XMLParserListener): void {
        if(listener.enterAttribute) {
             listener.enterAttribute(this);
        }
    }
    public override exitRule(listener: XMLParserListener): void {
        if(listener.exitAttribute) {
             listener.exitAttribute(this);
        }
    }
    public override accept<Result>(visitor: XMLParserVisitor<Result>): Result | null {
        if (visitor.visitAttribute) {
            return visitor.visitAttribute(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ChardataContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public TEXT(): antlr.TerminalNode | null {
        return this.getToken(XMLParser.TEXT, 0);
    }
    public SEA_WS(): antlr.TerminalNode | null {
        return this.getToken(XMLParser.SEA_WS, 0);
    }
    public override get ruleIndex(): number {
        return XMLParser.RULE_chardata;
    }
    public override enterRule(listener: XMLParserListener): void {
        if(listener.enterChardata) {
             listener.enterChardata(this);
        }
    }
    public override exitRule(listener: XMLParserListener): void {
        if(listener.exitChardata) {
             listener.exitChardata(this);
        }
    }
    public override accept<Result>(visitor: XMLParserVisitor<Result>): Result | null {
        if (visitor.visitChardata) {
            return visitor.visitChardata(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MiscContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public COMMENT(): antlr.TerminalNode | null {
        return this.getToken(XMLParser.COMMENT, 0);
    }
    public PI(): antlr.TerminalNode | null {
        return this.getToken(XMLParser.PI, 0);
    }
    public SEA_WS(): antlr.TerminalNode | null {
        return this.getToken(XMLParser.SEA_WS, 0);
    }
    public override get ruleIndex(): number {
        return XMLParser.RULE_misc;
    }
    public override enterRule(listener: XMLParserListener): void {
        if(listener.enterMisc) {
             listener.enterMisc(this);
        }
    }
    public override exitRule(listener: XMLParserListener): void {
        if(listener.exitMisc) {
             listener.exitMisc(this);
        }
    }
    public override accept<Result>(visitor: XMLParserVisitor<Result>): Result | null {
        if (visitor.visitMisc) {
            return visitor.visitMisc(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
