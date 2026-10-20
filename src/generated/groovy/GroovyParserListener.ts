// @ts-nocheck

import { ErrorNode, ParseTreeListener, ParserRuleContext, TerminalNode } from "antlr4ng";


import { GroovyFileContext } from "./GroovyParser.js";
import { PackageDeclContext } from "./GroovyParser.js";
import { ImportDeclContext } from "./GroovyParser.js";
import { FileMemberContext } from "./GroovyParser.js";
import { ClassDeclContext } from "./GroovyParser.js";
import { ClassBodyContext } from "./GroovyParser.js";
import { ClassMemberContext } from "./GroovyParser.js";
import { MethodDeclContext } from "./GroovyParser.js";
import { FieldDeclContext } from "./GroovyParser.js";
import { ParamListContext } from "./GroovyParser.js";
import { ParamContext } from "./GroovyParser.js";
import { ParamInitContext } from "./GroovyParser.js";
import { SimpleInitContext } from "./GroovyParser.js";
import { ArgumentsContext } from "./GroovyParser.js";
import { ArgListContext } from "./GroovyParser.js";
import { ArgContext } from "./GroovyParser.js";
import { BlockContext } from "./GroovyParser.js";
import { BlockItemContext } from "./GroovyParser.js";
import { ScriptChunkContext } from "./GroovyParser.js";
import { AnnotationContext } from "./GroovyParser.js";
import { AnnotationArgsContext } from "./GroovyParser.js";
import { ModifierContext } from "./GroovyParser.js";
import { TypeContext } from "./GroovyParser.js";
import { TypeListContext } from "./GroovyParser.js";
import { TypeParamsContext } from "./GroovyParser.js";
import { TypeParamContext } from "./GroovyParser.js";
import { TypeArgsContext } from "./GroovyParser.js";
import { TypeArgContext } from "./GroovyParser.js";
import { DimsContext } from "./GroovyParser.js";
import { QualifiedNameContext } from "./GroovyParser.js";
import { IdentifierContext } from "./GroovyParser.js";
import { LiteralContext } from "./GroovyParser.js";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `GroovyParser`.
 */
export class GroovyParserListener implements ParseTreeListener {
    /**
     * Enter a parse tree produced by `GroovyParser.groovyFile`.
     * @param ctx the parse tree
     */
    enterGroovyFile?: (ctx: GroovyFileContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.groovyFile`.
     * @param ctx the parse tree
     */
    exitGroovyFile?: (ctx: GroovyFileContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.packageDecl`.
     * @param ctx the parse tree
     */
    enterPackageDecl?: (ctx: PackageDeclContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.packageDecl`.
     * @param ctx the parse tree
     */
    exitPackageDecl?: (ctx: PackageDeclContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.importDecl`.
     * @param ctx the parse tree
     */
    enterImportDecl?: (ctx: ImportDeclContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.importDecl`.
     * @param ctx the parse tree
     */
    exitImportDecl?: (ctx: ImportDeclContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.fileMember`.
     * @param ctx the parse tree
     */
    enterFileMember?: (ctx: FileMemberContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.fileMember`.
     * @param ctx the parse tree
     */
    exitFileMember?: (ctx: FileMemberContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.classDecl`.
     * @param ctx the parse tree
     */
    enterClassDecl?: (ctx: ClassDeclContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.classDecl`.
     * @param ctx the parse tree
     */
    exitClassDecl?: (ctx: ClassDeclContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.classBody`.
     * @param ctx the parse tree
     */
    enterClassBody?: (ctx: ClassBodyContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.classBody`.
     * @param ctx the parse tree
     */
    exitClassBody?: (ctx: ClassBodyContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.classMember`.
     * @param ctx the parse tree
     */
    enterClassMember?: (ctx: ClassMemberContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.classMember`.
     * @param ctx the parse tree
     */
    exitClassMember?: (ctx: ClassMemberContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.methodDecl`.
     * @param ctx the parse tree
     */
    enterMethodDecl?: (ctx: MethodDeclContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.methodDecl`.
     * @param ctx the parse tree
     */
    exitMethodDecl?: (ctx: MethodDeclContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.fieldDecl`.
     * @param ctx the parse tree
     */
    enterFieldDecl?: (ctx: FieldDeclContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.fieldDecl`.
     * @param ctx the parse tree
     */
    exitFieldDecl?: (ctx: FieldDeclContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.paramList`.
     * @param ctx the parse tree
     */
    enterParamList?: (ctx: ParamListContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.paramList`.
     * @param ctx the parse tree
     */
    exitParamList?: (ctx: ParamListContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.param`.
     * @param ctx the parse tree
     */
    enterParam?: (ctx: ParamContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.param`.
     * @param ctx the parse tree
     */
    exitParam?: (ctx: ParamContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.paramInit`.
     * @param ctx the parse tree
     */
    enterParamInit?: (ctx: ParamInitContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.paramInit`.
     * @param ctx the parse tree
     */
    exitParamInit?: (ctx: ParamInitContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.simpleInit`.
     * @param ctx the parse tree
     */
    enterSimpleInit?: (ctx: SimpleInitContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.simpleInit`.
     * @param ctx the parse tree
     */
    exitSimpleInit?: (ctx: SimpleInitContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.arguments`.
     * @param ctx the parse tree
     */
    enterArguments?: (ctx: ArgumentsContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.arguments`.
     * @param ctx the parse tree
     */
    exitArguments?: (ctx: ArgumentsContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.argList`.
     * @param ctx the parse tree
     */
    enterArgList?: (ctx: ArgListContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.argList`.
     * @param ctx the parse tree
     */
    exitArgList?: (ctx: ArgListContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.arg`.
     * @param ctx the parse tree
     */
    enterArg?: (ctx: ArgContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.arg`.
     * @param ctx the parse tree
     */
    exitArg?: (ctx: ArgContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.block`.
     * @param ctx the parse tree
     */
    enterBlock?: (ctx: BlockContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.block`.
     * @param ctx the parse tree
     */
    exitBlock?: (ctx: BlockContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.blockItem`.
     * @param ctx the parse tree
     */
    enterBlockItem?: (ctx: BlockItemContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.blockItem`.
     * @param ctx the parse tree
     */
    exitBlockItem?: (ctx: BlockItemContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.scriptChunk`.
     * @param ctx the parse tree
     */
    enterScriptChunk?: (ctx: ScriptChunkContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.scriptChunk`.
     * @param ctx the parse tree
     */
    exitScriptChunk?: (ctx: ScriptChunkContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.annotation`.
     * @param ctx the parse tree
     */
    enterAnnotation?: (ctx: AnnotationContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.annotation`.
     * @param ctx the parse tree
     */
    exitAnnotation?: (ctx: AnnotationContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.annotationArgs`.
     * @param ctx the parse tree
     */
    enterAnnotationArgs?: (ctx: AnnotationArgsContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.annotationArgs`.
     * @param ctx the parse tree
     */
    exitAnnotationArgs?: (ctx: AnnotationArgsContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.modifier`.
     * @param ctx the parse tree
     */
    enterModifier?: (ctx: ModifierContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.modifier`.
     * @param ctx the parse tree
     */
    exitModifier?: (ctx: ModifierContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.type`.
     * @param ctx the parse tree
     */
    enterType?: (ctx: TypeContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.type`.
     * @param ctx the parse tree
     */
    exitType?: (ctx: TypeContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.typeList`.
     * @param ctx the parse tree
     */
    enterTypeList?: (ctx: TypeListContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.typeList`.
     * @param ctx the parse tree
     */
    exitTypeList?: (ctx: TypeListContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.typeParams`.
     * @param ctx the parse tree
     */
    enterTypeParams?: (ctx: TypeParamsContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.typeParams`.
     * @param ctx the parse tree
     */
    exitTypeParams?: (ctx: TypeParamsContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.typeParam`.
     * @param ctx the parse tree
     */
    enterTypeParam?: (ctx: TypeParamContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.typeParam`.
     * @param ctx the parse tree
     */
    exitTypeParam?: (ctx: TypeParamContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.typeArgs`.
     * @param ctx the parse tree
     */
    enterTypeArgs?: (ctx: TypeArgsContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.typeArgs`.
     * @param ctx the parse tree
     */
    exitTypeArgs?: (ctx: TypeArgsContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.typeArg`.
     * @param ctx the parse tree
     */
    enterTypeArg?: (ctx: TypeArgContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.typeArg`.
     * @param ctx the parse tree
     */
    exitTypeArg?: (ctx: TypeArgContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.dims`.
     * @param ctx the parse tree
     */
    enterDims?: (ctx: DimsContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.dims`.
     * @param ctx the parse tree
     */
    exitDims?: (ctx: DimsContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.qualifiedName`.
     * @param ctx the parse tree
     */
    enterQualifiedName?: (ctx: QualifiedNameContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.qualifiedName`.
     * @param ctx the parse tree
     */
    exitQualifiedName?: (ctx: QualifiedNameContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.identifier`.
     * @param ctx the parse tree
     */
    enterIdentifier?: (ctx: IdentifierContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.identifier`.
     * @param ctx the parse tree
     */
    exitIdentifier?: (ctx: IdentifierContext) => void;
    /**
     * Enter a parse tree produced by `GroovyParser.literal`.
     * @param ctx the parse tree
     */
    enterLiteral?: (ctx: LiteralContext) => void;
    /**
     * Exit a parse tree produced by `GroovyParser.literal`.
     * @param ctx the parse tree
     */
    exitLiteral?: (ctx: LiteralContext) => void;

    visitTerminal(node: TerminalNode): void {}
    visitErrorNode(node: ErrorNode): void {}
    enterEveryRule(node: ParserRuleContext): void {}
    exitEveryRule(node: ParserRuleContext): void {}
}

