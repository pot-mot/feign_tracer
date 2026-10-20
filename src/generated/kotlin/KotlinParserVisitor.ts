// @ts-nocheck

import { AbstractParseTreeVisitor } from "antlr4ng";


import { KotlinFileContext } from "./KotlinParser.js";
import { ScriptContext } from "./KotlinParser.js";
import { PreambleContext } from "./KotlinParser.js";
import { FileAnnotationsContext } from "./KotlinParser.js";
import { FileAnnotationContext } from "./KotlinParser.js";
import { PackageHeaderContext } from "./KotlinParser.js";
import { ImportListContext } from "./KotlinParser.js";
import { ImportHeaderContext } from "./KotlinParser.js";
import { ImportAliasContext } from "./KotlinParser.js";
import { TopLevelObjectContext } from "./KotlinParser.js";
import { ClassDeclarationContext } from "./KotlinParser.js";
import { PrimaryConstructorContext } from "./KotlinParser.js";
import { ClassParametersContext } from "./KotlinParser.js";
import { ClassParameterContext } from "./KotlinParser.js";
import { DelegationSpecifiersContext } from "./KotlinParser.js";
import { DelegationSpecifierContext } from "./KotlinParser.js";
import { ConstructorInvocationContext } from "./KotlinParser.js";
import { ExplicitDelegationContext } from "./KotlinParser.js";
import { ClassBodyContext } from "./KotlinParser.js";
import { ClassMemberDeclarationContext } from "./KotlinParser.js";
import { AnonymousInitializerContext } from "./KotlinParser.js";
import { SecondaryConstructorContext } from "./KotlinParser.js";
import { ConstructorDelegationCallContext } from "./KotlinParser.js";
import { EnumClassBodyContext } from "./KotlinParser.js";
import { EnumEntriesContext } from "./KotlinParser.js";
import { EnumEntryContext } from "./KotlinParser.js";
import { FunctionDeclarationContext } from "./KotlinParser.js";
import { FunctionValueParametersContext } from "./KotlinParser.js";
import { FunctionValueParameterContext } from "./KotlinParser.js";
import { ParameterContext } from "./KotlinParser.js";
import { ReceiverTypeContext } from "./KotlinParser.js";
import { FunctionBodyContext } from "./KotlinParser.js";
import { ObjectDeclarationContext } from "./KotlinParser.js";
import { CompanionObjectContext } from "./KotlinParser.js";
import { PropertyDeclarationContext } from "./KotlinParser.js";
import { ExplicitBackingFieldContext } from "./KotlinParser.js";
import { MultiVariableDeclarationContext } from "./KotlinParser.js";
import { VariableDeclarationContext } from "./KotlinParser.js";
import { GetterContext } from "./KotlinParser.js";
import { SetterContext } from "./KotlinParser.js";
import { TypeAliasContext } from "./KotlinParser.js";
import { TypeParametersContext } from "./KotlinParser.js";
import { TypeParameterContext } from "./KotlinParser.js";
import { TypeContext } from "./KotlinParser.js";
import { TypeModifierListContext } from "./KotlinParser.js";
import { ParenthesizedTypeContext } from "./KotlinParser.js";
import { NullableTypeContext } from "./KotlinParser.js";
import { TypeReferenceContext } from "./KotlinParser.js";
import { FunctionTypeContext } from "./KotlinParser.js";
import { FunctionTypeReceiverContext } from "./KotlinParser.js";
import { UserTypeContext } from "./KotlinParser.js";
import { SimpleUserTypeContext } from "./KotlinParser.js";
import { FunctionTypeParametersContext } from "./KotlinParser.js";
import { TypeConstraintsContext } from "./KotlinParser.js";
import { TypeConstraintContext } from "./KotlinParser.js";
import { BlockContext } from "./KotlinParser.js";
import { StatementsContext } from "./KotlinParser.js";
import { StatementContext } from "./KotlinParser.js";
import { BlockLevelExpressionContext } from "./KotlinParser.js";
import { DeclarationContext } from "./KotlinParser.js";
import { ExpressionContext } from "./KotlinParser.js";
import { DisjunctionContext } from "./KotlinParser.js";
import { ConjunctionContext } from "./KotlinParser.js";
import { EqualityComparisonContext } from "./KotlinParser.js";
import { ComparisonContext } from "./KotlinParser.js";
import { NamedInfixContext } from "./KotlinParser.js";
import { ElvisExpressionContext } from "./KotlinParser.js";
import { InfixFunctionCallContext } from "./KotlinParser.js";
import { RangeExpressionContext } from "./KotlinParser.js";
import { AdditiveExpressionContext } from "./KotlinParser.js";
import { MultiplicativeExpressionContext } from "./KotlinParser.js";
import { TypeRHSContext } from "./KotlinParser.js";
import { PrefixUnaryExpressionContext } from "./KotlinParser.js";
import { PostfixUnaryExpressionContext } from "./KotlinParser.js";
import { AtomicExpressionContext } from "./KotlinParser.js";
import { ParenthesizedExpressionContext } from "./KotlinParser.js";
import { CallSuffixContext } from "./KotlinParser.js";
import { AnnotatedLambdaContext } from "./KotlinParser.js";
import { ArrayAccessContext } from "./KotlinParser.js";
import { ValueArgumentsContext } from "./KotlinParser.js";
import { TypeArgumentsContext } from "./KotlinParser.js";
import { TypeProjectionContext } from "./KotlinParser.js";
import { TypeProjectionModifierListContext } from "./KotlinParser.js";
import { ValueArgumentContext } from "./KotlinParser.js";
import { LiteralConstantContext } from "./KotlinParser.js";
import { StringLiteralContext } from "./KotlinParser.js";
import { LineStringLiteralContext } from "./KotlinParser.js";
import { MultiLineStringLiteralContext } from "./KotlinParser.js";
import { LineStringContentContext } from "./KotlinParser.js";
import { LineStringExpressionContext } from "./KotlinParser.js";
import { MultiLineStringContentContext } from "./KotlinParser.js";
import { MultiLineStringExpressionContext } from "./KotlinParser.js";
import { FunctionLiteralContext } from "./KotlinParser.js";
import { LambdaParametersContext } from "./KotlinParser.js";
import { LambdaParameterContext } from "./KotlinParser.js";
import { ObjectLiteralContext } from "./KotlinParser.js";
import { CollectionLiteralContext } from "./KotlinParser.js";
import { ThisExpressionContext } from "./KotlinParser.js";
import { SuperExpressionContext } from "./KotlinParser.js";
import { ConditionalExpressionContext } from "./KotlinParser.js";
import { IfExpressionContext } from "./KotlinParser.js";
import { ControlStructureBodyContext } from "./KotlinParser.js";
import { WhenExpressionContext } from "./KotlinParser.js";
import { WhenEntryContext } from "./KotlinParser.js";
import { WhenConditionContext } from "./KotlinParser.js";
import { RangeTestContext } from "./KotlinParser.js";
import { TypeTestContext } from "./KotlinParser.js";
import { TryExpressionContext } from "./KotlinParser.js";
import { CatchBlockContext } from "./KotlinParser.js";
import { FinallyBlockContext } from "./KotlinParser.js";
import { LoopExpressionContext } from "./KotlinParser.js";
import { ForExpressionContext } from "./KotlinParser.js";
import { WhileExpressionContext } from "./KotlinParser.js";
import { DoWhileExpressionContext } from "./KotlinParser.js";
import { JumpExpressionContext } from "./KotlinParser.js";
import { CallableReferenceContext } from "./KotlinParser.js";
import { AssignmentOperatorContext } from "./KotlinParser.js";
import { EqualityOperationContext } from "./KotlinParser.js";
import { ComparisonOperatorContext } from "./KotlinParser.js";
import { InOperatorContext } from "./KotlinParser.js";
import { IsOperatorContext } from "./KotlinParser.js";
import { AdditiveOperatorContext } from "./KotlinParser.js";
import { MultiplicativeOperationContext } from "./KotlinParser.js";
import { TypeOperationContext } from "./KotlinParser.js";
import { PrefixUnaryOperationContext } from "./KotlinParser.js";
import { PostfixUnaryOperationContext } from "./KotlinParser.js";
import { MemberAccessOperatorContext } from "./KotlinParser.js";
import { ModifierListContext } from "./KotlinParser.js";
import { FunctionModifierListContext } from "./KotlinParser.js";
import { ContextParametersContext } from "./KotlinParser.js";
import { ContextModifierContext } from "./KotlinParser.js";
import { ModifierContext } from "./KotlinParser.js";
import { ClassModifierContext } from "./KotlinParser.js";
import { MemberModifierContext } from "./KotlinParser.js";
import { VisibilityModifierContext } from "./KotlinParser.js";
import { VarianceAnnotationContext } from "./KotlinParser.js";
import { FunctionModifierContext } from "./KotlinParser.js";
import { PropertyModifierContext } from "./KotlinParser.js";
import { InheritanceModifierContext } from "./KotlinParser.js";
import { ParameterModifierContext } from "./KotlinParser.js";
import { TypeParameterModifierContext } from "./KotlinParser.js";
import { LabelDefinitionContext } from "./KotlinParser.js";
import { AnnotationsContext } from "./KotlinParser.js";
import { AnnotationContext } from "./KotlinParser.js";
import { AnnotationListContext } from "./KotlinParser.js";
import { AnnotationUseSiteTargetContext } from "./KotlinParser.js";
import { UnescapedAnnotationContext } from "./KotlinParser.js";
import { IdentifierContext } from "./KotlinParser.js";
import { SimpleIdentifierContext } from "./KotlinParser.js";
import { SemiContext } from "./KotlinParser.js";
import { AnysemiContext } from "./KotlinParser.js";


/**
 * This interface defines a complete generic visitor for a parse tree produced
 * by `KotlinParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export class KotlinParserVisitor<Result> extends AbstractParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by `KotlinParser.kotlinFile`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitKotlinFile?: (ctx: KotlinFileContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.script`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitScript?: (ctx: ScriptContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.preamble`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPreamble?: (ctx: PreambleContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.fileAnnotations`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFileAnnotations?: (ctx: FileAnnotationsContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.fileAnnotation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFileAnnotation?: (ctx: FileAnnotationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.packageHeader`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPackageHeader?: (ctx: PackageHeaderContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.importList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitImportList?: (ctx: ImportListContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.importHeader`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitImportHeader?: (ctx: ImportHeaderContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.importAlias`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitImportAlias?: (ctx: ImportAliasContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.topLevelObject`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTopLevelObject?: (ctx: TopLevelObjectContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.classDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassDeclaration?: (ctx: ClassDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.primaryConstructor`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrimaryConstructor?: (ctx: PrimaryConstructorContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.classParameters`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassParameters?: (ctx: ClassParametersContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.classParameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassParameter?: (ctx: ClassParameterContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.delegationSpecifiers`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDelegationSpecifiers?: (ctx: DelegationSpecifiersContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.delegationSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDelegationSpecifier?: (ctx: DelegationSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.constructorInvocation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstructorInvocation?: (ctx: ConstructorInvocationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.explicitDelegation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExplicitDelegation?: (ctx: ExplicitDelegationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.classBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassBody?: (ctx: ClassBodyContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.classMemberDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassMemberDeclaration?: (ctx: ClassMemberDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.anonymousInitializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnonymousInitializer?: (ctx: AnonymousInitializerContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.secondaryConstructor`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSecondaryConstructor?: (ctx: SecondaryConstructorContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.constructorDelegationCall`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstructorDelegationCall?: (ctx: ConstructorDelegationCallContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.enumClassBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumClassBody?: (ctx: EnumClassBodyContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.enumEntries`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumEntries?: (ctx: EnumEntriesContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.enumEntry`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumEntry?: (ctx: EnumEntryContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.functionDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionDeclaration?: (ctx: FunctionDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.functionValueParameters`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionValueParameters?: (ctx: FunctionValueParametersContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.functionValueParameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionValueParameter?: (ctx: FunctionValueParameterContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.parameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParameter?: (ctx: ParameterContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.receiverType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitReceiverType?: (ctx: ReceiverTypeContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.functionBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionBody?: (ctx: FunctionBodyContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.objectDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitObjectDeclaration?: (ctx: ObjectDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.companionObject`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCompanionObject?: (ctx: CompanionObjectContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.propertyDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPropertyDeclaration?: (ctx: PropertyDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.explicitBackingField`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExplicitBackingField?: (ctx: ExplicitBackingFieldContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.multiVariableDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiVariableDeclaration?: (ctx: MultiVariableDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.variableDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVariableDeclaration?: (ctx: VariableDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.getter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGetter?: (ctx: GetterContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.setter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSetter?: (ctx: SetterContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeAlias`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeAlias?: (ctx: TypeAliasContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeParameters`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeParameters?: (ctx: TypeParametersContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeParameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeParameter?: (ctx: TypeParameterContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.type`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitType?: (ctx: TypeContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeModifierList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeModifierList?: (ctx: TypeModifierListContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.parenthesizedType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParenthesizedType?: (ctx: ParenthesizedTypeContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.nullableType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNullableType?: (ctx: NullableTypeContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeReference`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeReference?: (ctx: TypeReferenceContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.functionType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionType?: (ctx: FunctionTypeContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.functionTypeReceiver`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionTypeReceiver?: (ctx: FunctionTypeReceiverContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.userType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUserType?: (ctx: UserTypeContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.simpleUserType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSimpleUserType?: (ctx: SimpleUserTypeContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.functionTypeParameters`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionTypeParameters?: (ctx: FunctionTypeParametersContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeConstraints`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeConstraints?: (ctx: TypeConstraintsContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeConstraint`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeConstraint?: (ctx: TypeConstraintContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.block`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBlock?: (ctx: BlockContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.statements`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStatements?: (ctx: StatementsContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.statement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStatement?: (ctx: StatementContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.blockLevelExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBlockLevelExpression?: (ctx: BlockLevelExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.declaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclaration?: (ctx: DeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.expression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpression?: (ctx: ExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.disjunction`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDisjunction?: (ctx: DisjunctionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.conjunction`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConjunction?: (ctx: ConjunctionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.equalityComparison`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEqualityComparison?: (ctx: EqualityComparisonContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.comparison`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitComparison?: (ctx: ComparisonContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.namedInfix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamedInfix?: (ctx: NamedInfixContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.elvisExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitElvisExpression?: (ctx: ElvisExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.infixFunctionCall`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInfixFunctionCall?: (ctx: InfixFunctionCallContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.rangeExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRangeExpression?: (ctx: RangeExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.additiveExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAdditiveExpression?: (ctx: AdditiveExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.multiplicativeExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeRHS`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeRHS?: (ctx: TypeRHSContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.prefixUnaryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrefixUnaryExpression?: (ctx: PrefixUnaryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.postfixUnaryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPostfixUnaryExpression?: (ctx: PostfixUnaryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.atomicExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAtomicExpression?: (ctx: AtomicExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.parenthesizedExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParenthesizedExpression?: (ctx: ParenthesizedExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.callSuffix`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallSuffix?: (ctx: CallSuffixContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.annotatedLambda`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnnotatedLambda?: (ctx: AnnotatedLambdaContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.arrayAccess`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArrayAccess?: (ctx: ArrayAccessContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.valueArguments`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValueArguments?: (ctx: ValueArgumentsContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeArguments`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeArguments?: (ctx: TypeArgumentsContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeProjection`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeProjection?: (ctx: TypeProjectionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeProjectionModifierList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeProjectionModifierList?: (ctx: TypeProjectionModifierListContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.valueArgument`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValueArgument?: (ctx: ValueArgumentContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.literalConstant`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteralConstant?: (ctx: LiteralConstantContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.stringLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStringLiteral?: (ctx: StringLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.lineStringLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLineStringLiteral?: (ctx: LineStringLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.multiLineStringLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiLineStringLiteral?: (ctx: MultiLineStringLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.lineStringContent`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLineStringContent?: (ctx: LineStringContentContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.lineStringExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLineStringExpression?: (ctx: LineStringExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.multiLineStringContent`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiLineStringContent?: (ctx: MultiLineStringContentContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.multiLineStringExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiLineStringExpression?: (ctx: MultiLineStringExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.functionLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionLiteral?: (ctx: FunctionLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.lambdaParameters`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLambdaParameters?: (ctx: LambdaParametersContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.lambdaParameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLambdaParameter?: (ctx: LambdaParameterContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.objectLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitObjectLiteral?: (ctx: ObjectLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.collectionLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCollectionLiteral?: (ctx: CollectionLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.thisExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitThisExpression?: (ctx: ThisExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.superExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSuperExpression?: (ctx: SuperExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.conditionalExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConditionalExpression?: (ctx: ConditionalExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.ifExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIfExpression?: (ctx: IfExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.controlStructureBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitControlStructureBody?: (ctx: ControlStructureBodyContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.whenExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitWhenExpression?: (ctx: WhenExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.whenEntry`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitWhenEntry?: (ctx: WhenEntryContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.whenCondition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitWhenCondition?: (ctx: WhenConditionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.rangeTest`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRangeTest?: (ctx: RangeTestContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeTest`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeTest?: (ctx: TypeTestContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.tryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTryExpression?: (ctx: TryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.catchBlock`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCatchBlock?: (ctx: CatchBlockContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.finallyBlock`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFinallyBlock?: (ctx: FinallyBlockContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.loopExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLoopExpression?: (ctx: LoopExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.forExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForExpression?: (ctx: ForExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.whileExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitWhileExpression?: (ctx: WhileExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.doWhileExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDoWhileExpression?: (ctx: DoWhileExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.jumpExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitJumpExpression?: (ctx: JumpExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.callableReference`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCallableReference?: (ctx: CallableReferenceContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.assignmentOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentOperator?: (ctx: AssignmentOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.equalityOperation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEqualityOperation?: (ctx: EqualityOperationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.comparisonOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitComparisonOperator?: (ctx: ComparisonOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.inOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInOperator?: (ctx: InOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.isOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIsOperator?: (ctx: IsOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.additiveOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAdditiveOperator?: (ctx: AdditiveOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.multiplicativeOperation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiplicativeOperation?: (ctx: MultiplicativeOperationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeOperation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeOperation?: (ctx: TypeOperationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.prefixUnaryOperation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrefixUnaryOperation?: (ctx: PrefixUnaryOperationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.postfixUnaryOperation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPostfixUnaryOperation?: (ctx: PostfixUnaryOperationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.memberAccessOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemberAccessOperator?: (ctx: MemberAccessOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.modifierList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitModifierList?: (ctx: ModifierListContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.functionModifierList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionModifierList?: (ctx: FunctionModifierListContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.contextParameters`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitContextParameters?: (ctx: ContextParametersContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.contextModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitContextModifier?: (ctx: ContextModifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.modifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitModifier?: (ctx: ModifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.classModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassModifier?: (ctx: ClassModifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.memberModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemberModifier?: (ctx: MemberModifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.visibilityModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVisibilityModifier?: (ctx: VisibilityModifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.varianceAnnotation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVarianceAnnotation?: (ctx: VarianceAnnotationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.functionModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionModifier?: (ctx: FunctionModifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.propertyModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPropertyModifier?: (ctx: PropertyModifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.inheritanceModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInheritanceModifier?: (ctx: InheritanceModifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.parameterModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParameterModifier?: (ctx: ParameterModifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.typeParameterModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeParameterModifier?: (ctx: TypeParameterModifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.labelDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLabelDefinition?: (ctx: LabelDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.annotations`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnnotations?: (ctx: AnnotationsContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.annotation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnnotation?: (ctx: AnnotationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.annotationList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnnotationList?: (ctx: AnnotationListContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.annotationUseSiteTarget`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnnotationUseSiteTarget?: (ctx: AnnotationUseSiteTargetContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.unescapedAnnotation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnescapedAnnotation?: (ctx: UnescapedAnnotationContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.identifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIdentifier?: (ctx: IdentifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.simpleIdentifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSimpleIdentifier?: (ctx: SimpleIdentifierContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.semi`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSemi?: (ctx: SemiContext) => Result;
    /**
     * Visit a parse tree produced by `KotlinParser.anysemi`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAnysemi?: (ctx: AnysemiContext) => Result;
}

