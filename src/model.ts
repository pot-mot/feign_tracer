export type Language = "java" | "kotlin" | "groovy";
export type TypeKind =
    "class" | "interface" | "enum" | "record" | "annotation" | "object" | "trait";

export interface AnnotationInfo {
    /** 简单注解名，例如 RestController。 */
    name: string;
    /** 原始注解源码，例如 @RequestMapping("/x")。 */
    raw: string;
    /** 解析后的属性；位置参数存放在 "value" 下。 */
    args: Record<string, string>;
}

export interface ImportInfo {
    name: string;
    alias?: string;
    static: boolean;
    wildcard: boolean;
}

export interface ParamInfo {
    name: string;
    type: string;
    annotations: AnnotationInfo[];
}

export interface FieldInfo {
    name: string;
    type: string;
    annotations: AnnotationInfo[];
    modifiers: string[];
    initializer?: string;
    line: number;
}

export interface LocalVar {
    name: string;
    type?: string;
    line: number;
}

export type QualifierKind = "implicit" | "this" | "type" | "expr" | "constructor";

export interface CallSite {
    name: string;
    /** 原始接收者表达式，例如 orderService、this.service、UserClient。 */
    qualifier?: string;
    qualifierKind: QualifierKind;
    argCount: number;
    args: string[];
    line: number;
    offset: number;
    isConstructor: boolean;
}

export interface MethodInfo {
    /** 稳定标识：fqn#方法名/参数个数。 */
    id: string;
    name: string;
    ownerFqn: string;
    ownerSimpleName: string;
    ownerKind: TypeKind;
    annotations: AnnotationInfo[];
    modifiers: string[];
    returnType: string;
    params: ParamInfo[];
    line: number;
    endLine: number;
    bodyStart?: number;
    bodyEnd?: number;
    calls: CallSite[];
    locals: LocalVar[];
    isConstructor: boolean;
    isAbstract: boolean;
}

export interface TypeInfo {
    fqn: string;
    name: string;
    kind: TypeKind;
    packageName: string;
    filePath: string;
    moduleId?: string;
    annotations: AnnotationInfo[];
    modifiers: string[];
    superTypes: string[];
    fields: FieldInfo[];
    methods: MethodInfo[];
    nested: TypeInfo[];
    line: number;
}

export interface ParsedFile {
    path: string;
    absPath: string;
    language: Language;
    moduleId?: string;
    packageName: string;
    imports: ImportInfo[];
    types: TypeInfo[];
    parseErrors: number;
    lineCount: number;
}

export interface ModuleDependency {
    /** 坐标/工程解析到分析根目录内时的内部模块 id。 */
    to?: string;
    groupId?: string;
    artifactId?: string;
    version?: string;
    scope?: string;
    configuration?: string;
    optional?: boolean;
    external: boolean;
    raw?: string;
}

export interface ModuleInfo {
    id: string;
    name: string;
    buildTool: "maven" | "gradle" | "none";
    dir: string;
    buildFile?: string;
    parentId?: string;
    groupId?: string;
    artifactId?: string;
    version?: string;
    dependencies: ModuleDependency[];
    /** 子模块 id（Maven 聚合 / Gradle include）。 */
    modules?: string[];
    fileCount: number;
}

export type FileDependencyKind =
    | "import"
    | "extends"
    | "field"
    | "parameter"
    | "return"
    | "annotation"
    | "call"
    | "feign"
    | "mapper";

export interface FileDependency {
    to: string;
    kinds: FileDependencyKind[];
    lines: number[];
    count: number;
}

export interface FileAnalysis {
    path: string;
    language: Language;
    moduleId?: string;
    packageName: string;
    imports: string[];
    types: string[];
    dependencies: FileDependency[];
    calls: number;
    parseErrors: number;
}

export type NodeKind =
    | "controller"
    | "service"
    | "component"
    | "repository"
    | "mapper"
    | "feign"
    | "remote"
    | "external"
    | "unknown";

export interface CallTreeNode {
    /** 有序路径："0"、"0-0"、"0-1"、"0-1-0"…… */
    seq: string;
    /** 展示形式："(0-1)"。 */
    path: string;
    order: number;
    depth: number;
    /** 已解析方法 id；未解析调用使用合成 id。 */
    id: string;
    /** 例如 OrderController.list(orderId)。 */
    label: string;
    /** 完整签名，例如 com.acme.OrderController.list(java.lang.String)。 */
    signature?: string;
    /** 供客户端显示开关使用的结构化参数。 */
    params?: Array<{ name: string; type: string }>;
    /** 方法可见性：public/protected/private/internal/package。 */
    visibility?: string;
    kind: NodeKind;
    moduleId?: string;
    file?: string;
    line?: number;
    annotations?: string[];
    callCount?: number;
    unresolved?: boolean;
    cyclic?: boolean;
    /** 该方法所实现的接口/抽象类展示名。 */
    implementationOf?: string;
    feign?: {
        service?: string;
        httpMethod: string;
        path: string;
        targetEndpoint?: string;
    };
    remote?: {
        endpoint: string;
        service?: string;
    };
    children: CallTreeNode[];
}

export interface EndpointInfo {
    id: string;
    httpMethod: string;
    paths: string[];
    handler: string;
    handlerLabel: string;
    controller: string;
    moduleId?: string;
    file?: string;
    line?: number;
    /** 本次运行是否已展开调用树（增量模式可能为 false）。 */
    treeBuilt: boolean;
    tree: CallTreeNode;
}

export interface FeignOperation {
    client: string;
    serviceName?: string;
    url?: string;
    method: string;
    httpMethod: string;
    path: string;
    id: string;
    moduleId?: string;
    file?: string;
    line?: number;
    targetEndpoints: string[];
}

export interface MethodTrace {
    /** 合成根 id，例如 "TRACE com.acme.OrderService#list/1"。 */
    id: string;
    className: string;
    methodName: string;
    label: string;
    kind: NodeKind;
    moduleId?: string;
    file?: string;
    line?: number;
    /** 当该调用链是具体实现时，记录其接口/抽象类名。 */
    implementationOf?: string;
    treeBuilt: boolean;
    tree: CallTreeNode;
}

export interface AnalysisStats {
    filesScanned: number;
    sourceFiles: number;
    javaFiles: number;
    kotlinFiles: number;
    groovyFiles: number;
    buildFiles: number;
    modules: number;
    types: number;
    methods: number;
    calls: number;
    resolvedCalls: number;
    endpoints: number;
    /** 本次运行展开调用树的端点数量。 */
    endpointsBuilt: number;
    /** 精确类名/函数名的方法级入口数量。 */
    traces: number;
    tracesBuilt: number;
    feignClients: number;
    feignOperations: number;
    parseErrors: number;
    durationMs: number;
}

export interface ModuleEdge {
    from: string;
    to: string;
    count: number;
    dependencies: ModuleDependency[];
}

export interface AnalysisResult {
    meta: {
        root: string;
        generatedAt: string;
        tool: string;
        version: string;
        options: AnalyzeOptions;
    };
    stats: AnalysisStats;
    modules: ModuleInfo[];
    moduleEdges: ModuleEdge[];
    endpoints: EndpointInfo[];
    /** 用户指定的精确类名/函数名入口。 */
    traces: MethodTrace[];
    feignClients: Array<{
        id: string;
        name: string;
        serviceName?: string;
        url?: string;
        moduleId?: string;
        file?: string;
        line?: number;
        methods: Array<{
            id: string;
            name: string;
            httpMethod: string;
            paths: string[];
            signature: string;
        }>;
    }>;
    feignOperations: FeignOperation[];
    files: FileAnalysis[];
    warnings: string[];
}

export interface AnalyzeOptions {
    root: string;
    maxDepth: number;
    includeExternal: boolean;
    followFeign: boolean;
    includeSource: boolean;
    /** 跳过目标方法属于调用方自身类的调用边。 */
    excludeSelfCalls: boolean;
    /** 匹配目标类简单名（及全限定名）的正则源码；空列表表示关闭过滤。 */
    classFilters: string[];
    /** 仅为此类关键词匹配的端点构建调用树（空表示全部）。 */
    keywords: string[];
    /** 用于方法级调用链和端点过滤的精确类名（简单名或 FQN）。 */
    classNames: string[];
    /** 用于方法级调用链和端点过滤的精确函数名。 */
    methodNames: string[];
    /** 为 false 时只索引端点，不展开调用树。 */
    buildTrees: boolean;
    /** 仅重建控制器文件位于该目录（相对根目录）下的调用树。 */
    rebuildDir?: string;
    /** 在多次运行间复用已解析源文件。 */
    useCache: boolean;
    /** 解析缓存目录（相对当前工作目录解析）。 */
    cacheDir: string;
    maxFiles: number;
    ignore: string[];
}
