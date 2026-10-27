# feign-tracer

基于 ANTLR4 的 Java / Kotlin / Groovy 调用链与依赖分析工具。

它会递归扫描指定目录，解析 `pom.xml`、`build.gradle(.kts)` 与源码文件，完成四件事：

1. **模块依赖**：Maven 多模块 / Gradle 多项目之间的内部依赖，以及外部坐标。
2. **端点调用树**：从 Spring `Controller` 端点出发，按源码调用顺序展开 `Service → Mapper / Repository / Feign` 调用链。
3. **跨服务追踪**：识别 Feign 客户端方法对应的远程 `Controller` 端点，并继续展开远程调用链。
4. **文件级依赖**：每个源文件依赖了哪些项目内类型（import / 继承 / 字段 / 参数 / 返回值 / 注解 / 调用）。

分析结果默认写入本地 SQLite 数据库，便于大项目下的存储与 SQL 查询，同时保留可选 JSON 输出。

## 环境要求

- Node.js 20+
- npm

## 安装

```bash
npm install --legacy-peer-deps
```

> 语法文件已经生成到 `src/generated/`，一般无需重新生成。

如需重新生成 ANTLR 解析器：

```bash
npm run generate
```

## 快速开始

```bash
# 默认写入 SQLite 数据库 feign-trace.db，并打印调用树
npx tsx src/cli.ts examples/shop --print-trees

# 指定数据库文件
npx tsx src/cli.ts D:/path/to/project --db out/analysis.db

# 同时生成 SQLite 与 JSON
npx tsx src/cli.ts D:/path/to/project --format both --db out/analysis.db --out out/analysis.json

# 只生成 JSON（旧行为）
npx tsx src/cli.ts D:/path/to/project --format json --out result.json

# JSON 直接输出到 stdout，不写任何文件
npx tsx src/cli.ts D:/path/to/project --stdout > result.json

# 只索引端点，不构建调用树
npx tsx src/cli.ts D:/path/to/project --no-trees

# 关键词 + 精确类名 + 精确函数名（三者 AND），只构建匹配的调用链
npx tsx src/cli.ts D:/path/to/project --keyword order --class-name OrderController --method-name list --print-trees

# 直接追踪接口方法：每个实现类各生成一棵调用树
npx tsx src/cli.ts D:/path/to/project --class-name OrderService --method-name list --print-trees

# 只重建某个目录下的调用链（该目录同时跳过解析缓存）
npx tsx src/cli.ts D:/path/to/project --rebuild-dir src/main/java/com/acme/order
```

搜索条件在服务端和客户端都按 **AND** 组合：关键词必须在端点/方法信息中命中，类名必须精确匹配简单名或全限定名，函数名必须精确匹配。增量选择默认合并进已有 `--db`；需要整库重建时加 `--fresh`。

启动 Web UI：

```bash
npm run dev
```

打开终端提示的地址（默认 `http://localhost:5173`），输入项目根目录后点击“开始分析”。界面提供：

- “端点关键词 / 精确类名 / 精确函数名”三个搜索输入框，只展示符合条件（AND）的调用链；
- “方法调用链”页签：输入接口类名与函数名时，列出每个实现类的独立调用树；
- “参数列表 / 参数类型 / 可见性”显示开关；
- 未构建的端点/方法链卡片上的“构建调用树”按钮，用于按需增量构建。

构建：

```bash
npm run build        # 类型检查 + Web + CLI
npm start -- <dir>   # 运行构建后的 CLI (dist/cli.js)
```

## 调用链过滤

默认只保留类名以以下后缀结尾的调用节点，DTO、工具类、配置类等噪音不会出现在调用树中：

```
Controller  Client  Service  ServiceImpl  Mapper  Repo  Repository
```

也就是默认正则：

```
Controller$  Client$  Service$  ServiceImpl$  Mapper$  Repo$  Repository$
```

### `--exclude-self-calls`

跳过目标方法与调用方属于同一个类的调用（包括递归自调用），例如 Controller 的私有辅助方法、Service 内部的 validate/convert 方法。被排除的节点连同其子树一起剪掉。

### `--class-filter <regexes>`

用逗号分隔的正则覆盖默认类名过滤列表。正则同时匹配类的简单名与全限定名：

```bash
npx tsx src/cli.ts D:/path/to/project --class-filter "Controller$,Service$,ServiceImpl$,Mapper$"
npx tsx src/cli.ts D:/path/to/project --class-filter "com\\.acme\\..*(Service|Mapper)$"
```

注意：过滤是**剪枝**语义——不匹配的节点连同其子树一起被移除。因此列表需要覆盖你想穿透的每一层（例如只写 `Mapper$` 会拿不到 Service 之下的 Mapper）。端点根节点与 Feign 远程 Controller 根节点始终保留。

### `--all-classes`

关闭类名过滤，保留所有可解析调用。

## 增量构建与精确搜索

默认先索引所有端点和类型，再根据搜索条件只展开命中的调用树，未命中的端点保留为“未构建”。这样大项目首次分析后，可以按端点、类或方法逐步补树。

### 搜索条件（AND）

| 条件 | CLI | Web UI | 匹配规则 |
| --- | --- | --- | --- |
| 端点关键词 | `--keyword order` | 端点关键词 | 对端点 id、路径、handler、Controller、模块做不区分大小写的包含匹配；多个关键词全部命中 |
| 精确类名 | `--class-name OrderService` | 精确类名 | 精确匹配简单名或全限定名；不支持模糊后缀 |
| 精确函数名 | `--method-name list` | 精确函数名 | 精确匹配方法名，重载会全部命中 |

三个条件之间是 **AND**。例如：

```bash
# 只保留 OrderController.list 这一条 Controller 调用链
npx tsx src/cli.ts . --keyword orders --class-name OrderController --method-name list

# 类名/函数名也可以直接指向 Service/接口/普通类，生成方法级调用链
npx tsx src/cli.ts . --class-name OrderService --method-name list
```

### 方法级调用链（`traces`）

`--class-name` + `--method-name` 不要求目标是 Controller：

- 普通类/实现类：直接以该函数为根节点展开调用树；
- 接口/抽象类：找到项目中所有实现类中同名、同参数个数的方法，每个实现生成一棵独立调用树，并标记 `implementationOf`；
- 已经是 Controller 端点的函数不会重复生成 trace，仍由 `endpoints[]` 展示。

接口调用出现在调用树中间时同样会展开所有实现。例如 `OrderService.list()` 有两个实现，树中会出现 `OrderAuditServiceImpl.list()` 与 `OrderServiceImpl.list()` 两个节点（各自带 `impl of OrderService` 标记），并分别展开自己的下游调用。

### 增量数据库合并

带 `--keyword`、`--class-name`、`--method-name`、`--rebuild-dir` 或 `--no-trees` 运行时，默认执行**合并写入**：

- 本次构建的端点/方法链会替换旧树；
- 未选中的端点/方法链及其 `call_nodes` 保留；
- 已删除的端点会被清理；
- trace 元数据与调用树也会保留，便于多次按需构建。

使用 `--fresh` 可忽略已有数据库，整库重建。解析缓存默认位于 `.feign-tracer-cache/`，按文件 `mtime + size + module` 校验；`--rebuild-dir` 指定目录下的文件会强制重新解析。可用 `--no-cache` 关闭缓存，或 `--cache-dir` 指定位置。

## CLI 选项

```
feign-tracer <root-directory> [options]

    --format <kind>       sqlite | json | both                   [sqlite]
    --db <file>           SQLite 数据库路径                      [feign-trace.db]
-o, --out <file>          JSON 输出路径（json/both 时使用），"-" = stdout  [feign-trace.json]
    --stdout              JSON 输出到 stdout，不写文件
    --max-depth <n>       最大调用树深度                         [12]
    --max-files <n>       最多扫描文件数                         [50000]
    --include-external    把未解析/外部调用作为叶子节点保留
    --no-follow-feign     不展开 Feign 调用到远程 Controller
    --exclude-self-calls  排除调用方自身类中的方法调用
    --class-filter <re>   逗号分隔的类名正则，覆盖默认过滤
    --all-classes         关闭类名过滤
    --keyword <text>      端点关键词，可重复或逗号分隔
    --class-name <name>   精确类名（简单名或全限定名），可重复/逗号分隔
    --method-name <name>  精确函数名，可重复/逗号分隔
    --no-trees            只索引端点/方法链，不展开调用树
    --rebuild-dir <dir>   只重建该目录下的端点，并跳过该目录的解析缓存
    --no-cache            关闭解析缓存
    --cache-dir <dir>     解析缓存目录                      [.feign-tracer-cache]
    --no-work-db          方法体不落临时工作库，全部留在内存（仅适合小项目）
    --jobs <n>            解析线程数：0 = 自动，1 = 单线程            [0]
    --fresh               重建数据库，不合并增量结果
    --list-endpoints      打印端点/方法链及构建状态
    --hide-params         控制台调用树隐藏参数列表
    --show-param-types    显示参数类型（name: Type）
    --show-visibility     显示 public/protected/private 等可见性
    --no-source           不输出 files 文件依赖部分
    --ignore <dirs>       追加忽略的目录名（逗号分隔）
    --compact             输出压缩后的 JSON
    --quiet               不打印摘要
    --print-trees         在控制台打印有序调用树
-h, --help                帮助
-v, --version             版本
```

示例：

```bash
npx tsx src/cli.ts examples/shop --print-trees --exclude-self-calls
npx tsx src/cli.ts examples/gradle-shop --db gradle.db --class-filter "Controller$,Service$"
npx tsx src/cli.ts examples/shop --format both --db out/shop.db --out out/shop.json
```

## 内存模型

大项目（几百个文件、十万级调用点）的内存峰值主要来自三处，代码里分别做了处理：

1. **方法体（`calls` / `locals`）**：解析完一个文件就转存到临时 SQLite 工作库
   （按 `method_id` 一行，`calls_json` / `locals_json`），然后从内存结构里剥离。
   之后调用链展开、依赖边统计、`resolvedCalls` 统计都通过
   `ProjectIndex.callsOf()` / `localsOf()` 按需读取，带 2048 条 LRU。
   工作库在分析结束时自动删除，不进入输出。`--no-work-db` 可关闭该行为。
2. **解析并发**：worker 采用"完成一个就领下一个"的逐文件派发，不再按文件数静态分批，
   每个 worker 的堆上最多只有正在解析的那一个文件；worker 异常时只补跑未交付的文件，
   不会重复计入模块文件数或工作库。
3. **调用树**：`--format sqlite` 下逐端点展开后立即写入临时 NDJSON 暂存文件并从内存释放，
   写库时再流式读回插入 `call_nodes`，常驻内存只与"当前正在展开的根"有关。

`--format json` / `--format both` / `--stdout` / `--print-trees` 仍然需要在内存里保留完整
调用树，大项目上这几种输出方式的内存占用会明显高于默认的 SQLite 输出。

## SQLite 存储

默认输出为单个本地 SQLite 文件（`feign-trace.db`），使用事务 + 预编译语句批量写入，并先写临时文件再原子替换，避免中断留下半成品。Web UI 可在“SQLite 保存路径”中填写文件路径（留空则只分析不落盘）。

数据库结构（`PRAGMA user_version = 3`）：

| 表 / 视图 | 内容 |
| --- | --- |
| `analysis` | 根目录、生成时间、工具版本、分析选项 JSON、耗时 |
| `stats` | 各项统计计数（含 `endpointsBuilt` / `traces` / `tracesBuilt`） |
| `modules` / `module_dependencies` | 模块、构建依赖（内部模块与外部坐标） |
| `module_edges` / `module_children` | 模块依赖边、聚合子模块 |
| `endpoints` | Controller 端点（HTTP 方法、路径、handler、模块、文件、行号、`tree_built`） |
| `traces` | 精确类名/函数名的方法级根节点（含 `implementation_of`、`tree_built`） |
| `call_nodes` | 端点与方法链共用的调用树扁平表；`root_type` 区分 `endpoint/trace`，`endpoint_id + seq` 为主键 |
| `feign_clients` / `feign_client_methods` | Feign 客户端及其方法 |
| `feign_operations` / `feign_operation_targets` | Feign 远程调用及匹配到的远程端点 |
| `source_files` / `file_dependencies` | 文件级依赖（依赖类型与行号以 JSON 数组保存） |
| `warnings` | 解析/分析告警 |
| `v_endpoint_overview` | 端点及其节点数、Feign 调用数、是否已构建 |
| `v_trace_overview` | 方法级调用链及节点数、Feign 调用数、实现类信息 |
| `v_module_overview` | 模块及其依赖/被依赖数量 |
| `v_file_overview` | 文件及其依赖数量 |

`call_nodes.sort_key` 是按层级补零后的排序键（如 `0000.0001.0000`），可直接 `ORDER BY sort_key` 还原树的前序顺序。`call_nodes.params_json`、`visibility`、`implementation_of` 供客户端显示开关与实现类标记使用。

常用查询：

```sql
-- 端点概览
SELECT * FROM v_endpoint_overview;

-- 某个端点的完整调用树
SELECT path, depth, kind, label, file, line
FROM call_nodes
WHERE root_type = 'endpoint' AND endpoint_id = 'GET /api/orders/list'
ORDER BY sort_key;

-- 某个节点的直接子调用
SELECT node_order, path, label, kind
FROM call_nodes
WHERE root_type = 'endpoint' AND endpoint_id = 'GET /api/orders/list' AND parent_seq = '0-1'
ORDER BY node_order;

-- 方法级调用链概览与展开
SELECT * FROM v_trace_overview;
SELECT path, label, implementation_of, cyclic
FROM call_nodes
WHERE root_type = 'trace'
ORDER BY endpoint_id, sort_key;

-- 所有接口实现的展开节点
SELECT endpoint_id, path, label, implementation_of
FROM call_nodes
WHERE implementation_of IS NOT NULL
ORDER BY endpoint_id, sort_key;

-- 未构建的端点/方法链（增量补树）
SELECT id, controller FROM v_endpoint_overview WHERE tree_built = 0;
SELECT id, class_name, method_name FROM v_trace_overview WHERE tree_built = 0;

-- Feign 调用与远程端点
SELECT client_name, method_name, http_method, path FROM feign_operations;
SELECT * FROM feign_operation_targets;

-- 模块依赖
SELECT m.name AS module, d.to_module, d.group_id, d.artifact_id, d.external
FROM module_dependencies d
JOIN modules m ON m.id = d.module_id;

-- 反向文件依赖
SELECT file_path, count, kinds_json
FROM file_dependencies
WHERE to_type = 'com.example.order.client.UserClient';
```

可用 DB Browser for SQLite、DataGrip 或 `sqlite3` 直接打开文件查询。`--format json` 仍保留原有 JSON 输出；JSON 中 `meta.options` 会记录本次过滤参数。

## 调用树序号

`seq` / `path` 表示从端点出发的有序路径：

```
(0)        OrderController.list(name)
(0-0)        OrderService.list(name)
(0-0-0)        OrderMapper.list(name)
(0-1)        OrderService.fillCreatorNames(orders)
(0-1-0)        UserClient.listUsers(name)        [feign]
(0-1-0-0)        UserController.listUsers(name)  [remote]
(0-1-0-0-0)        UserService.listUsers(name)
(0-1-0-0-0-0)        UserMapper.listUsers(name)
```

- 每个端点的根节点固定为 `(0)`。
- `(0-1)` 是 `(0)` 的第 2 个被保留的子调用。
- 同一调用点重复调用同一方法时合并为一个节点，并通过 `callCount` 记录次数。
- 循环调用会标记 `cyclic: true` 并停止继续展开。
- 接口/抽象类调用存在多个实现时，每个实现各占一个兄弟节点，并带 `implementationOf` 标记，分别展开实现类内部的调用树。
- `kind` 取值：`controller | service | component | repository | mapper | feign | remote | external | unknown`。
- `unresolved: true` 表示该调用是外部/未解析的叶子（需 `--include-external`）。

方法级调用链（`traces[]`）的根节点同样是 `(0)`；接口根会展开为每个实现类一棵独立的树，`implementationOf` 指向接口全限定名。

## JSON 结构（`--format json`）

```jsonc
{
  "meta": {
    "root": "D:/project/demo",
    "generatedAt": "2026-10-20T00:00:00.000Z",
    "tool": "feign-tracer",
    "version": "1.0.0",
    "options": {
      "maxDepth": 12,
      "includeExternal": false,
      "followFeign": true,
      "excludeSelfCalls": false,
      "classFilters": ["Controller$", "Client$", "..."],
      "keywords": ["order"],
      "classNames": ["OrderService"],
      "methodNames": ["list"]
    }
  },
  "stats": { "modules": 4, "sourceFiles": 12, "endpoints": 3, "endpointsBuilt": 1, "traces": 2, "tracesBuilt": 2, "...": 0 },
  "modules": [
    {
      "id": "order-service",
      "name": "order-service",
      "buildTool": "maven",
      "dir": "order-service",
      "dependencies": [
        { "to": "common", "external": false },
        { "groupId": "org.springframework", "artifactId": "spring-web", "external": true }
      ]
    }
  ],
  "moduleEdges": [{ "from": "order-service", "to": "common", "count": 1, "dependencies": [] }],
  "endpoints": [
    {
      "id": "GET /api/orders/list",
      "httpMethod": "GET",
      "paths": ["/api/orders/list"],
      "handler": "com.example.order.controller.OrderController#list/0",
      "handlerLabel": "OrderController.list(name)",
      "controller": "com.example.order.controller.OrderController",
      "moduleId": "order-service",
      "treeBuilt": true,
      "tree": {
        "seq": "0",
        "path": "(0)",
        "order": 0,
        "depth": 0,
        "label": "OrderController.list(name)",
        "kind": "controller",
        "children": [
          {
            "seq": "0-0",
            "path": "(0-0)",
            "label": "OrderService.list(name)",
            "kind": "service",
            "children": []
          }
        ]
      }
    }
  ],
  "traces": [
    {
      "id": "TRACE com.example.order.service.OrderServiceImpl#list/0",
      "className": "com.example.order.service.OrderServiceImpl",
      "methodName": "list",
      "label": "OrderServiceImpl.list(name)",
      "kind": "service",
      "implementationOf": "com.example.order.service.OrderService",
      "treeBuilt": true,
      "tree": {
        "seq": "0",
        "path": "(0)",
        "label": "OrderServiceImpl.list(name)",
        "implementationOf": "OrderService",
        "children": []
      }
    }
  ],
  "feignClients": [],
  "feignOperations": [],
  "files": [
    {
      "path": "order-service/src/main/java/com/example/order/controller/OrderController.java",
      "language": "java",
      "dependencies": [
        { "to": "com.example.order.service.OrderService", "kinds": ["field", "call"], "lines": [18, 24], "count": 2 }
      ]
    }
  ],
  "warnings": []
}
```

`feignOperations[].targetEndpoints` 使用 `<endpoint id>::<handler method id>` 形式记录 Feign 方法匹配到的远程端点。

## Skill / 自动化调用

根目录 `skill.md` 以及 `.opencode/skills/feign-tracer/SKILL.md` 提供了面向 Agent/脚本的完整工作流说明，包含精确搜索（AND）、接口多实现展开、增量建树、SQLite 查询与校验步骤。

## 支持范围与限制

- **Java**：Java 20 语法（ANTLR 官方 grammar），支持 Lombok 等注解但不会生成 getter/setter。
- **Kotlin**：官方 Kotlin grammar（含 `UnicodeClasses.g4`）。
- **Groovy**：自定义容错 grammar，覆盖常见类/方法/调用写法，但并非完整 Groovy 语义。
- **构建文件**：Maven 使用 XML ANTLR parser；Gradle 通过针对 `build.gradle(.kts)` / `settings.gradle(.kts)` 的定向扫描提取 `include` 与依赖声明。
- 调用解析基于静态源码：字段/局部变量类型、参数类型、`this`、接口到实现、类名限定调用。反射、动态代理、Lambda 内部调用等无法完全还原。
- 接口/抽象类方法存在多个实现时，会为每个实现类展开独立分支；如果一个实现都没有，则停留在接口方法的抽象节点。
- 同名类的精确类名建议优先使用全限定名；简单名会匹配所有同名类。

## 目录结构

```
grammars/                  ANTLR 语法文件
scripts/generate-grammars.mjs
src/
  analyze.ts               分析流程编排（选择端点、增量建树、缓存）
  cache.ts                 按文件 mtime/size/module 校验的解析缓存
  scan.ts                  目录扫描
  build/                    Maven / Gradle / XML 解析
  languages/               Java / Kotlin / Groovy 结构提取与调用扫描
  graph/                   索引、解析、端点、调用树、方法链、文件依赖
  store/sqlite.ts          SQLite 持久化、增量合并与表结构
  store/bodies.ts          方法体临时工作库（落盘 + LRU 懒加载）
  store/tree-spool.ts      调用树暂存文件（流式写库）
  cli.ts                   命令行入口
  generated/               生成的 ANTLR TypeScript parser
tests/                     识别结果回归（提取 / 解析 / 调用树 / 快照 / 落库）
tests/fixtures/            示例工程的特征快照
web/                       Vite Web UI
examples/                  示例工程（Maven / Gradle / Groovy / 多实现与循环调用）
```

## 回归测试

```bash
npm run test:unit    # 提取、解析、调用树状态、落库状态、快照
npm test             # 单测 + examples/shop 端到端
npm run test:cycles  # 递归调用示例，校验 cyclic 标记
```

`tests/snapshot.test.ts` 把 `examples/` 下三个工程的分析结果固化成
`tests/fixtures/*.snapshot.json`（只保留端点、调用树与状态标记、Feign 关联、
文件依赖、模块边和统计，剔除时间戳与耗时）。改动识别逻辑后，如果快照失配：

```bash
UPDATE_SNAPSHOT=1 npx tsx --test tests/snapshot.test.ts
```

重新生成后**必须人工 review diff**，确认变化是本次改动预期的结果。
