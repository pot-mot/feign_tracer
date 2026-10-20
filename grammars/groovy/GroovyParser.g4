parser grammar GroovyParser;

options {
    tokenVocab = GroovyLexer;
}

groovyFile
    : packageDecl? importDecl* fileMember* EOF
    ;

packageDecl
    : PACKAGE qualifiedName SEMI?
    ;

importDecl
    : IMPORT STATIC? qualifiedName (DOT MUL)? (AS identifier)? SEMI?
    ;

fileMember
    : classDecl
    | methodDecl
    | fieldDecl
    | scriptChunk
    ;

classDecl
    : annotation* modifier* (CLASS | INTERFACE | TRAIT | ENUM) identifier typeParams?
      (EXTENDS type)? (IMPLEMENTS typeList)? classBody
    ;

classBody
    : LBRACE classMember* RBRACE
    ;

classMember
    : classDecl
    | annotation* modifier* methodDecl
    | annotation* modifier* fieldDecl
    | block
    | SEMI
    ;

methodDecl
    : type? identifier LPAREN paramList? RPAREN (THROWS typeList)?
      (block | (ASSIGN simpleInit)? SEMI?)
    ;

fieldDecl
    : type identifier (ASSIGN simpleInit)? SEMI?
    ;

paramList
    : param (COMMA param)*
    ;

param
    : annotation* modifier* type? identifier (ASSIGN paramInit)?
    ;

paramInit
    : ~(COMMA | RPAREN | LBRACE | RBRACE)+
    ;

simpleInit
    : literal
    | NEW type typeArgs? arguments?
    | qualifiedName arguments?
    | arguments
    | block
    ;

arguments
    : LPAREN argList? RPAREN
    | LBRACK argList? RBRACK
    ;

argList
    : arg (COMMA arg)*
    ;

arg
    : literal
    | annotation
    | block
    | ~(COMMA | RPAREN | RBRACK)+
    ;

block
    : LBRACE blockItem* RBRACE
    ;

blockItem
    : block
    | ~(LBRACE | RBRACE)
    ;

scriptChunk
    : ~(CLASS | INTERFACE | TRAIT | ENUM | PACKAGE | IMPORT | EOF)+
    ;

annotation
    : AT qualifiedName (LPAREN annotationArgs? RPAREN)?
    ;

annotationArgs
    : ~(RPAREN)+
    ;

modifier
    : STATIC | FINAL | PUBLIC | PROTECTED | PRIVATE | ABSTRACT | SYNCHRONIZED
    ;

type
    : (DEF | VOID | qualifiedName) typeArgs? dims?
    ;

typeList
    : type (COMMA type)*
    ;

typeParams
    : LANGLE typeParam (COMMA typeParam)* RANGLE
    ;

typeParam
    : identifier (EXTENDS type)?
    ;

typeArgs
    : LANGLE typeArg (COMMA typeArg)* RANGLE
    ;

typeArg
    : type
    | QUEST (EXTENDS | SUPER)? type
    ;

dims
    : (LBRACK RBRACK)+
    ;

qualifiedName
    : identifier (DOT identifier)*
    ;

identifier
    : Identifier
    | DEF
    | VOID
    | AS
    | IN
    | DEFAULT
    ;

literal
    : String
    | Number
    | TRUE
    | FALSE
    | NULL
    ;
