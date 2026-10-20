---
name: feign-tracer
description: Use this skill when analyzing Java/Kotlin/Groovy Maven or Gradle projects for Spring controller endpoints, Service/Mapper/Repository/Feign call chains, interface implementations, cycles, module dependencies, or when querying feign-tracer SQLite/JSON output. Trigger on requests about 调用链、接口实现类、Feign 跨服务、Controller 端点、模块依赖、增量建树.
---

# feign-tracer

ANTLR4 based static analyzer for Maven/Gradle projects. It scans a directory, parses build files and Java/Kotlin/Groovy sources, discovers Spring/JAX-RS controller endpoints, resolves calls across Service/Mapper/Repository/Feign layers, and stores ordered call trees in SQLite (or JSON).

## When to use

Use this skill when the user wants to:

- find all controller endpoints and their downstream call chains in a repository;
- trace `Controller → Service → Mapper/Repository` or `Feign → remote Controller` calls;
- expand every implementation of an interface method (`OrderService#list` → all `*ServiceImpl`);
- focus on exact `keyword + class name + method name` matches (AND semantics);
- incrementally build or rebuild only some call trees, or query saved analysis results;
- inspect module-to-module or file-to-file dependencies.

## Setup

From this project:

```bash
npm install --legacy-peer-deps
npm run typecheck
npm run build
```

Run from source with `npx tsx src/cli.ts`, or use the built CLI with `node dist/cli.js`.
Web UI: `npm run dev` and open `http://localhost:5173`.

## Core workflows

### 1. Full analysis

```bash
npx tsx src/cli.ts D:/path/to/project --format both \
  --db out/analysis.db --out out/analysis.json --print-trees
```

Default output is SQLite (`feign-trace.db`). `--format sqlite|json|both` selects outputs.
`--stdout` prints JSON and writes no files.

### 2. Index only, then build trees on demand

```bash
# Index endpoints/types without expanding trees
npx tsx src/cli.ts D:/project --db out/analysis.db --no-trees

# Build only matching controller trees
npx tsx src/cli.ts D:/project --db out/analysis.db \
  --keyword order --class-name OrderController --method-name list --print-trees
```

Incremental selections merge into the existing DB: unselected endpoint trees and method traces are preserved. Use `--fresh` to replace the database.

### 3. Precise search (AND)

The three filters combine with AND:

| Filter | CLI | Match rule |
| --- | --- | --- |
| Endpoint keyword | `--keyword order` (repeatable/comma) | case-insensitive substring or `/regex/flags` over id/path/handler/controller/module; every keyword must match |
| Exact class | `--class-name OrderController` | exact simple name or FQN (comma separated for multiple) |
| Exact method | `--method-name list` | exact method name; overloads all match |

Only matching controller endpoints are expanded. If the class/method does not identify a controller, a method-level trace is created instead (see next section).

### 4. Trace a service or interface directly

```bash
# Concrete class / service implementation
npx tsx src/cli.ts D:/project --class-name OrderServiceImpl --method-name list --print-trees

# Interface: every implementation gets its own root tree
npx tsx src/cli.ts D:/project --class-name OrderService --method-name list --print-trees
```

Behavior:

- an interface/abstract class expands to all concrete implementations of the same method name and arity;
- each implementation is a separate `traces[]` entry with `implementationOf` set to the interface FQN;
- controller handler methods are not duplicated as traces; they remain in `endpoints[]`;
- if an interface call appears inside a tree, each implementation is shown as a sibling node with an `impl of <Interface>` marker.

### 5. Rebuild only one directory

```bash
npx tsx src/cli.ts D:/project --db out/analysis.db \
  --rebuild-dir src/main/java/com/acme/order
```

`--rebuild-dir`:

- selects only endpoints whose controller file is under that directory;
- bypasses the parse cache for files under it (forces re-parse);
- merges results into the existing DB.

### 6. Cache control

```bash
--no-cache                 # disable parse cache
--cache-dir .cache/ft      # custom cache directory
```

Cache entries are keyed by absolute path and validated with `mtimeMs`, `size`, and module id.

## Useful options

```text
--format sqlite|json|both     output format (default sqlite)
--db <file>                   SQLite path (default feign-trace.db)
-o, --out <file>              JSON path; "-" = stdout
--max-depth <n>               max call-tree depth (default 12)
--include-external            keep unresolved/external calls as leaves
--no-follow-feign             do not expand Feign to remote controllers
--exclude-self-calls          prune calls whose target is the caller's class
--class-filter <regexes>      override default class-name filters
--all-classes                 disable class-name filtering
--keyword / --class-name / --method-name
                              exact AND selection (repeatable/comma)
--no-trees                    index only
--rebuild-dir <dir>           rebuild only endpoints under dir
--fresh                       replace DB instead of merging
--list-endpoints              print endpoints/traces with built status
--print-trees                 print ordered trees
--hide-params                 hide parameter lists
--show-param-types            show "name: Type"
--show-visibility             show public/protected/private
```

Default class filters: `Controller$ Client$ Service$ ServiceImpl$ Mapper$ Repo$ Repository$`.
Filtering is pruning: a non-matching node and its whole subtree are removed; endpoint roots and remote controllers are always kept. Selections (`--keyword/--class-name/--method-name`) are applied on top of these filters.

## Reading output

Tree paths are ordered:

```text
(0)        OrderController.list(name)
(0-0)        OrderService.list(name)
(0-0-0)        OrderMapper.list(name)
(0-1)        OrderService.fillCreatorNames(orders)
(0-1-0)        UserClient.listUsers(name)        [feign]
(0-1-0-0)        UserController.listUsers(name)  [remote]
(0-1-0-0-0)        UserService.listUsers(name)
(0-1-0-0-0-0)        UserMapper.listUsers(name)
```

Node metadata:

- `kind`: controller/service/component/repository/mapper/feign/remote/external/unknown
- `cyclic: true`: repeated method on the current path; children are not expanded
- `unresolved: true`: external or unresolved leaf (requires `--include-external`)
- `callCount > 1`: same target called multiple times at one site
- `implementationOf`: the interface implemented by this node
- `params` / `visibility`: structured display metadata

## SQLite queries

Schema version 3. Key tables/views:

- `endpoints` (`tree_built`), `traces` (`tree_built`, `implementation_of`)
- `call_nodes` (`root_type` = `endpoint|trace`, `sort_key`, `implementation_of`, `cyclic`)
- `v_endpoint_overview`, `v_trace_overview`, `v_module_overview`, `v_file_overview`

```sql
-- Endpoint trees and build status
SELECT * FROM v_endpoint_overview;

-- Full tree of one endpoint
SELECT path, label, kind, implementation_of, cyclic
FROM call_nodes
WHERE root_type = 'endpoint' AND endpoint_id = 'GET /api/orders/list'
ORDER BY sort_key;

-- Method-level traces, including implementations
SELECT * FROM v_trace_overview;
SELECT endpoint_id, path, label, implementation_of
FROM call_nodes
WHERE root_type = 'trace'
ORDER BY endpoint_id, sort_key;

-- Unbuilt roots
SELECT id FROM v_endpoint_overview WHERE tree_built = 0;
SELECT id FROM v_trace_overview WHERE tree_built = 0;

-- Feign targets
SELECT client_name, method_name, http_method, path FROM feign_operations;
SELECT * FROM feign_operation_targets;

-- Reverse file dependency
SELECT file_path, count, kinds_json
FROM file_dependencies
WHERE to_type = 'com.example.order.client.UserClient';
```

JSON output contains `meta`, `stats`, `modules`, `moduleEdges`, `endpoints[].tree`, `traces[].tree`, `feignClients`, `feignOperations`, `files[].dependencies`, `warnings`. `meta.options` records the filters used for the run.

## Web UI

- Project root + analyze.
- “端点关键词 / 精确类名 / 精确函数名” inputs: only matching results (AND) are listed; the results view does not show every unrelated chain.
- “方法调用链” tab shows interface implementations as separate cards.
- “参数列表 / 参数类型 / 可见性” toggles re-render labels client-side.
- Unbuilt cards have “构建调用树” buttons that run a focused incremental analysis.
- SQLite save path is optional; leave empty for in-memory-only analysis.

## Verification checklist

```bash
npm run typecheck
npm test
npm run build
```

Fixtures:

- `examples/shop`: Maven multi-module + Feign remote expansion.
- `examples/gradle-shop`: Gradle Kotlin DSL.
- `examples/cycles`: interface with two implementations, one recursive cycle, one Mapper branch.

Expected cycle output: the repeated method node has `cyclic: true`, empty children, and both implementation branches are present.
