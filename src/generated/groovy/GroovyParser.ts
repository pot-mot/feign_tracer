// @ts-nocheck

import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { GroovyParserListener } from "./GroovyParserListener.js";
import { GroovyParserVisitor } from "./GroovyParserVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class GroovyParser extends antlr.Parser {
    public static readonly PACKAGE = 1;
    public static readonly IMPORT = 2;
    public static readonly STATIC = 3;
    public static readonly CLASS = 4;
    public static readonly INTERFACE = 5;
    public static readonly TRAIT = 6;
    public static readonly ENUM = 7;
    public static readonly EXTENDS = 8;
    public static readonly IMPLEMENTS = 9;
    public static readonly DEF = 10;
    public static readonly VOID = 11;
    public static readonly NEW = 12;
    public static readonly FINAL = 13;
    public static readonly PUBLIC = 14;
    public static readonly PROTECTED = 15;
    public static readonly PRIVATE = 16;
    public static readonly ABSTRACT = 17;
    public static readonly SYNCHRONIZED = 18;
    public static readonly RETURN = 19;
    public static readonly THROWS = 20;
    public static readonly THROW = 21;
    public static readonly THIS = 22;
    public static readonly SUPER = 23;
    public static readonly AS = 24;
    public static readonly IN = 25;
    public static readonly INSTANCEOF = 26;
    public static readonly TRUE = 27;
    public static readonly FALSE = 28;
    public static readonly NULL = 29;
    public static readonly IF = 30;
    public static readonly ELSE = 31;
    public static readonly FOR = 32;
    public static readonly WHILE = 33;
    public static readonly DO = 34;
    public static readonly SWITCH = 35;
    public static readonly CASE = 36;
    public static readonly DEFAULT = 37;
    public static readonly TRY = 38;
    public static readonly CATCH = 39;
    public static readonly FINALLY = 40;
    public static readonly BREAK = 41;
    public static readonly CONTINUE = 42;
    public static readonly ASSERT = 43;
    public static readonly AT = 44;
    public static readonly LPAREN = 45;
    public static readonly RPAREN = 46;
    public static readonly LBRACE = 47;
    public static readonly RBRACE = 48;
    public static readonly LBRACK = 49;
    public static readonly RBRACK = 50;
    public static readonly SEMI = 51;
    public static readonly COMMA = 52;
    public static readonly DOT = 53;
    public static readonly COLON = 54;
    public static readonly QUEST = 55;
    public static readonly ASSIGN = 56;
    public static readonly ARROW = 57;
    public static readonly ELLIPSIS = 58;
    public static readonly LANGLE = 59;
    public static readonly RANGLE = 60;
    public static readonly MUL = 61;
    public static readonly PLUS = 62;
    public static readonly MINUS = 63;
    public static readonly SLASH = 64;
    public static readonly PERCENT = 65;
    public static readonly BANG = 66;
    public static readonly AMP = 67;
    public static readonly PIPE = 68;
    public static readonly CARET = 69;
    public static readonly TILDE = 70;
    public static readonly EQEQ = 71;
    public static readonly NOTEQ = 72;
    public static readonly LE = 73;
    public static readonly GE = 74;
    public static readonly ANDAND = 75;
    public static readonly OROR = 76;
    public static readonly INC = 77;
    public static readonly DEC = 78;
    public static readonly PLUSEQ = 79;
    public static readonly MINUSEQ = 80;
    public static readonly MULEQ = 81;
    public static readonly DIVEQ = 82;
    public static readonly SCOPED = 83;
    public static readonly SAFEDOT = 84;
    public static readonly Identifier = 85;
    public static readonly Number = 86;
    public static readonly String = 87;
    public static readonly LINE_COMMENT = 88;
    public static readonly BLOCK_COMMENT = 89;
    public static readonly WS = 90;
    public static readonly SHEBANG = 91;
    public static readonly ANY = 92;
    public static readonly RULE_groovyFile = 0;
    public static readonly RULE_packageDecl = 1;
    public static readonly RULE_importDecl = 2;
    public static readonly RULE_fileMember = 3;
    public static readonly RULE_classDecl = 4;
    public static readonly RULE_classBody = 5;
    public static readonly RULE_classMember = 6;
    public static readonly RULE_methodDecl = 7;
    public static readonly RULE_fieldDecl = 8;
    public static readonly RULE_paramList = 9;
    public static readonly RULE_param = 10;
    public static readonly RULE_paramInit = 11;
    public static readonly RULE_simpleInit = 12;
    public static readonly RULE_arguments = 13;
    public static readonly RULE_argList = 14;
    public static readonly RULE_arg = 15;
    public static readonly RULE_block = 16;
    public static readonly RULE_blockItem = 17;
    public static readonly RULE_scriptChunk = 18;
    public static readonly RULE_annotation = 19;
    public static readonly RULE_annotationArgs = 20;
    public static readonly RULE_modifier = 21;
    public static readonly RULE_type = 22;
    public static readonly RULE_typeList = 23;
    public static readonly RULE_typeParams = 24;
    public static readonly RULE_typeParam = 25;
    public static readonly RULE_typeArgs = 26;
    public static readonly RULE_typeArg = 27;
    public static readonly RULE_dims = 28;
    public static readonly RULE_qualifiedName = 29;
    public static readonly RULE_identifier = 30;
    public static readonly RULE_literal = 31;

    public static readonly literalNames = [
        null, "'package'", "'import'", "'static'", "'class'", "'interface'", 
        "'trait'", "'enum'", "'extends'", "'implements'", "'def'", "'void'", 
        "'new'", "'final'", "'public'", "'protected'", "'private'", "'abstract'", 
        "'synchronized'", "'return'", "'throws'", "'throw'", "'this'", "'super'", 
        "'as'", "'in'", "'instanceof'", "'true'", "'false'", "'null'", "'if'", 
        "'else'", "'for'", "'while'", "'do'", "'switch'", "'case'", "'default'", 
        "'try'", "'catch'", "'finally'", "'break'", "'continue'", "'assert'", 
        "'@'", "'('", "')'", "'{'", "'}'", "'['", "']'", "';'", "','", "'.'", 
        "':'", "'?'", "'='", "'->'", "'...'", "'<'", "'>'", "'*'", "'+'", 
        "'-'", "'/'", "'%'", "'!'", "'&'", "'|'", "'^'", "'~'", "'=='", 
        "'!='", "'<='", "'>='", "'&&'", "'||'", "'++'", "'--'", "'+='", 
        "'-='", "'*='", "'/='", "'::'", "'?.'"
    ];

    public static readonly symbolicNames = [
        null, "PACKAGE", "IMPORT", "STATIC", "CLASS", "INTERFACE", "TRAIT", 
        "ENUM", "EXTENDS", "IMPLEMENTS", "DEF", "VOID", "NEW", "FINAL", 
        "PUBLIC", "PROTECTED", "PRIVATE", "ABSTRACT", "SYNCHRONIZED", "RETURN", 
        "THROWS", "THROW", "THIS", "SUPER", "AS", "IN", "INSTANCEOF", "TRUE", 
        "FALSE", "NULL", "IF", "ELSE", "FOR", "WHILE", "DO", "SWITCH", "CASE", 
        "DEFAULT", "TRY", "CATCH", "FINALLY", "BREAK", "CONTINUE", "ASSERT", 
        "AT", "LPAREN", "RPAREN", "LBRACE", "RBRACE", "LBRACK", "RBRACK", 
        "SEMI", "COMMA", "DOT", "COLON", "QUEST", "ASSIGN", "ARROW", "ELLIPSIS", 
        "LANGLE", "RANGLE", "MUL", "PLUS", "MINUS", "SLASH", "PERCENT", 
        "BANG", "AMP", "PIPE", "CARET", "TILDE", "EQEQ", "NOTEQ", "LE", 
        "GE", "ANDAND", "OROR", "INC", "DEC", "PLUSEQ", "MINUSEQ", "MULEQ", 
        "DIVEQ", "SCOPED", "SAFEDOT", "Identifier", "Number", "String", 
        "LINE_COMMENT", "BLOCK_COMMENT", "WS", "SHEBANG", "ANY"
    ];
    public static readonly ruleNames = [
        "groovyFile", "packageDecl", "importDecl", "fileMember", "classDecl", 
        "classBody", "classMember", "methodDecl", "fieldDecl", "paramList", 
        "param", "paramInit", "simpleInit", "arguments", "argList", "arg", 
        "block", "blockItem", "scriptChunk", "annotation", "annotationArgs", 
        "modifier", "type", "typeList", "typeParams", "typeParam", "typeArgs", 
        "typeArg", "dims", "qualifiedName", "identifier", "literal",
    ];

    public get grammarFileName(): string { return "GroovyParser.g4"; }
    public get literalNames(): (string | null)[] { return GroovyParser.literalNames; }
    public get symbolicNames(): (string | null)[] { return GroovyParser.symbolicNames; }
    public get ruleNames(): string[] { return GroovyParser.ruleNames; }
    public get serializedATN(): number[] { return GroovyParser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, GroovyParser._ATN, GroovyParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public groovyFile(): GroovyFileContext {
        let localContext = new GroovyFileContext(this.context, this.state);
        this.enterRule(localContext, 0, GroovyParser.RULE_groovyFile);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 65;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 1) {
                {
                this.state = 64;
                this.packageDecl();
                }
            }

            this.state = 70;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 2) {
                {
                {
                this.state = 67;
                this.importDecl();
                }
                }
                this.state = 72;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 76;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967288) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294967295) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 536870911) !== 0)) {
                {
                {
                this.state = 73;
                this.fileMember();
                }
                }
                this.state = 78;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 79;
            this.match(GroovyParser.EOF);
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
    public packageDecl(): PackageDeclContext {
        let localContext = new PackageDeclContext(this.context, this.state);
        this.enterRule(localContext, 2, GroovyParser.RULE_packageDecl);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 81;
            this.match(GroovyParser.PACKAGE);
            this.state = 82;
            this.qualifiedName();
            this.state = 84;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 3, this.context) ) {
            case 1:
                {
                this.state = 83;
                this.match(GroovyParser.SEMI);
                }
                break;
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
    public importDecl(): ImportDeclContext {
        let localContext = new ImportDeclContext(this.context, this.state);
        this.enterRule(localContext, 4, GroovyParser.RULE_importDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 86;
            this.match(GroovyParser.IMPORT);
            this.state = 88;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 3) {
                {
                this.state = 87;
                this.match(GroovyParser.STATIC);
                }
            }

            this.state = 90;
            this.qualifiedName();
            this.state = 93;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 5, this.context) ) {
            case 1:
                {
                this.state = 91;
                this.match(GroovyParser.DOT);
                this.state = 92;
                this.match(GroovyParser.MUL);
                }
                break;
            }
            this.state = 97;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 6, this.context) ) {
            case 1:
                {
                this.state = 95;
                this.match(GroovyParser.AS);
                this.state = 96;
                this.identifier();
                }
                break;
            }
            this.state = 100;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 7, this.context) ) {
            case 1:
                {
                this.state = 99;
                this.match(GroovyParser.SEMI);
                }
                break;
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
    public fileMember(): FileMemberContext {
        let localContext = new FileMemberContext(this.context, this.state);
        this.enterRule(localContext, 6, GroovyParser.RULE_fileMember);
        try {
            this.state = 106;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 8, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 102;
                this.classDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 103;
                this.methodDecl();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 104;
                this.fieldDecl();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 105;
                this.scriptChunk();
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
    public classDecl(): ClassDeclContext {
        let localContext = new ClassDeclContext(this.context, this.state);
        this.enterRule(localContext, 8, GroovyParser.RULE_classDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 111;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 44) {
                {
                {
                this.state = 108;
                this.annotation();
                }
                }
                this.state = 113;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 117;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 516104) !== 0)) {
                {
                {
                this.state = 114;
                this.modifier();
                }
                }
                this.state = 119;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 120;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 240) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            this.state = 121;
            this.identifier();
            this.state = 123;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 59) {
                {
                this.state = 122;
                this.typeParams();
                }
            }

            this.state = 127;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 8) {
                {
                this.state = 125;
                this.match(GroovyParser.EXTENDS);
                this.state = 126;
                this.type_();
                }
            }

            this.state = 131;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 9) {
                {
                this.state = 129;
                this.match(GroovyParser.IMPLEMENTS);
                this.state = 130;
                this.typeList();
                }
            }

            this.state = 133;
            this.classBody();
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
    public classBody(): ClassBodyContext {
        let localContext = new ClassBodyContext(this.context, this.state);
        this.enterRule(localContext, 10, GroovyParser.RULE_classBody);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 135;
            this.match(GroovyParser.LBRACE);
            this.state = 139;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 50851064) !== 0) || ((((_la - 37)) & ~0x1F) === 0 && ((1 << (_la - 37)) & 17537) !== 0) || _la === 85) {
                {
                {
                this.state = 136;
                this.classMember();
                }
                }
                this.state = 141;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 142;
            this.match(GroovyParser.RBRACE);
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
    public classMember(): ClassMemberContext {
        let localContext = new ClassMemberContext(this.context, this.state);
        this.enterRule(localContext, 12, GroovyParser.RULE_classMember);
        let _la: number;
        try {
            this.state = 173;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 19, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 144;
                this.classDecl();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 148;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 44) {
                    {
                    {
                    this.state = 145;
                    this.annotation();
                    }
                    }
                    this.state = 150;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 154;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 516104) !== 0)) {
                    {
                    {
                    this.state = 151;
                    this.modifier();
                    }
                    }
                    this.state = 156;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 157;
                this.methodDecl();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 161;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 44) {
                    {
                    {
                    this.state = 158;
                    this.annotation();
                    }
                    }
                    this.state = 163;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 167;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 516104) !== 0)) {
                    {
                    {
                    this.state = 164;
                    this.modifier();
                    }
                    }
                    this.state = 169;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 170;
                this.fieldDecl();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 171;
                this.block();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 172;
                this.match(GroovyParser.SEMI);
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
    public methodDecl(): MethodDeclContext {
        let localContext = new MethodDeclContext(this.context, this.state);
        this.enterRule(localContext, 14, GroovyParser.RULE_methodDecl);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 176;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 20, this.context) ) {
            case 1:
                {
                this.state = 175;
                this.type_();
                }
                break;
            }
            this.state = 178;
            this.identifier();
            this.state = 179;
            this.match(GroovyParser.LPAREN);
            this.state = 181;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 50850824) !== 0) || _la === 37 || _la === 44 || _la === 85) {
                {
                this.state = 180;
                this.paramList();
                }
            }

            this.state = 183;
            this.match(GroovyParser.RPAREN);
            this.state = 186;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 22, this.context) ) {
            case 1:
                {
                this.state = 184;
                this.match(GroovyParser.THROWS);
                this.state = 185;
                this.typeList();
                }
                break;
            }
            this.state = 196;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 25, this.context) ) {
            case 1:
                {
                this.state = 188;
                this.block();
                }
                break;
            case 2:
                {
                this.state = 191;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 23, this.context) ) {
                case 1:
                    {
                    this.state = 189;
                    this.match(GroovyParser.ASSIGN);
                    this.state = 190;
                    this.simpleInit();
                    }
                    break;
                }
                this.state = 194;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 24, this.context) ) {
                case 1:
                    {
                    this.state = 193;
                    this.match(GroovyParser.SEMI);
                    }
                    break;
                }
                }
                break;
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
    public fieldDecl(): FieldDeclContext {
        let localContext = new FieldDeclContext(this.context, this.state);
        this.enterRule(localContext, 16, GroovyParser.RULE_fieldDecl);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 198;
            this.type_();
            this.state = 199;
            this.identifier();
            this.state = 202;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 26, this.context) ) {
            case 1:
                {
                this.state = 200;
                this.match(GroovyParser.ASSIGN);
                this.state = 201;
                this.simpleInit();
                }
                break;
            }
            this.state = 205;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 27, this.context) ) {
            case 1:
                {
                this.state = 204;
                this.match(GroovyParser.SEMI);
                }
                break;
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
    public paramList(): ParamListContext {
        let localContext = new ParamListContext(this.context, this.state);
        this.enterRule(localContext, 18, GroovyParser.RULE_paramList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 207;
            this.param();
            this.state = 212;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 52) {
                {
                {
                this.state = 208;
                this.match(GroovyParser.COMMA);
                this.state = 209;
                this.param();
                }
                }
                this.state = 214;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
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
    public param(): ParamContext {
        let localContext = new ParamContext(this.context, this.state);
        this.enterRule(localContext, 20, GroovyParser.RULE_param);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 218;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 44) {
                {
                {
                this.state = 215;
                this.annotation();
                }
                }
                this.state = 220;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 224;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 516104) !== 0)) {
                {
                {
                this.state = 221;
                this.modifier();
                }
                }
                this.state = 226;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 228;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 31, this.context) ) {
            case 1:
                {
                this.state = 227;
                this.type_();
                }
                break;
            }
            this.state = 230;
            this.identifier();
            this.state = 233;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 56) {
                {
                this.state = 231;
                this.match(GroovyParser.ASSIGN);
                this.state = 232;
                this.paramInit();
                }
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
    public paramInit(): ParamInitContext {
        let localContext = new ParamInitContext(this.context, this.state);
        this.enterRule(localContext, 22, GroovyParser.RULE_paramInit);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 236;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 235;
                _la = this.tokenStream.LA(1);
                if(_la<=0 || ((((_la - 46)) & ~0x1F) === 0 && ((1 << (_la - 46)) & 71) !== 0)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
                }
                this.state = 238;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967294) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4293804031) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 536870911) !== 0));
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
    public simpleInit(): SimpleInitContext {
        let localContext = new SimpleInitContext(this.context, this.state);
        this.enterRule(localContext, 24, GroovyParser.RULE_simpleInit);
        try {
            this.state = 255;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case GroovyParser.TRUE:
            case GroovyParser.FALSE:
            case GroovyParser.NULL:
            case GroovyParser.Number:
            case GroovyParser.String:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 240;
                this.literal();
                }
                break;
            case GroovyParser.NEW:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 241;
                this.match(GroovyParser.NEW);
                this.state = 242;
                this.type_();
                this.state = 244;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 34, this.context) ) {
                case 1:
                    {
                    this.state = 243;
                    this.typeArgs();
                    }
                    break;
                }
                this.state = 247;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 35, this.context) ) {
                case 1:
                    {
                    this.state = 246;
                    this.arguments();
                    }
                    break;
                }
                }
                break;
            case GroovyParser.DEF:
            case GroovyParser.VOID:
            case GroovyParser.AS:
            case GroovyParser.IN:
            case GroovyParser.DEFAULT:
            case GroovyParser.Identifier:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 249;
                this.qualifiedName();
                this.state = 251;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 36, this.context) ) {
                case 1:
                    {
                    this.state = 250;
                    this.arguments();
                    }
                    break;
                }
                }
                break;
            case GroovyParser.LPAREN:
            case GroovyParser.LBRACK:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 253;
                this.arguments();
                }
                break;
            case GroovyParser.LBRACE:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 254;
                this.block();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
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
    public arguments(): ArgumentsContext {
        let localContext = new ArgumentsContext(this.context, this.state);
        this.enterRule(localContext, 26, GroovyParser.RULE_arguments);
        let _la: number;
        try {
            this.state = 267;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case GroovyParser.LPAREN:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 257;
                this.match(GroovyParser.LPAREN);
                this.state = 259;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967294) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4293640191) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 536870911) !== 0)) {
                    {
                    this.state = 258;
                    this.argList();
                    }
                }

                this.state = 261;
                this.match(GroovyParser.RPAREN);
                }
                break;
            case GroovyParser.LBRACK:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 262;
                this.match(GroovyParser.LBRACK);
                this.state = 264;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967294) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4293640191) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 536870911) !== 0)) {
                    {
                    this.state = 263;
                    this.argList();
                    }
                }

                this.state = 266;
                this.match(GroovyParser.RBRACK);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
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
    public argList(): ArgListContext {
        let localContext = new ArgListContext(this.context, this.state);
        this.enterRule(localContext, 28, GroovyParser.RULE_argList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 269;
            this.arg();
            this.state = 274;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 52) {
                {
                {
                this.state = 270;
                this.match(GroovyParser.COMMA);
                this.state = 271;
                this.arg();
                }
                }
                this.state = 276;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
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
    public arg(): ArgContext {
        let localContext = new ArgContext(this.context, this.state);
        this.enterRule(localContext, 30, GroovyParser.RULE_arg);
        let _la: number;
        try {
            this.state = 285;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 43, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 277;
                this.literal();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 278;
                this.annotation();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 279;
                this.block();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 281;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 280;
                    _la = this.tokenStream.LA(1);
                    if(_la<=0 || ((((_la - 46)) & ~0x1F) === 0 && ((1 << (_la - 46)) & 81) !== 0)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    }
                    }
                    this.state = 283;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967294) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4293640191) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 536870911) !== 0));
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
    public block(): BlockContext {
        let localContext = new BlockContext(this.context, this.state);
        this.enterRule(localContext, 32, GroovyParser.RULE_block);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 287;
            this.match(GroovyParser.LBRACE);
            this.state = 291;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967294) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294901759) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 536870911) !== 0)) {
                {
                {
                this.state = 288;
                this.blockItem();
                }
                }
                this.state = 293;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 294;
            this.match(GroovyParser.RBRACE);
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
    public blockItem(): BlockItemContext {
        let localContext = new BlockItemContext(this.context, this.state);
        this.enterRule(localContext, 34, GroovyParser.RULE_blockItem);
        let _la: number;
        try {
            this.state = 298;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case GroovyParser.LBRACE:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 296;
                this.block();
                }
                break;
            case GroovyParser.PACKAGE:
            case GroovyParser.IMPORT:
            case GroovyParser.STATIC:
            case GroovyParser.CLASS:
            case GroovyParser.INTERFACE:
            case GroovyParser.TRAIT:
            case GroovyParser.ENUM:
            case GroovyParser.EXTENDS:
            case GroovyParser.IMPLEMENTS:
            case GroovyParser.DEF:
            case GroovyParser.VOID:
            case GroovyParser.NEW:
            case GroovyParser.FINAL:
            case GroovyParser.PUBLIC:
            case GroovyParser.PROTECTED:
            case GroovyParser.PRIVATE:
            case GroovyParser.ABSTRACT:
            case GroovyParser.SYNCHRONIZED:
            case GroovyParser.RETURN:
            case GroovyParser.THROWS:
            case GroovyParser.THROW:
            case GroovyParser.THIS:
            case GroovyParser.SUPER:
            case GroovyParser.AS:
            case GroovyParser.IN:
            case GroovyParser.INSTANCEOF:
            case GroovyParser.TRUE:
            case GroovyParser.FALSE:
            case GroovyParser.NULL:
            case GroovyParser.IF:
            case GroovyParser.ELSE:
            case GroovyParser.FOR:
            case GroovyParser.WHILE:
            case GroovyParser.DO:
            case GroovyParser.SWITCH:
            case GroovyParser.CASE:
            case GroovyParser.DEFAULT:
            case GroovyParser.TRY:
            case GroovyParser.CATCH:
            case GroovyParser.FINALLY:
            case GroovyParser.BREAK:
            case GroovyParser.CONTINUE:
            case GroovyParser.ASSERT:
            case GroovyParser.AT:
            case GroovyParser.LPAREN:
            case GroovyParser.RPAREN:
            case GroovyParser.LBRACK:
            case GroovyParser.RBRACK:
            case GroovyParser.SEMI:
            case GroovyParser.COMMA:
            case GroovyParser.DOT:
            case GroovyParser.COLON:
            case GroovyParser.QUEST:
            case GroovyParser.ASSIGN:
            case GroovyParser.ARROW:
            case GroovyParser.ELLIPSIS:
            case GroovyParser.LANGLE:
            case GroovyParser.RANGLE:
            case GroovyParser.MUL:
            case GroovyParser.PLUS:
            case GroovyParser.MINUS:
            case GroovyParser.SLASH:
            case GroovyParser.PERCENT:
            case GroovyParser.BANG:
            case GroovyParser.AMP:
            case GroovyParser.PIPE:
            case GroovyParser.CARET:
            case GroovyParser.TILDE:
            case GroovyParser.EQEQ:
            case GroovyParser.NOTEQ:
            case GroovyParser.LE:
            case GroovyParser.GE:
            case GroovyParser.ANDAND:
            case GroovyParser.OROR:
            case GroovyParser.INC:
            case GroovyParser.DEC:
            case GroovyParser.PLUSEQ:
            case GroovyParser.MINUSEQ:
            case GroovyParser.MULEQ:
            case GroovyParser.DIVEQ:
            case GroovyParser.SCOPED:
            case GroovyParser.SAFEDOT:
            case GroovyParser.Identifier:
            case GroovyParser.Number:
            case GroovyParser.String:
            case GroovyParser.LINE_COMMENT:
            case GroovyParser.BLOCK_COMMENT:
            case GroovyParser.WS:
            case GroovyParser.SHEBANG:
            case GroovyParser.ANY:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 297;
                _la = this.tokenStream.LA(1);
                if(_la<=0 || _la === 47 || _la === 48) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
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
    public scriptChunk(): ScriptChunkContext {
        let localContext = new ScriptChunkContext(this.context, this.state);
        this.enterRule(localContext, 36, GroovyParser.RULE_scriptChunk);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 301;
            this.errorHandler.sync(this);
            alternative = 1;
            do {
                switch (alternative) {
                case 1:
                    {
                    {
                    this.state = 300;
                    _la = this.tokenStream.LA(1);
                    if(_la<=0 || ((((_la - -1)) & ~0x1F) === 0 && ((1 << (_la - -1)) & 493) !== 0)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 303;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 46, this.context);
            } while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER);
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
    public annotation(): AnnotationContext {
        let localContext = new AnnotationContext(this.context, this.state);
        this.enterRule(localContext, 38, GroovyParser.RULE_annotation);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 305;
            this.match(GroovyParser.AT);
            this.state = 306;
            this.qualifiedName();
            this.state = 312;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 45) {
                {
                this.state = 307;
                this.match(GroovyParser.LPAREN);
                this.state = 309;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967294) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294950911) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 536870911) !== 0)) {
                    {
                    this.state = 308;
                    this.annotationArgs();
                    }
                }

                this.state = 311;
                this.match(GroovyParser.RPAREN);
                }
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
    public annotationArgs(): AnnotationArgsContext {
        let localContext = new AnnotationArgsContext(this.context, this.state);
        this.enterRule(localContext, 40, GroovyParser.RULE_annotationArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 315;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 314;
                _la = this.tokenStream.LA(1);
                if(_la<=0 || _la === 46) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
                }
                this.state = 317;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967294) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294950911) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 536870911) !== 0));
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
    public modifier(): ModifierContext {
        let localContext = new ModifierContext(this.context, this.state);
        this.enterRule(localContext, 42, GroovyParser.RULE_modifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 319;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 516104) !== 0))) {
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
    public type_(): TypeContext {
        let localContext = new TypeContext(this.context, this.state);
        this.enterRule(localContext, 44, GroovyParser.RULE_type);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 324;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 50, this.context) ) {
            case 1:
                {
                this.state = 321;
                this.match(GroovyParser.DEF);
                }
                break;
            case 2:
                {
                this.state = 322;
                this.match(GroovyParser.VOID);
                }
                break;
            case 3:
                {
                this.state = 323;
                this.qualifiedName();
                }
                break;
            }
            this.state = 327;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 51, this.context) ) {
            case 1:
                {
                this.state = 326;
                this.typeArgs();
                }
                break;
            }
            this.state = 330;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 52, this.context) ) {
            case 1:
                {
                this.state = 329;
                this.dims();
                }
                break;
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
    public typeList(): TypeListContext {
        let localContext = new TypeListContext(this.context, this.state);
        this.enterRule(localContext, 46, GroovyParser.RULE_typeList);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 332;
            this.type_();
            this.state = 337;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 53, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 333;
                    this.match(GroovyParser.COMMA);
                    this.state = 334;
                    this.type_();
                    }
                    }
                }
                this.state = 339;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 53, this.context);
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
    public typeParams(): TypeParamsContext {
        let localContext = new TypeParamsContext(this.context, this.state);
        this.enterRule(localContext, 48, GroovyParser.RULE_typeParams);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 340;
            this.match(GroovyParser.LANGLE);
            this.state = 341;
            this.typeParam();
            this.state = 346;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 52) {
                {
                {
                this.state = 342;
                this.match(GroovyParser.COMMA);
                this.state = 343;
                this.typeParam();
                }
                }
                this.state = 348;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 349;
            this.match(GroovyParser.RANGLE);
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
    public typeParam(): TypeParamContext {
        let localContext = new TypeParamContext(this.context, this.state);
        this.enterRule(localContext, 50, GroovyParser.RULE_typeParam);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 351;
            this.identifier();
            this.state = 354;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 8) {
                {
                this.state = 352;
                this.match(GroovyParser.EXTENDS);
                this.state = 353;
                this.type_();
                }
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
    public typeArgs(): TypeArgsContext {
        let localContext = new TypeArgsContext(this.context, this.state);
        this.enterRule(localContext, 52, GroovyParser.RULE_typeArgs);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 356;
            this.match(GroovyParser.LANGLE);
            this.state = 357;
            this.typeArg();
            this.state = 362;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 52) {
                {
                {
                this.state = 358;
                this.match(GroovyParser.COMMA);
                this.state = 359;
                this.typeArg();
                }
                }
                this.state = 364;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 365;
            this.match(GroovyParser.RANGLE);
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
    public typeArg(): TypeArgContext {
        let localContext = new TypeArgContext(this.context, this.state);
        this.enterRule(localContext, 54, GroovyParser.RULE_typeArg);
        let _la: number;
        try {
            this.state = 373;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case GroovyParser.DEF:
            case GroovyParser.VOID:
            case GroovyParser.AS:
            case GroovyParser.IN:
            case GroovyParser.DEFAULT:
            case GroovyParser.Identifier:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 367;
                this.type_();
                }
                break;
            case GroovyParser.QUEST:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 368;
                this.match(GroovyParser.QUEST);
                this.state = 370;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 8 || _la === 23) {
                    {
                    this.state = 369;
                    _la = this.tokenStream.LA(1);
                    if(!(_la === 8 || _la === 23)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    }
                }

                this.state = 372;
                this.type_();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
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
    public dims(): DimsContext {
        let localContext = new DimsContext(this.context, this.state);
        this.enterRule(localContext, 56, GroovyParser.RULE_dims);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 377;
            this.errorHandler.sync(this);
            alternative = 1;
            do {
                switch (alternative) {
                case 1:
                    {
                    {
                    this.state = 375;
                    this.match(GroovyParser.LBRACK);
                    this.state = 376;
                    this.match(GroovyParser.RBRACK);
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 379;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 59, this.context);
            } while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER);
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
    public qualifiedName(): QualifiedNameContext {
        let localContext = new QualifiedNameContext(this.context, this.state);
        this.enterRule(localContext, 58, GroovyParser.RULE_qualifiedName);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 381;
            this.identifier();
            this.state = 386;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 60, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 382;
                    this.match(GroovyParser.DOT);
                    this.state = 383;
                    this.identifier();
                    }
                    }
                }
                this.state = 388;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 60, this.context);
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
    public identifier(): IdentifierContext {
        let localContext = new IdentifierContext(this.context, this.state);
        this.enterRule(localContext, 60, GroovyParser.RULE_identifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 389;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 134266883) !== 0) || _la === 85)) {
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
    public literal(): LiteralContext {
        let localContext = new LiteralContext(this.context, this.state);
        this.enterRule(localContext, 62, GroovyParser.RULE_literal);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 391;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 939524096) !== 0) || _la === 86 || _la === 87)) {
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
        4,1,92,394,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,
        7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,
        2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,1,0,3,0,66,8,0,
        1,0,5,0,69,8,0,10,0,12,0,72,9,0,1,0,5,0,75,8,0,10,0,12,0,78,9,0,
        1,0,1,0,1,1,1,1,1,1,3,1,85,8,1,1,2,1,2,3,2,89,8,2,1,2,1,2,1,2,3,
        2,94,8,2,1,2,1,2,3,2,98,8,2,1,2,3,2,101,8,2,1,3,1,3,1,3,1,3,3,3,
        107,8,3,1,4,5,4,110,8,4,10,4,12,4,113,9,4,1,4,5,4,116,8,4,10,4,12,
        4,119,9,4,1,4,1,4,1,4,3,4,124,8,4,1,4,1,4,3,4,128,8,4,1,4,1,4,3,
        4,132,8,4,1,4,1,4,1,5,1,5,5,5,138,8,5,10,5,12,5,141,9,5,1,5,1,5,
        1,6,1,6,5,6,147,8,6,10,6,12,6,150,9,6,1,6,5,6,153,8,6,10,6,12,6,
        156,9,6,1,6,1,6,5,6,160,8,6,10,6,12,6,163,9,6,1,6,5,6,166,8,6,10,
        6,12,6,169,9,6,1,6,1,6,1,6,3,6,174,8,6,1,7,3,7,177,8,7,1,7,1,7,1,
        7,3,7,182,8,7,1,7,1,7,1,7,3,7,187,8,7,1,7,1,7,1,7,3,7,192,8,7,1,
        7,3,7,195,8,7,3,7,197,8,7,1,8,1,8,1,8,1,8,3,8,203,8,8,1,8,3,8,206,
        8,8,1,9,1,9,1,9,5,9,211,8,9,10,9,12,9,214,9,9,1,10,5,10,217,8,10,
        10,10,12,10,220,9,10,1,10,5,10,223,8,10,10,10,12,10,226,9,10,1,10,
        3,10,229,8,10,1,10,1,10,1,10,3,10,234,8,10,1,11,4,11,237,8,11,11,
        11,12,11,238,1,12,1,12,1,12,1,12,3,12,245,8,12,1,12,3,12,248,8,12,
        1,12,1,12,3,12,252,8,12,1,12,1,12,3,12,256,8,12,1,13,1,13,3,13,260,
        8,13,1,13,1,13,1,13,3,13,265,8,13,1,13,3,13,268,8,13,1,14,1,14,1,
        14,5,14,273,8,14,10,14,12,14,276,9,14,1,15,1,15,1,15,1,15,4,15,282,
        8,15,11,15,12,15,283,3,15,286,8,15,1,16,1,16,5,16,290,8,16,10,16,
        12,16,293,9,16,1,16,1,16,1,17,1,17,3,17,299,8,17,1,18,4,18,302,8,
        18,11,18,12,18,303,1,19,1,19,1,19,1,19,3,19,310,8,19,1,19,3,19,313,
        8,19,1,20,4,20,316,8,20,11,20,12,20,317,1,21,1,21,1,22,1,22,1,22,
        3,22,325,8,22,1,22,3,22,328,8,22,1,22,3,22,331,8,22,1,23,1,23,1,
        23,5,23,336,8,23,10,23,12,23,339,9,23,1,24,1,24,1,24,1,24,5,24,345,
        8,24,10,24,12,24,348,9,24,1,24,1,24,1,25,1,25,1,25,3,25,355,8,25,
        1,26,1,26,1,26,1,26,5,26,361,8,26,10,26,12,26,364,9,26,1,26,1,26,
        1,27,1,27,1,27,3,27,371,8,27,1,27,3,27,374,8,27,1,28,1,28,4,28,378,
        8,28,11,28,12,28,379,1,29,1,29,1,29,5,29,385,8,29,10,29,12,29,388,
        9,29,1,30,1,30,1,31,1,31,1,31,0,0,32,0,2,4,6,8,10,12,14,16,18,20,
        22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,0,
        10,1,0,4,7,2,0,46,48,52,52,3,0,46,46,50,50,52,52,1,0,47,48,2,1,1,
        2,4,7,1,0,46,46,2,0,3,3,13,18,2,0,8,8,23,23,4,0,10,11,24,25,37,37,
        85,85,2,0,27,29,86,87,433,0,65,1,0,0,0,2,81,1,0,0,0,4,86,1,0,0,0,
        6,106,1,0,0,0,8,111,1,0,0,0,10,135,1,0,0,0,12,173,1,0,0,0,14,176,
        1,0,0,0,16,198,1,0,0,0,18,207,1,0,0,0,20,218,1,0,0,0,22,236,1,0,
        0,0,24,255,1,0,0,0,26,267,1,0,0,0,28,269,1,0,0,0,30,285,1,0,0,0,
        32,287,1,0,0,0,34,298,1,0,0,0,36,301,1,0,0,0,38,305,1,0,0,0,40,315,
        1,0,0,0,42,319,1,0,0,0,44,324,1,0,0,0,46,332,1,0,0,0,48,340,1,0,
        0,0,50,351,1,0,0,0,52,356,1,0,0,0,54,373,1,0,0,0,56,377,1,0,0,0,
        58,381,1,0,0,0,60,389,1,0,0,0,62,391,1,0,0,0,64,66,3,2,1,0,65,64,
        1,0,0,0,65,66,1,0,0,0,66,70,1,0,0,0,67,69,3,4,2,0,68,67,1,0,0,0,
        69,72,1,0,0,0,70,68,1,0,0,0,70,71,1,0,0,0,71,76,1,0,0,0,72,70,1,
        0,0,0,73,75,3,6,3,0,74,73,1,0,0,0,75,78,1,0,0,0,76,74,1,0,0,0,76,
        77,1,0,0,0,77,79,1,0,0,0,78,76,1,0,0,0,79,80,5,0,0,1,80,1,1,0,0,
        0,81,82,5,1,0,0,82,84,3,58,29,0,83,85,5,51,0,0,84,83,1,0,0,0,84,
        85,1,0,0,0,85,3,1,0,0,0,86,88,5,2,0,0,87,89,5,3,0,0,88,87,1,0,0,
        0,88,89,1,0,0,0,89,90,1,0,0,0,90,93,3,58,29,0,91,92,5,53,0,0,92,
        94,5,61,0,0,93,91,1,0,0,0,93,94,1,0,0,0,94,97,1,0,0,0,95,96,5,24,
        0,0,96,98,3,60,30,0,97,95,1,0,0,0,97,98,1,0,0,0,98,100,1,0,0,0,99,
        101,5,51,0,0,100,99,1,0,0,0,100,101,1,0,0,0,101,5,1,0,0,0,102,107,
        3,8,4,0,103,107,3,14,7,0,104,107,3,16,8,0,105,107,3,36,18,0,106,
        102,1,0,0,0,106,103,1,0,0,0,106,104,1,0,0,0,106,105,1,0,0,0,107,
        7,1,0,0,0,108,110,3,38,19,0,109,108,1,0,0,0,110,113,1,0,0,0,111,
        109,1,0,0,0,111,112,1,0,0,0,112,117,1,0,0,0,113,111,1,0,0,0,114,
        116,3,42,21,0,115,114,1,0,0,0,116,119,1,0,0,0,117,115,1,0,0,0,117,
        118,1,0,0,0,118,120,1,0,0,0,119,117,1,0,0,0,120,121,7,0,0,0,121,
        123,3,60,30,0,122,124,3,48,24,0,123,122,1,0,0,0,123,124,1,0,0,0,
        124,127,1,0,0,0,125,126,5,8,0,0,126,128,3,44,22,0,127,125,1,0,0,
        0,127,128,1,0,0,0,128,131,1,0,0,0,129,130,5,9,0,0,130,132,3,46,23,
        0,131,129,1,0,0,0,131,132,1,0,0,0,132,133,1,0,0,0,133,134,3,10,5,
        0,134,9,1,0,0,0,135,139,5,47,0,0,136,138,3,12,6,0,137,136,1,0,0,
        0,138,141,1,0,0,0,139,137,1,0,0,0,139,140,1,0,0,0,140,142,1,0,0,
        0,141,139,1,0,0,0,142,143,5,48,0,0,143,11,1,0,0,0,144,174,3,8,4,
        0,145,147,3,38,19,0,146,145,1,0,0,0,147,150,1,0,0,0,148,146,1,0,
        0,0,148,149,1,0,0,0,149,154,1,0,0,0,150,148,1,0,0,0,151,153,3,42,
        21,0,152,151,1,0,0,0,153,156,1,0,0,0,154,152,1,0,0,0,154,155,1,0,
        0,0,155,157,1,0,0,0,156,154,1,0,0,0,157,174,3,14,7,0,158,160,3,38,
        19,0,159,158,1,0,0,0,160,163,1,0,0,0,161,159,1,0,0,0,161,162,1,0,
        0,0,162,167,1,0,0,0,163,161,1,0,0,0,164,166,3,42,21,0,165,164,1,
        0,0,0,166,169,1,0,0,0,167,165,1,0,0,0,167,168,1,0,0,0,168,170,1,
        0,0,0,169,167,1,0,0,0,170,174,3,16,8,0,171,174,3,32,16,0,172,174,
        5,51,0,0,173,144,1,0,0,0,173,148,1,0,0,0,173,161,1,0,0,0,173,171,
        1,0,0,0,173,172,1,0,0,0,174,13,1,0,0,0,175,177,3,44,22,0,176,175,
        1,0,0,0,176,177,1,0,0,0,177,178,1,0,0,0,178,179,3,60,30,0,179,181,
        5,45,0,0,180,182,3,18,9,0,181,180,1,0,0,0,181,182,1,0,0,0,182,183,
        1,0,0,0,183,186,5,46,0,0,184,185,5,20,0,0,185,187,3,46,23,0,186,
        184,1,0,0,0,186,187,1,0,0,0,187,196,1,0,0,0,188,197,3,32,16,0,189,
        190,5,56,0,0,190,192,3,24,12,0,191,189,1,0,0,0,191,192,1,0,0,0,192,
        194,1,0,0,0,193,195,5,51,0,0,194,193,1,0,0,0,194,195,1,0,0,0,195,
        197,1,0,0,0,196,188,1,0,0,0,196,191,1,0,0,0,197,15,1,0,0,0,198,199,
        3,44,22,0,199,202,3,60,30,0,200,201,5,56,0,0,201,203,3,24,12,0,202,
        200,1,0,0,0,202,203,1,0,0,0,203,205,1,0,0,0,204,206,5,51,0,0,205,
        204,1,0,0,0,205,206,1,0,0,0,206,17,1,0,0,0,207,212,3,20,10,0,208,
        209,5,52,0,0,209,211,3,20,10,0,210,208,1,0,0,0,211,214,1,0,0,0,212,
        210,1,0,0,0,212,213,1,0,0,0,213,19,1,0,0,0,214,212,1,0,0,0,215,217,
        3,38,19,0,216,215,1,0,0,0,217,220,1,0,0,0,218,216,1,0,0,0,218,219,
        1,0,0,0,219,224,1,0,0,0,220,218,1,0,0,0,221,223,3,42,21,0,222,221,
        1,0,0,0,223,226,1,0,0,0,224,222,1,0,0,0,224,225,1,0,0,0,225,228,
        1,0,0,0,226,224,1,0,0,0,227,229,3,44,22,0,228,227,1,0,0,0,228,229,
        1,0,0,0,229,230,1,0,0,0,230,233,3,60,30,0,231,232,5,56,0,0,232,234,
        3,22,11,0,233,231,1,0,0,0,233,234,1,0,0,0,234,21,1,0,0,0,235,237,
        8,1,0,0,236,235,1,0,0,0,237,238,1,0,0,0,238,236,1,0,0,0,238,239,
        1,0,0,0,239,23,1,0,0,0,240,256,3,62,31,0,241,242,5,12,0,0,242,244,
        3,44,22,0,243,245,3,52,26,0,244,243,1,0,0,0,244,245,1,0,0,0,245,
        247,1,0,0,0,246,248,3,26,13,0,247,246,1,0,0,0,247,248,1,0,0,0,248,
        256,1,0,0,0,249,251,3,58,29,0,250,252,3,26,13,0,251,250,1,0,0,0,
        251,252,1,0,0,0,252,256,1,0,0,0,253,256,3,26,13,0,254,256,3,32,16,
        0,255,240,1,0,0,0,255,241,1,0,0,0,255,249,1,0,0,0,255,253,1,0,0,
        0,255,254,1,0,0,0,256,25,1,0,0,0,257,259,5,45,0,0,258,260,3,28,14,
        0,259,258,1,0,0,0,259,260,1,0,0,0,260,261,1,0,0,0,261,268,5,46,0,
        0,262,264,5,49,0,0,263,265,3,28,14,0,264,263,1,0,0,0,264,265,1,0,
        0,0,265,266,1,0,0,0,266,268,5,50,0,0,267,257,1,0,0,0,267,262,1,0,
        0,0,268,27,1,0,0,0,269,274,3,30,15,0,270,271,5,52,0,0,271,273,3,
        30,15,0,272,270,1,0,0,0,273,276,1,0,0,0,274,272,1,0,0,0,274,275,
        1,0,0,0,275,29,1,0,0,0,276,274,1,0,0,0,277,286,3,62,31,0,278,286,
        3,38,19,0,279,286,3,32,16,0,280,282,8,2,0,0,281,280,1,0,0,0,282,
        283,1,0,0,0,283,281,1,0,0,0,283,284,1,0,0,0,284,286,1,0,0,0,285,
        277,1,0,0,0,285,278,1,0,0,0,285,279,1,0,0,0,285,281,1,0,0,0,286,
        31,1,0,0,0,287,291,5,47,0,0,288,290,3,34,17,0,289,288,1,0,0,0,290,
        293,1,0,0,0,291,289,1,0,0,0,291,292,1,0,0,0,292,294,1,0,0,0,293,
        291,1,0,0,0,294,295,5,48,0,0,295,33,1,0,0,0,296,299,3,32,16,0,297,
        299,8,3,0,0,298,296,1,0,0,0,298,297,1,0,0,0,299,35,1,0,0,0,300,302,
        8,4,0,0,301,300,1,0,0,0,302,303,1,0,0,0,303,301,1,0,0,0,303,304,
        1,0,0,0,304,37,1,0,0,0,305,306,5,44,0,0,306,312,3,58,29,0,307,309,
        5,45,0,0,308,310,3,40,20,0,309,308,1,0,0,0,309,310,1,0,0,0,310,311,
        1,0,0,0,311,313,5,46,0,0,312,307,1,0,0,0,312,313,1,0,0,0,313,39,
        1,0,0,0,314,316,8,5,0,0,315,314,1,0,0,0,316,317,1,0,0,0,317,315,
        1,0,0,0,317,318,1,0,0,0,318,41,1,0,0,0,319,320,7,6,0,0,320,43,1,
        0,0,0,321,325,5,10,0,0,322,325,5,11,0,0,323,325,3,58,29,0,324,321,
        1,0,0,0,324,322,1,0,0,0,324,323,1,0,0,0,325,327,1,0,0,0,326,328,
        3,52,26,0,327,326,1,0,0,0,327,328,1,0,0,0,328,330,1,0,0,0,329,331,
        3,56,28,0,330,329,1,0,0,0,330,331,1,0,0,0,331,45,1,0,0,0,332,337,
        3,44,22,0,333,334,5,52,0,0,334,336,3,44,22,0,335,333,1,0,0,0,336,
        339,1,0,0,0,337,335,1,0,0,0,337,338,1,0,0,0,338,47,1,0,0,0,339,337,
        1,0,0,0,340,341,5,59,0,0,341,346,3,50,25,0,342,343,5,52,0,0,343,
        345,3,50,25,0,344,342,1,0,0,0,345,348,1,0,0,0,346,344,1,0,0,0,346,
        347,1,0,0,0,347,349,1,0,0,0,348,346,1,0,0,0,349,350,5,60,0,0,350,
        49,1,0,0,0,351,354,3,60,30,0,352,353,5,8,0,0,353,355,3,44,22,0,354,
        352,1,0,0,0,354,355,1,0,0,0,355,51,1,0,0,0,356,357,5,59,0,0,357,
        362,3,54,27,0,358,359,5,52,0,0,359,361,3,54,27,0,360,358,1,0,0,0,
        361,364,1,0,0,0,362,360,1,0,0,0,362,363,1,0,0,0,363,365,1,0,0,0,
        364,362,1,0,0,0,365,366,5,60,0,0,366,53,1,0,0,0,367,374,3,44,22,
        0,368,370,5,55,0,0,369,371,7,7,0,0,370,369,1,0,0,0,370,371,1,0,0,
        0,371,372,1,0,0,0,372,374,3,44,22,0,373,367,1,0,0,0,373,368,1,0,
        0,0,374,55,1,0,0,0,375,376,5,49,0,0,376,378,5,50,0,0,377,375,1,0,
        0,0,378,379,1,0,0,0,379,377,1,0,0,0,379,380,1,0,0,0,380,57,1,0,0,
        0,381,386,3,60,30,0,382,383,5,53,0,0,383,385,3,60,30,0,384,382,1,
        0,0,0,385,388,1,0,0,0,386,384,1,0,0,0,386,387,1,0,0,0,387,59,1,0,
        0,0,388,386,1,0,0,0,389,390,7,8,0,0,390,61,1,0,0,0,391,392,7,9,0,
        0,392,63,1,0,0,0,61,65,70,76,84,88,93,97,100,106,111,117,123,127,
        131,139,148,154,161,167,173,176,181,186,191,194,196,202,205,212,
        218,224,228,233,238,244,247,251,255,259,264,267,274,283,285,291,
        298,303,309,312,317,324,327,330,337,346,354,362,370,373,379,386
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!GroovyParser.__ATN) {
            GroovyParser.__ATN = new antlr.ATNDeserializer().deserialize(GroovyParser._serializedATN);
        }

        return GroovyParser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(GroovyParser.literalNames, GroovyParser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return GroovyParser.vocabulary;
    }

    private static readonly decisionsToDFA = GroovyParser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class GroovyFileContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(GroovyParser.EOF, 0)!;
    }
    public packageDecl(): PackageDeclContext | null {
        return this.getRuleContext(0, PackageDeclContext);
    }
    public importDecl(): ImportDeclContext[];
    public importDecl(i: number): ImportDeclContext | null;
    public importDecl(i?: number): ImportDeclContext[] | ImportDeclContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ImportDeclContext);
        }

        return this.getRuleContext(i, ImportDeclContext);
    }
    public fileMember(): FileMemberContext[];
    public fileMember(i: number): FileMemberContext | null;
    public fileMember(i?: number): FileMemberContext[] | FileMemberContext | null {
        if (i === undefined) {
            return this.getRuleContexts(FileMemberContext);
        }

        return this.getRuleContext(i, FileMemberContext);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_groovyFile;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterGroovyFile) {
             listener.enterGroovyFile(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitGroovyFile) {
             listener.exitGroovyFile(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitGroovyFile) {
            return visitor.visitGroovyFile(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PackageDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public PACKAGE(): antlr.TerminalNode {
        return this.getToken(GroovyParser.PACKAGE, 0)!;
    }
    public qualifiedName(): QualifiedNameContext {
        return this.getRuleContext(0, QualifiedNameContext)!;
    }
    public SEMI(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.SEMI, 0);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_packageDecl;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterPackageDecl) {
             listener.enterPackageDecl(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitPackageDecl) {
             listener.exitPackageDecl(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitPackageDecl) {
            return visitor.visitPackageDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ImportDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IMPORT(): antlr.TerminalNode {
        return this.getToken(GroovyParser.IMPORT, 0)!;
    }
    public qualifiedName(): QualifiedNameContext {
        return this.getRuleContext(0, QualifiedNameContext)!;
    }
    public STATIC(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.STATIC, 0);
    }
    public DOT(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.DOT, 0);
    }
    public MUL(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.MUL, 0);
    }
    public AS(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.AS, 0);
    }
    public identifier(): IdentifierContext | null {
        return this.getRuleContext(0, IdentifierContext);
    }
    public SEMI(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.SEMI, 0);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_importDecl;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterImportDecl) {
             listener.enterImportDecl(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitImportDecl) {
             listener.exitImportDecl(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitImportDecl) {
            return visitor.visitImportDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FileMemberContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public classDecl(): ClassDeclContext | null {
        return this.getRuleContext(0, ClassDeclContext);
    }
    public methodDecl(): MethodDeclContext | null {
        return this.getRuleContext(0, MethodDeclContext);
    }
    public fieldDecl(): FieldDeclContext | null {
        return this.getRuleContext(0, FieldDeclContext);
    }
    public scriptChunk(): ScriptChunkContext | null {
        return this.getRuleContext(0, ScriptChunkContext);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_fileMember;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterFileMember) {
             listener.enterFileMember(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitFileMember) {
             listener.exitFileMember(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitFileMember) {
            return visitor.visitFileMember(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClassDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public identifier(): IdentifierContext {
        return this.getRuleContext(0, IdentifierContext)!;
    }
    public classBody(): ClassBodyContext {
        return this.getRuleContext(0, ClassBodyContext)!;
    }
    public CLASS(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.CLASS, 0);
    }
    public INTERFACE(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.INTERFACE, 0);
    }
    public TRAIT(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.TRAIT, 0);
    }
    public ENUM(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.ENUM, 0);
    }
    public annotation(): AnnotationContext[];
    public annotation(i: number): AnnotationContext | null;
    public annotation(i?: number): AnnotationContext[] | AnnotationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AnnotationContext);
        }

        return this.getRuleContext(i, AnnotationContext);
    }
    public modifier(): ModifierContext[];
    public modifier(i: number): ModifierContext | null;
    public modifier(i?: number): ModifierContext[] | ModifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ModifierContext);
        }

        return this.getRuleContext(i, ModifierContext);
    }
    public typeParams(): TypeParamsContext | null {
        return this.getRuleContext(0, TypeParamsContext);
    }
    public EXTENDS(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.EXTENDS, 0);
    }
    public type(): TypeContext | null {
        return this.getRuleContext(0, TypeContext);
    }
    public IMPLEMENTS(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.IMPLEMENTS, 0);
    }
    public typeList(): TypeListContext | null {
        return this.getRuleContext(0, TypeListContext);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_classDecl;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterClassDecl) {
             listener.enterClassDecl(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitClassDecl) {
             listener.exitClassDecl(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitClassDecl) {
            return visitor.visitClassDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClassBodyContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(GroovyParser.LBRACE, 0)!;
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(GroovyParser.RBRACE, 0)!;
    }
    public classMember(): ClassMemberContext[];
    public classMember(i: number): ClassMemberContext | null;
    public classMember(i?: number): ClassMemberContext[] | ClassMemberContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ClassMemberContext);
        }

        return this.getRuleContext(i, ClassMemberContext);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_classBody;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterClassBody) {
             listener.enterClassBody(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitClassBody) {
             listener.exitClassBody(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitClassBody) {
            return visitor.visitClassBody(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClassMemberContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public classDecl(): ClassDeclContext | null {
        return this.getRuleContext(0, ClassDeclContext);
    }
    public methodDecl(): MethodDeclContext | null {
        return this.getRuleContext(0, MethodDeclContext);
    }
    public annotation(): AnnotationContext[];
    public annotation(i: number): AnnotationContext | null;
    public annotation(i?: number): AnnotationContext[] | AnnotationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AnnotationContext);
        }

        return this.getRuleContext(i, AnnotationContext);
    }
    public modifier(): ModifierContext[];
    public modifier(i: number): ModifierContext | null;
    public modifier(i?: number): ModifierContext[] | ModifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ModifierContext);
        }

        return this.getRuleContext(i, ModifierContext);
    }
    public fieldDecl(): FieldDeclContext | null {
        return this.getRuleContext(0, FieldDeclContext);
    }
    public block(): BlockContext | null {
        return this.getRuleContext(0, BlockContext);
    }
    public SEMI(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.SEMI, 0);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_classMember;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterClassMember) {
             listener.enterClassMember(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitClassMember) {
             listener.exitClassMember(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitClassMember) {
            return visitor.visitClassMember(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MethodDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public identifier(): IdentifierContext {
        return this.getRuleContext(0, IdentifierContext)!;
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(GroovyParser.LPAREN, 0)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(GroovyParser.RPAREN, 0)!;
    }
    public block(): BlockContext | null {
        return this.getRuleContext(0, BlockContext);
    }
    public type(): TypeContext | null {
        return this.getRuleContext(0, TypeContext);
    }
    public paramList(): ParamListContext | null {
        return this.getRuleContext(0, ParamListContext);
    }
    public THROWS(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.THROWS, 0);
    }
    public typeList(): TypeListContext | null {
        return this.getRuleContext(0, TypeListContext);
    }
    public ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.ASSIGN, 0);
    }
    public simpleInit(): SimpleInitContext | null {
        return this.getRuleContext(0, SimpleInitContext);
    }
    public SEMI(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.SEMI, 0);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_methodDecl;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterMethodDecl) {
             listener.enterMethodDecl(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitMethodDecl) {
             listener.exitMethodDecl(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitMethodDecl) {
            return visitor.visitMethodDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FieldDeclContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public type(): TypeContext {
        return this.getRuleContext(0, TypeContext)!;
    }
    public identifier(): IdentifierContext {
        return this.getRuleContext(0, IdentifierContext)!;
    }
    public ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.ASSIGN, 0);
    }
    public simpleInit(): SimpleInitContext | null {
        return this.getRuleContext(0, SimpleInitContext);
    }
    public SEMI(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.SEMI, 0);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_fieldDecl;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterFieldDecl) {
             listener.enterFieldDecl(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitFieldDecl) {
             listener.exitFieldDecl(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitFieldDecl) {
            return visitor.visitFieldDecl(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParamListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public param(): ParamContext[];
    public param(i: number): ParamContext | null;
    public param(i?: number): ParamContext[] | ParamContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ParamContext);
        }

        return this.getRuleContext(i, ParamContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.COMMA);
    	} else {
    		return this.getToken(GroovyParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_paramList;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterParamList) {
             listener.enterParamList(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitParamList) {
             listener.exitParamList(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitParamList) {
            return visitor.visitParamList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParamContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public identifier(): IdentifierContext {
        return this.getRuleContext(0, IdentifierContext)!;
    }
    public annotation(): AnnotationContext[];
    public annotation(i: number): AnnotationContext | null;
    public annotation(i?: number): AnnotationContext[] | AnnotationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AnnotationContext);
        }

        return this.getRuleContext(i, AnnotationContext);
    }
    public modifier(): ModifierContext[];
    public modifier(i: number): ModifierContext | null;
    public modifier(i?: number): ModifierContext[] | ModifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ModifierContext);
        }

        return this.getRuleContext(i, ModifierContext);
    }
    public type(): TypeContext | null {
        return this.getRuleContext(0, TypeContext);
    }
    public ASSIGN(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.ASSIGN, 0);
    }
    public paramInit(): ParamInitContext | null {
        return this.getRuleContext(0, ParamInitContext);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_param;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterParam) {
             listener.enterParam(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitParam) {
             listener.exitParam(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitParam) {
            return visitor.visitParam(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParamInitContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.COMMA);
    	} else {
    		return this.getToken(GroovyParser.COMMA, i);
    	}
    }
    public RPAREN(): antlr.TerminalNode[];
    public RPAREN(i: number): antlr.TerminalNode | null;
    public RPAREN(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.RPAREN);
    	} else {
    		return this.getToken(GroovyParser.RPAREN, i);
    	}
    }
    public LBRACE(): antlr.TerminalNode[];
    public LBRACE(i: number): antlr.TerminalNode | null;
    public LBRACE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.LBRACE);
    	} else {
    		return this.getToken(GroovyParser.LBRACE, i);
    	}
    }
    public RBRACE(): antlr.TerminalNode[];
    public RBRACE(i: number): antlr.TerminalNode | null;
    public RBRACE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.RBRACE);
    	} else {
    		return this.getToken(GroovyParser.RBRACE, i);
    	}
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_paramInit;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterParamInit) {
             listener.enterParamInit(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitParamInit) {
             listener.exitParamInit(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitParamInit) {
            return visitor.visitParamInit(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SimpleInitContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public literal(): LiteralContext | null {
        return this.getRuleContext(0, LiteralContext);
    }
    public NEW(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.NEW, 0);
    }
    public type(): TypeContext | null {
        return this.getRuleContext(0, TypeContext);
    }
    public typeArgs(): TypeArgsContext | null {
        return this.getRuleContext(0, TypeArgsContext);
    }
    public arguments(): ArgumentsContext | null {
        return this.getRuleContext(0, ArgumentsContext);
    }
    public qualifiedName(): QualifiedNameContext | null {
        return this.getRuleContext(0, QualifiedNameContext);
    }
    public block(): BlockContext | null {
        return this.getRuleContext(0, BlockContext);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_simpleInit;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterSimpleInit) {
             listener.enterSimpleInit(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitSimpleInit) {
             listener.exitSimpleInit(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitSimpleInit) {
            return visitor.visitSimpleInit(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ArgumentsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LPAREN(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.LPAREN, 0);
    }
    public RPAREN(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.RPAREN, 0);
    }
    public argList(): ArgListContext | null {
        return this.getRuleContext(0, ArgListContext);
    }
    public LBRACK(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.LBRACK, 0);
    }
    public RBRACK(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.RBRACK, 0);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_arguments;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterArguments) {
             listener.enterArguments(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitArguments) {
             listener.exitArguments(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitArguments) {
            return visitor.visitArguments(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ArgListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public arg(): ArgContext[];
    public arg(i: number): ArgContext | null;
    public arg(i?: number): ArgContext[] | ArgContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ArgContext);
        }

        return this.getRuleContext(i, ArgContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.COMMA);
    	} else {
    		return this.getToken(GroovyParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_argList;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterArgList) {
             listener.enterArgList(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitArgList) {
             listener.exitArgList(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitArgList) {
            return visitor.visitArgList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public literal(): LiteralContext | null {
        return this.getRuleContext(0, LiteralContext);
    }
    public annotation(): AnnotationContext | null {
        return this.getRuleContext(0, AnnotationContext);
    }
    public block(): BlockContext | null {
        return this.getRuleContext(0, BlockContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.COMMA);
    	} else {
    		return this.getToken(GroovyParser.COMMA, i);
    	}
    }
    public RPAREN(): antlr.TerminalNode[];
    public RPAREN(i: number): antlr.TerminalNode | null;
    public RPAREN(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.RPAREN);
    	} else {
    		return this.getToken(GroovyParser.RPAREN, i);
    	}
    }
    public RBRACK(): antlr.TerminalNode[];
    public RBRACK(i: number): antlr.TerminalNode | null;
    public RBRACK(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.RBRACK);
    	} else {
    		return this.getToken(GroovyParser.RBRACK, i);
    	}
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_arg;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterArg) {
             listener.enterArg(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitArg) {
             listener.exitArg(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitArg) {
            return visitor.visitArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BlockContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(GroovyParser.LBRACE, 0)!;
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(GroovyParser.RBRACE, 0)!;
    }
    public blockItem(): BlockItemContext[];
    public blockItem(i: number): BlockItemContext | null;
    public blockItem(i?: number): BlockItemContext[] | BlockItemContext | null {
        if (i === undefined) {
            return this.getRuleContexts(BlockItemContext);
        }

        return this.getRuleContext(i, BlockItemContext);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_block;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterBlock) {
             listener.enterBlock(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitBlock) {
             listener.exitBlock(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitBlock) {
            return visitor.visitBlock(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BlockItemContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public block(): BlockContext | null {
        return this.getRuleContext(0, BlockContext);
    }
    public LBRACE(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.LBRACE, 0);
    }
    public RBRACE(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.RBRACE, 0);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_blockItem;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterBlockItem) {
             listener.enterBlockItem(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitBlockItem) {
             listener.exitBlockItem(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitBlockItem) {
            return visitor.visitBlockItem(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ScriptChunkContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CLASS(): antlr.TerminalNode[];
    public CLASS(i: number): antlr.TerminalNode | null;
    public CLASS(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.CLASS);
    	} else {
    		return this.getToken(GroovyParser.CLASS, i);
    	}
    }
    public INTERFACE(): antlr.TerminalNode[];
    public INTERFACE(i: number): antlr.TerminalNode | null;
    public INTERFACE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.INTERFACE);
    	} else {
    		return this.getToken(GroovyParser.INTERFACE, i);
    	}
    }
    public TRAIT(): antlr.TerminalNode[];
    public TRAIT(i: number): antlr.TerminalNode | null;
    public TRAIT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.TRAIT);
    	} else {
    		return this.getToken(GroovyParser.TRAIT, i);
    	}
    }
    public ENUM(): antlr.TerminalNode[];
    public ENUM(i: number): antlr.TerminalNode | null;
    public ENUM(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.ENUM);
    	} else {
    		return this.getToken(GroovyParser.ENUM, i);
    	}
    }
    public PACKAGE(): antlr.TerminalNode[];
    public PACKAGE(i: number): antlr.TerminalNode | null;
    public PACKAGE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.PACKAGE);
    	} else {
    		return this.getToken(GroovyParser.PACKAGE, i);
    	}
    }
    public IMPORT(): antlr.TerminalNode[];
    public IMPORT(i: number): antlr.TerminalNode | null;
    public IMPORT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.IMPORT);
    	} else {
    		return this.getToken(GroovyParser.IMPORT, i);
    	}
    }
    public EOF(): antlr.TerminalNode[];
    public EOF(i: number): antlr.TerminalNode | null;
    public EOF(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.EOF);
    	} else {
    		return this.getToken(GroovyParser.EOF, i);
    	}
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_scriptChunk;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterScriptChunk) {
             listener.enterScriptChunk(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitScriptChunk) {
             listener.exitScriptChunk(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitScriptChunk) {
            return visitor.visitScriptChunk(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AnnotationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public AT(): antlr.TerminalNode {
        return this.getToken(GroovyParser.AT, 0)!;
    }
    public qualifiedName(): QualifiedNameContext {
        return this.getRuleContext(0, QualifiedNameContext)!;
    }
    public LPAREN(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.LPAREN, 0);
    }
    public RPAREN(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.RPAREN, 0);
    }
    public annotationArgs(): AnnotationArgsContext | null {
        return this.getRuleContext(0, AnnotationArgsContext);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_annotation;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterAnnotation) {
             listener.enterAnnotation(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitAnnotation) {
             listener.exitAnnotation(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitAnnotation) {
            return visitor.visitAnnotation(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AnnotationArgsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public RPAREN(): antlr.TerminalNode[];
    public RPAREN(i: number): antlr.TerminalNode | null;
    public RPAREN(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.RPAREN);
    	} else {
    		return this.getToken(GroovyParser.RPAREN, i);
    	}
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_annotationArgs;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterAnnotationArgs) {
             listener.enterAnnotationArgs(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitAnnotationArgs) {
             listener.exitAnnotationArgs(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitAnnotationArgs) {
            return visitor.visitAnnotationArgs(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STATIC(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.STATIC, 0);
    }
    public FINAL(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.FINAL, 0);
    }
    public PUBLIC(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.PUBLIC, 0);
    }
    public PROTECTED(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.PROTECTED, 0);
    }
    public PRIVATE(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.PRIVATE, 0);
    }
    public ABSTRACT(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.ABSTRACT, 0);
    }
    public SYNCHRONIZED(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.SYNCHRONIZED, 0);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_modifier;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterModifier) {
             listener.enterModifier(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitModifier) {
             listener.exitModifier(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitModifier) {
            return visitor.visitModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DEF(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.DEF, 0);
    }
    public VOID(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.VOID, 0);
    }
    public qualifiedName(): QualifiedNameContext | null {
        return this.getRuleContext(0, QualifiedNameContext);
    }
    public typeArgs(): TypeArgsContext | null {
        return this.getRuleContext(0, TypeArgsContext);
    }
    public dims(): DimsContext | null {
        return this.getRuleContext(0, DimsContext);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_type;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterType) {
             listener.enterType(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitType) {
             listener.exitType(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitType) {
            return visitor.visitType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public type_(): TypeContext[];
    public type_(i: number): TypeContext | null;
    public type_(i?: number): TypeContext[] | TypeContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TypeContext);
        }

        return this.getRuleContext(i, TypeContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.COMMA);
    	} else {
    		return this.getToken(GroovyParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_typeList;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterTypeList) {
             listener.enterTypeList(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitTypeList) {
             listener.exitTypeList(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitTypeList) {
            return visitor.visitTypeList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeParamsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LANGLE(): antlr.TerminalNode {
        return this.getToken(GroovyParser.LANGLE, 0)!;
    }
    public typeParam(): TypeParamContext[];
    public typeParam(i: number): TypeParamContext | null;
    public typeParam(i?: number): TypeParamContext[] | TypeParamContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TypeParamContext);
        }

        return this.getRuleContext(i, TypeParamContext);
    }
    public RANGLE(): antlr.TerminalNode {
        return this.getToken(GroovyParser.RANGLE, 0)!;
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.COMMA);
    	} else {
    		return this.getToken(GroovyParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_typeParams;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterTypeParams) {
             listener.enterTypeParams(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitTypeParams) {
             listener.exitTypeParams(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitTypeParams) {
            return visitor.visitTypeParams(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeParamContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public identifier(): IdentifierContext {
        return this.getRuleContext(0, IdentifierContext)!;
    }
    public EXTENDS(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.EXTENDS, 0);
    }
    public type(): TypeContext | null {
        return this.getRuleContext(0, TypeContext);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_typeParam;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterTypeParam) {
             listener.enterTypeParam(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitTypeParam) {
             listener.exitTypeParam(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitTypeParam) {
            return visitor.visitTypeParam(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeArgsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LANGLE(): antlr.TerminalNode {
        return this.getToken(GroovyParser.LANGLE, 0)!;
    }
    public typeArg(): TypeArgContext[];
    public typeArg(i: number): TypeArgContext | null;
    public typeArg(i?: number): TypeArgContext[] | TypeArgContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TypeArgContext);
        }

        return this.getRuleContext(i, TypeArgContext);
    }
    public RANGLE(): antlr.TerminalNode {
        return this.getToken(GroovyParser.RANGLE, 0)!;
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.COMMA);
    	} else {
    		return this.getToken(GroovyParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_typeArgs;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterTypeArgs) {
             listener.enterTypeArgs(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitTypeArgs) {
             listener.exitTypeArgs(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitTypeArgs) {
            return visitor.visitTypeArgs(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public type(): TypeContext {
        return this.getRuleContext(0, TypeContext)!;
    }
    public QUEST(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.QUEST, 0);
    }
    public EXTENDS(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.EXTENDS, 0);
    }
    public SUPER(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.SUPER, 0);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_typeArg;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterTypeArg) {
             listener.enterTypeArg(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitTypeArg) {
             listener.exitTypeArg(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitTypeArg) {
            return visitor.visitTypeArg(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DimsContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LBRACK(): antlr.TerminalNode[];
    public LBRACK(i: number): antlr.TerminalNode | null;
    public LBRACK(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.LBRACK);
    	} else {
    		return this.getToken(GroovyParser.LBRACK, i);
    	}
    }
    public RBRACK(): antlr.TerminalNode[];
    public RBRACK(i: number): antlr.TerminalNode | null;
    public RBRACK(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.RBRACK);
    	} else {
    		return this.getToken(GroovyParser.RBRACK, i);
    	}
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_dims;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterDims) {
             listener.enterDims(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitDims) {
             listener.exitDims(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitDims) {
            return visitor.visitDims(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class QualifiedNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public identifier(): IdentifierContext[];
    public identifier(i: number): IdentifierContext | null;
    public identifier(i?: number): IdentifierContext[] | IdentifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(IdentifierContext);
        }

        return this.getRuleContext(i, IdentifierContext);
    }
    public DOT(): antlr.TerminalNode[];
    public DOT(i: number): antlr.TerminalNode | null;
    public DOT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(GroovyParser.DOT);
    	} else {
    		return this.getToken(GroovyParser.DOT, i);
    	}
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_qualifiedName;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterQualifiedName) {
             listener.enterQualifiedName(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitQualifiedName) {
             listener.exitQualifiedName(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitQualifiedName) {
            return visitor.visitQualifiedName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class IdentifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.Identifier, 0);
    }
    public DEF(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.DEF, 0);
    }
    public VOID(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.VOID, 0);
    }
    public AS(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.AS, 0);
    }
    public IN(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.IN, 0);
    }
    public DEFAULT(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.DEFAULT, 0);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_identifier;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterIdentifier) {
             listener.enterIdentifier(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitIdentifier) {
             listener.exitIdentifier(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitIdentifier) {
            return visitor.visitIdentifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public String(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.String, 0);
    }
    public Number(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.Number, 0);
    }
    public TRUE(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.TRUE, 0);
    }
    public FALSE(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.FALSE, 0);
    }
    public NULL(): antlr.TerminalNode | null {
        return this.getToken(GroovyParser.NULL, 0);
    }
    public override get ruleIndex(): number {
        return GroovyParser.RULE_literal;
    }
    public override enterRule(listener: GroovyParserListener): void {
        if(listener.enterLiteral) {
             listener.enterLiteral(this);
        }
    }
    public override exitRule(listener: GroovyParserListener): void {
        if(listener.exitLiteral) {
             listener.exitLiteral(this);
        }
    }
    public override accept<Result>(visitor: GroovyParserVisitor<Result>): Result | null {
        if (visitor.visitLiteral) {
            return visitor.visitLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
