#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { analyzeDirectory } from "./analyze.ts";
import type { AnalysisResult, CallTreeNode } from "./model.ts";
import type { DeepReadonly } from "./types.ts";
import { writeAnalysisToSqlite, type SqliteWriteResult } from "./store/sqlite.ts";
import { DEFAULT_DISPLAY_MODE, formatNodeLabel, type DisplayMode } from "./graph/display.ts";

const OUTPUT_FORMATS = ["sqlite", "json", "both"] as const;
type OutputFormat = (typeof OUTPUT_FORMATS)[number];

const isOutputFormat = (value: string): value is OutputFormat =>
    OUTPUT_FORMATS.some((format) => format === value);

const main = (): void => {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            out: { type: "string", short: "o", default: "feign-trace.json" },
            db: { type: "string", default: "feign-trace.db" },
            format: { type: "string", default: "sqlite" },
            "max-depth": { type: "string", default: "12" },
            "max-files": { type: "string", default: "50000" },
            "include-external": { type: "boolean", default: false },
            "no-follow-feign": { type: "boolean", default: false },
            "no-source": { type: "boolean", default: false },
            "exclude-self-calls": { type: "boolean", default: false },
            "class-filter": { type: "string" },
            "all-classes": { type: "boolean", default: false },
            keyword: { type: "string", multiple: true },
            "class-name": { type: "string", multiple: true },
            "method-name": { type: "string", multiple: true },
            "no-trees": { type: "boolean", default: false },
            "rebuild-dir": { type: "string" },
            "no-cache": { type: "boolean", default: false },
            "cache-dir": { type: "string", default: ".feign-tracer-cache" },
            fresh: { type: "boolean", default: false },
            "hide-params": { type: "boolean", default: false },
            "show-param-types": { type: "boolean", default: false },
            "show-visibility": { type: "boolean", default: false },
            "list-endpoints": { type: "boolean", default: false },
            ignore: { type: "string" },
            compact: { type: "boolean", default: false },
            quiet: { type: "boolean", default: false },
            "print-trees": { type: "boolean", default: false },
            stdout: { type: "boolean", default: false },
            help: { type: "boolean", short: "h", default: false },
            version: { type: "boolean", short: "v", default: false },
        },
    });

    if (values.help) {
        printHelp();
        return;
    }
    if (values.version) {
        console.log("feign-tracer 1.0.0");
        return;
    }

    const formatValue = String(values.format).toLowerCase();
    if (!isOutputFormat(formatValue)) {
        throw new Error(`Unknown --format "${values.format}" (expected sqlite, json or both)`);
    }
    const format = formatValue;

    const root = resolve(positionals[0] ?? ".");
    const classFilterOption = values["class-filter"];
    const keywords = multiList(values.keyword);
    const classNames = multiList(values["class-name"]);
    const methodNames = multiList(values["method-name"]);
    const incremental =
        !values.fresh &&
        (keywords.length > 0 ||
            classNames.length > 0 ||
            methodNames.length > 0 ||
            Boolean(values["rebuild-dir"]) ||
            Boolean(values["no-trees"]));
    const result = analyzeDirectory({
        root,
        maxDepth: numberOption(values["max-depth"], 12),
        maxFiles: numberOption(values["max-files"], 50000),
        includeExternal: Boolean(values["include-external"]),
        followFeign: !values["no-follow-feign"],
        includeSource: !values["no-source"],
        excludeSelfCalls: Boolean(values["exclude-self-calls"]),
        classFilters: values["all-classes"]
            ? []
            : classFilterOption
              ? splitList(classFilterOption)
              : undefined,
        keywords,
        classNames,
        methodNames,
        buildTrees: !values["no-trees"],
        rebuildDir: values["rebuild-dir"],
        useCache: !values["no-cache"],
        cacheDir: String(values["cache-dir"]),
        ignore: values.ignore ? splitList(values.ignore) : [],
    });

    const displayMode: DisplayMode = {
        ...DEFAULT_DISPLAY_MODE,
        params: !values["hide-params"],
        paramTypes: Boolean(values["show-param-types"]),
        visibility: Boolean(values["show-visibility"]),
    };

    const toStdout = values.stdout || values.out === "-";
    let jsonPath: string | undefined;
    let dbInfo: SqliteWriteResult | undefined;

    if (toStdout) {
        const output = JSON.stringify(result, null, values.compact ? 0 : 2);
        process.stdout.write(output);
        if (!output.endsWith("\n")) process.stdout.write("\n");
    } else {
        if (format === "json" || format === "both") {
            const outPath = resolve(String(values.out));
            mkdirSync(dirname(outPath), { recursive: true });
            writeFileSync(outPath, JSON.stringify(result, null, values.compact ? 0 : 2), "utf8");
            jsonPath = outPath;
        }
        if (format === "sqlite" || format === "both") {
            dbInfo = writeAnalysisToSqlite(result, String(values.db), { merge: incremental });
        }
        if (!values.quiet) printSummary(result, { jsonPath, dbInfo });
    }

    if (values["list-endpoints"] && !toStdout) {
        printEndpointList(result);
    }

    if (values["print-trees"] && !toStdout) {
        printAllTrees(result, displayMode);
    }
};

const multiList = (value: string | string[] | undefined): string[] => {
    if (!value) return [];
    const list = Array.isArray(value) ? value : [value];
    return list.flatMap((item) => splitList(item));
};

const splitList = (value: string): string[] => {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

const numberOption = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const printSummary = (
    result: DeepReadonly<AnalysisResult>,
    outputs: { jsonPath?: string; dbInfo?: SqliteWriteResult },
): void => {
    const stats = result.stats;
    console.log("");
    console.log("feign-tracer");
    console.log(`  root       ${result.meta.root}`);
    console.log(
        `  modules    ${stats.modules} (${result.modules.filter((module) => module.buildTool === "maven").length} maven, ${result.modules.filter((module) => module.buildTool === "gradle").length} gradle)`,
    );
    console.log(
        `  sources    ${stats.sourceFiles} (${stats.javaFiles} java, ${stats.kotlinFiles} kotlin, ${stats.groovyFiles} groovy)`,
    );
    console.log(`  types      ${stats.types}`);
    console.log(`  methods    ${stats.methods}`);
    console.log(`  calls      ${stats.calls} (${stats.resolvedCalls} resolved)`);
    console.log(`  endpoints  ${stats.endpoints} (${stats.endpointsBuilt} trees built)`);
    if (stats.traces > 0) {
        console.log(`  traces     ${stats.traces} (${stats.tracesBuilt} trees built)`);
    }
    console.log(`  feign      ${stats.feignClients} clients / ${stats.feignOperations} operations`);
    console.log(`  parse errs ${stats.parseErrors}`);
    console.log(`  duration   ${stats.durationMs} ms`);
    if (outputs.dbInfo) {
        const rows = outputs.dbInfo.rowCounts;
        console.log(
            `  database   ${outputs.dbInfo.path} (${formatBytes(outputs.dbInfo.bytes)}, ${rows.call_nodes ?? 0} call nodes)`,
        );
    }
    if (outputs.jsonPath) {
        console.log(`  json       ${outputs.jsonPath}`);
    }
    if (result.warnings.length > 0) {
        console.log("");
        for (const warning of result.warnings.slice(0, 10)) console.log(`  warning: ${warning}`);
        if (result.warnings.length > 10)
            console.log(`  ... ${result.warnings.length - 10} more warnings`);
    }
    console.log("");
};

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const printEndpointList = (result: DeepReadonly<AnalysisResult>): void => {
    console.log("");
    console.log("Endpoints:");
    for (const endpoint of result.endpoints) {
        const status = endpoint.treeBuilt ? "[built]" : "[     ]";
        console.log(
            `  ${status} ${endpoint.httpMethod} ${endpoint.paths.join(", ")} -> ${endpoint.handlerLabel}  (${endpoint.id})`,
        );
    }
    if (result.traces.length > 0) {
        console.log("");
        console.log("Method traces:");
        for (const trace of result.traces) {
            const status = trace.treeBuilt ? "[built]" : "[     ]";
            const implementation = trace.implementationOf
                ? ` (impl of ${trace.implementationOf.split(".").pop() ?? trace.implementationOf})`
                : "";
            console.log(
                `  ${status} ${trace.className}#${trace.methodName}${implementation}  (${trace.id})`,
            );
        }
    }
};

const printAllTrees = (result: DeepReadonly<AnalysisResult>, mode: DisplayMode): void => {
    for (const endpoint of result.endpoints) {
        console.log(
            `${endpoint.httpMethod} ${endpoint.paths.join(", ")}  ->  ${endpoint.handlerLabel}${
                endpoint.treeBuilt ? "" : " [tree not built]"
            }`,
        );
        printTree(endpoint.tree, 0, mode);
        console.log("");
    }

    if (result.traces.length > 0) {
        for (const trace of result.traces) {
            const implementation = trace.implementationOf
                ? `  (impl of ${trace.implementationOf.split(".").pop() ?? trace.implementationOf})`
                : "";
            console.log(`TRACE ${trace.className}#${trace.methodName}${implementation}`);
            printTree(trace.tree, 0, mode);
            console.log("");
        }
    }
};

const printTree = (node: DeepReadonly<CallTreeNode>, indent: number, mode: DisplayMode): void => {
    const marker =
        node.kind === "feign"
            ? " [feign]"
            : node.kind === "remote"
              ? " [remote]"
              : node.cyclic
                ? " [cycle]"
                : node.unresolved
                  ? " [unresolved]"
                  : node.implementationOf
                    ? ` [impl of ${node.implementationOf}]`
                    : "";
    const count = node.callCount && node.callCount > 1 ? ` x${node.callCount}` : "";
    console.log(
        `${"  ".repeat(indent)}${node.path} ${formatNodeLabel(node, mode)}${marker}${count}`,
    );
    for (const child of node.children) printTree(child, indent + 1, mode);
};

const printHelp = (): void => {
    console.log(`feign-tracer - ANTLR4 based Maven/Gradle + Feign call-chain analyser

Usage:
  feign-tracer <root-directory> [options]
  npm run analyze -- <root-directory> [options]

Options:
      --format <kind>    Output format: sqlite | json | both               [sqlite]
      --db <file>        SQLite database path                              [feign-trace.db]
  -o, --out <file>       JSON output path (used by json/both; "-" = stdout) [feign-trace.json]
      --stdout           Print JSON to stdout and write no files
      --max-depth <n>    Maximum call tree depth                             [12]
      --max-files <n>    Maximum files to scan                               [50000]
      --include-external Include unresolved/external calls as leaf nodes
      --no-follow-feign  Do not expand Feign calls to matching controllers
      --exclude-self-calls
                         Skip self-class calls (prunes their subtrees)
      --class-filter <regexes>
                         Comma separated regexes matched against the target class
                         name (simple, display and fully qualified). Overrides the default.
      --all-classes      Disable the class-name filter (keep every class)
      --no-source        Omit the per-file dependency section
      --ignore <dirs>    Extra comma separated directory names to ignore
      --keyword <text>   Only build endpoints matching keyword(s); repeatable/comma
      --class-name <name>
                         Exact controller/class simple name or FQN; repeatable/comma
      --method-name <name>
                         Exact method name; repeatable/comma. Combine with
                         --class-name to trace a service/interface method directly.
      --no-trees         Index endpoints/traces without expanding call trees
      --rebuild-dir <dir>
                         Re-parse and rebuild only endpoints under this directory
      --no-cache         Disable the per-file parse cache
      --cache-dir <dir>  Parse cache directory                    [.feign-tracer-cache]
      --fresh            Replace the database instead of merging incremental runs
      --list-endpoints   Print endpoints/traces with their built status
      --hide-params      Hide parameter lists in --print-trees output
      --show-param-types Show parameter types (name: Type)
      --show-visibility  Prefix methods with public/protected/private
      --compact          Minified JSON
      --quiet            Suppress the summary
      --print-trees      Print ordered call trees to the console
  -h, --help             Show this help
  -v, --version          Show the version

Incremental workflows:
  # 1. Index endpoints only
  feign-tracer . --no-trees
  # 2. Build trees for matching endpoints
  feign-tracer . --keyword order --print-trees
  # 3. Rebuild only one controller/method
  feign-tracer . --class-name OrderController --method-name list
  # 4. Trace an interface; every implementation gets its own tree
  feign-tracer . --class-name OrderService --method-name list --print-trees
  # 5. Rebuild everything under a directory (also bypasses its parse cache)
  feign-tracer . --rebuild-dir src/main/java/com/acme/order

  Incremental selections merge into the existing --db; pass --fresh to replace it.

Call tree filters:
  Default class filter (only these classes appear below the endpoint root):
    Controller$ Client$ Service$ ServiceImpl$ Mapper$ Repo$ Repository$
  The filter prunes a mismatching node together with its callees, so include
  every layer you want to traverse. Endpoint roots and remote controllers are
  always kept.
  Example:
    --class-filter "Controller$,Service$,ServiceImpl$,Mapper$" --exclude-self-calls

Storage:
  Default output is a SQLite database (schema v3) with the tables
  analysis, stats, modules, module_dependencies, module_edges, module_children,
  endpoints, traces, call_nodes, feign_clients, feign_client_methods,
  feign_operations, feign_operation_targets, source_files, file_dependencies,
  warnings and the views v_endpoint_overview, v_trace_overview,
  v_module_overview, v_file_overview.

Output:
  JSON: meta, stats, modules, moduleEdges, endpoints[].tree, traces[].tree,
  feignClients, feignOperations, files[].dependencies

Tree order:
  (0) Controller.method(args)
  (0-0) Service.method(args)
  (0-1) Service.other(args)
  (0-0-0) Mapper.method(args)
`);
};

try {
    main();
} catch (error) {
    console.error(`feign-tracer: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}
