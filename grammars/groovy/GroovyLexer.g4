lexer grammar GroovyLexer;

PACKAGE     : 'package';
IMPORT      : 'import';
STATIC      : 'static';
CLASS       : 'class';
INTERFACE   : 'interface';
TRAIT       : 'trait';
ENUM        : 'enum';
EXTENDS     : 'extends';
IMPLEMENTS  : 'implements';
DEF         : 'def';
VOID        : 'void';
NEW         : 'new';
FINAL       : 'final';
PUBLIC      : 'public';
PROTECTED   : 'protected';
PRIVATE     : 'private';
ABSTRACT    : 'abstract';
SYNCHRONIZED: 'synchronized';
RETURN      : 'return';
THROWS      : 'throws';
THROW       : 'throw';
THIS        : 'this';
SUPER       : 'super';
AS          : 'as';
IN          : 'in';
INSTANCEOF  : 'instanceof';
TRUE        : 'true';
FALSE       : 'false';
NULL        : 'null';
IF          : 'if';
ELSE        : 'else';
FOR         : 'for';
WHILE       : 'while';
DO          : 'do';
SWITCH      : 'switch';
CASE        : 'case';
DEFAULT     : 'default';
TRY         : 'try';
CATCH       : 'catch';
FINALLY     : 'finally';
BREAK       : 'break';
CONTINUE    : 'continue';
ASSERT      : 'assert';

AT          : '@';
LPAREN      : '(';
RPAREN      : ')';
LBRACE      : '{';
RBRACE      : '}';
LBRACK      : '[';
RBRACK      : ']';
SEMI        : ';';
COMMA       : ',';
DOT         : '.';
COLON       : ':';
QUEST       : '?';
ASSIGN      : '=';
ARROW       : '->';
ELLIPSIS    : '...';
LANGLE      : '<';
RANGLE      : '>';
MUL         : '*';
PLUS        : '+';
MINUS       : '-';
SLASH       : '/';
PERCENT     : '%';
BANG        : '!';
AMP         : '&';
PIPE        : '|';
CARET       : '^';
TILDE       : '~';
EQEQ        : '==';
NOTEQ       : '!=';
LE          : '<=';
GE          : '>=';
ANDAND      : '&&';
OROR        : '||';
INC         : '++';
DEC         : '--';
PLUSEQ      : '+=';
MINUSEQ     : '-=';
MULEQ       : '*=';
DIVEQ       : '/=';
SCOPED      : '::';
SAFEDOT     : '?.';

Identifier  : [a-zA-Z_$] [a-zA-Z0-9_$]*;
Number      : DIGIT+ ('.' DIGIT+)? ([eE] [+-]? DIGIT+)? [lLfFdD]?;
String
    : '\'\'\'' .*? '\'\'\''
    | '"""' .*? '"""'
    | '\'' ( '\\' . | ~['\\\r\n] )* '\''
    | '"' ( '\\' . | ~["\\\r\n] )* '"'
    ;

LINE_COMMENT : '//' ~[\r\n]* -> skip;
BLOCK_COMMENT: '/*' .*? '*/' -> skip;
WS          : [ \t\r\n\u000C]+ -> skip;
SHEBANG     : '#!' ~[\r\n]* -> skip;

ANY         : .;

fragment DIGIT : [0-9];
