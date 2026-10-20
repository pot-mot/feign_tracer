// @ts-nocheck

import { AbstractParseTreeVisitor } from "antlr4ng";


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
 * This interface defines a complete generic visitor for a parse tree produced
 * by `GroovyParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export class GroovyParserVisitor<Result> extends AbstractParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by `GroovyParser.groovyFile`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGroovyFile?: (ctx: GroovyFileContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.packageDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPackageDecl?: (ctx: PackageDeclContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.importDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitImportDecl?: (ctx: ImportDeclContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.fileMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFileMember?: (ctx: FileMemberContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.classDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassDecl?: (ctx: ClassDeclContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.classBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassBody?: (ctx: ClassBodyContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.classMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassMember?: (ctx: ClassMemberContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.methodDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMethodDecl?: (ctx: MethodDeclContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.fieldDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFieldDecl?: (ctx: FieldDeclContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.paramList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParamList?: (ctx: ParamListContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.param`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParam?: (ctx: ParamContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.paramInit`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParamInit?: (ctx: ParamInitContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.simpleInit`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSimpleInit?: (ctx: SimpleInitContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.arguments`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArguments?: (ctx: ArgumentsContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.argList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArgList?: (ctx: ArgListContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.arg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArg?: (ctx: ArgContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.block`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBlock?: (ctx: BlockContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.blockItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBlockItem?: (ctx: BlockItemContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.scriptChunk`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitScriptChunk?: (ctx: ScriptChunkContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.annotation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnnotation?: (ctx: AnnotationContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.annotationArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnnotationArgs?: (ctx: AnnotationArgsContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.modifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitModifier?: (ctx: ModifierContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.type`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitType?: (ctx: TypeContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.typeList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeList?: (ctx: TypeListContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.typeParams`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeParams?: (ctx: TypeParamsContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.typeParam`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeParam?: (ctx: TypeParamContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.typeArgs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeArgs?: (ctx: TypeArgsContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.typeArg`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeArg?: (ctx: TypeArgContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.dims`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDims?: (ctx: DimsContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.qualifiedName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitQualifiedName?: (ctx: QualifiedNameContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.identifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIdentifier?: (ctx: IdentifierContext) => Result;
    /**
     * Visit a parse tree produced by `GroovyParser.literal`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteral?: (ctx: LiteralContext) => Result;
}

