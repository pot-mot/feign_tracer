import type {
    AnalysisResult,
    CallTreeNode,
    EndpointInfo,
    FileAnalysis,
    MethodTrace,
} from "../src/model.ts";
import { formatNodeLabel, type DisplayMode } from "../src/graph/display.ts";
import "./style.css";

const TABS = ["endpoints", "traces", "modules", "files", "json"] as const;
type Tab = (typeof TABS)[number];
type AnalyzeResponse = AnalysisResult & { error?: string; dbPath?: string; dbBytes?: number };
type AnalyzeOverrides = {
    keywords?: string[];
    classNames?: string[];
    methodNames?: string[];
    preserve?: boolean;
};

/** DOM 节点缺失说明页面结构被破坏，直接抛错比静默失败更易定位。 */
const requireElement = <T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`缺少页面元素 ${selector}`);
    return element;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isAnalyzeResponse = (value: unknown): value is AnalyzeResponse => {
    if (!isRecord(value)) return false;
    return (
        isRecord(value.meta) &&
        isRecord(value.stats) &&
        Array.isArray(value.modules) &&
        Array.isArray(value.moduleEdges) &&
        Array.isArray(value.endpoints) &&
        Array.isArray(value.traces) &&
        Array.isArray(value.feignClients) &&
        Array.isArray(value.feignOperations) &&
        Array.isArray(value.files) &&
        Array.isArray(value.warnings)
    );
};

const app = requireElement<HTMLDivElement>("#app");

const DEFAULT_CLASS_FILTERS = [
    "Controller$",
    "Client$",
    "Service$",
    "ServiceImpl$",
    "Mapper$",
    "Repo$",
    "Repository$",
].join(",");

let result: AnalyzeResponse | undefined;
let activeTab: Tab = "endpoints";
let fileFilter = "";
let endpointFilter = "";
let traceFilter = "";
type Selection = {
    readonly keywords: readonly string[];
    readonly classNames: readonly string[];
    readonly methodNames: readonly string[];
};
let lastSelection: Selection = { keywords: [], classNames: [], methodNames: [] };

app.innerHTML = `
  <header class="hero">
    <div class="brand">
      <div class="logo">FT</div>
      <div>
        <h1>Feign Tracer</h1>
        <p>ANTLR4 · Maven / Gradle 模块依赖 · Controller → Service → Mapper / Feign 调用树</p>
      </div>
    </div>
    <div class="status" id="status">就绪</div>
  </header>

  <section class="panel search-panel">
    <label class="root-field">
      <span>项目根目录</span>
      <input id="root" spellcheck="false" placeholder="D:\\path\\to\\project" />
    </label>
    <div class="options">
      <label><input id="followFeign" type="checkbox" checked /> 跨服务追踪 Feign</label>
      <label><input id="includeExternal" type="checkbox" /> 包含未解析调用</label>
      <label title="跳过调用方自身类中的方法调用（连同其子树）"><input id="excludeSelfCalls" type="checkbox" /> 排除自调用</label>
      <label class="depth"><span>最大深度</span><input id="maxDepth" type="number" min="1" max="60" value="12" /></label>
    </div>
    <label class="class-filter">
      <span>类名过滤（正则，逗号分隔，留空=全部）</span>
      <input id="classFilters" type="text" spellcheck="false" value="${DEFAULT_CLASS_FILTERS}" title="不匹配的节点会连同其子树一起剪掉，因此请包含需要穿透的每一层" />
    </label>
    <div class="selection-row">
      <label>
        <span>端点关键词（可选）</span>
        <input id="keywords" type="text" spellcheck="false" placeholder="order, /api/users" />
      </label>
      <label>
        <span>精确类名（可选）</span>
        <input id="className" type="text" spellcheck="false" placeholder="OrderController 或 com.acme.OrderService" />
      </label>
      <label>
        <span>精确函数名（可选）</span>
        <input id="methodName" type="text" spellcheck="false" placeholder="list" />
      </label>
    </div>
    <div class="display-options">
      <span>调用链显示：</span>
      <label><input id="showParams" type="checkbox" checked /> 参数列表</label>
      <label><input id="showParamTypes" type="checkbox" /> 参数类型</label>
      <label><input id="showVisibility" type="checkbox" /> 可见性</label>
    </div>
    <label class="db-field">
      <span>SQLite 保存路径（留空不保存）</span>
      <input id="dbPath" type="text" spellcheck="false" value="feign-trace.db" title="相对服务端工作目录；留空则只在内存中分析" />
    </label>
    <button id="analyze" class="primary">开始分析</button>
  </section>

  <main id="content"></main>
`;

const rootInput = requireElement<HTMLInputElement>("#root");
const followFeign = requireElement<HTMLInputElement>("#followFeign");
const includeExternal = requireElement<HTMLInputElement>("#includeExternal");
const excludeSelfCalls = requireElement<HTMLInputElement>("#excludeSelfCalls");
const classFiltersInput = requireElement<HTMLInputElement>("#classFilters");
const keywordsInput = requireElement<HTMLInputElement>("#keywords");
const classNameInput = requireElement<HTMLInputElement>("#className");
const methodNameInput = requireElement<HTMLInputElement>("#methodName");
const showParams = requireElement<HTMLInputElement>("#showParams");
const showParamTypes = requireElement<HTMLInputElement>("#showParamTypes");
const showVisibility = requireElement<HTMLInputElement>("#showVisibility");
const dbPathInput = requireElement<HTMLInputElement>("#dbPath");
const maxDepth = requireElement<HTMLInputElement>("#maxDepth");
const analyzeButton = requireElement<HTMLButtonElement>("#analyze");
const statusEl = requireElement<HTMLDivElement>("#status");
const content = requireElement<HTMLElement>("#content");

fetch("/api/analyze")
    .then(async (response) => {
        const payload: unknown = await response.json();
        if (isRecord(payload) && typeof payload.root === "string") {
            rootInput.value = payload.root;
        }
    })
    .catch(() => {
        rootInput.value = "D:\\project\\feign_tracer\\examples\\shop";
    });

for (const toggle of [showParams, showParamTypes, showVisibility]) {
    toggle.addEventListener("change", () => render());
}
analyzeButton.addEventListener("click", () => void analyze());
rootInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void analyze();
});

const analyze = async (overrides: AnalyzeOverrides = {}): Promise<void> => {
    const root = rootInput.value.trim();
    if (!root) {
        setStatus("请输入目录", true);
        return;
    }
    const keywords = overrides.keywords ?? splitFilters(keywordsInput.value);
    const classNames = overrides.classNames ?? splitFilters(classNameInput.value);
    const methodNames = overrides.methodNames ?? splitFilters(methodNameInput.value);
    const incremental = keywords.length > 0 || classNames.length > 0 || methodNames.length > 0;

    analyzeButton.disabled = true;
    setStatus(incremental ? "构建匹配调用链…" : "解析中…");
    content.innerHTML = `<div class="loading"><div class="spinner"></div><span>${
        incremental
            ? "正在定位精确类名/函数名并构建调用链…"
            : "正在扫描目录、解析 ANTLR 语法树并构建调用链…"
    }</span></div>`;

    try {
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                root,
                followFeign: followFeign.checked,
                includeExternal: includeExternal.checked,
                excludeSelfCalls: excludeSelfCalls.checked,
                classFilters: splitFilters(classFiltersInput.value),
                keywords,
                classNames,
                methodNames,
                buildTrees: true,
                fresh: !incremental,
                dbPath: dbPathInput.value.trim() || undefined,
                maxDepth: Number(maxDepth.value) || 12,
                includeSource: true,
            }),
        });
        const raw: unknown = await response.json();
        if (!response.ok) {
            const message =
                isRecord(raw) && typeof raw.error === "string"
                    ? raw.error
                    : `HTTP ${response.status}`;
            throw new Error(message);
        }
        if (!isAnalyzeResponse(raw)) throw new Error("服务端返回了无法识别的数据结构");
        const payload = raw;
        lastSelection = { keywords, classNames, methodNames };
        result = incremental && result ? mergeResults(result, payload) : payload;
        const visibleEndpoints = result.endpoints.filter((endpoint) =>
            matchesEndpointSelection(endpoint, lastSelection),
        );
        const visibleTraces = result.traces.filter((trace) =>
            matchesTraceSelection(trace, lastSelection),
        );
        if (visibleEndpoints.length === 0 && visibleTraces.length > 0) {
            activeTab = "traces";
        } else if (
            visibleEndpoints.length > 0 &&
            visibleTraces.length === 0 &&
            activeTab === "traces"
        ) {
            activeTab = "endpoints";
        }
        render();
        const dbNote = payload.dbPath ? ` · SQLite ${formatBytes(payload.dbBytes ?? 0)}` : "";
        const builtEndpoints = result.endpoints.filter((endpoint) => endpoint.treeBuilt).length;
        const builtTraces = result.traces.filter((trace) => trace.treeBuilt).length;
        statusEl.title = payload.dbPath ?? "";
        setStatus(
            `完成 · ${builtEndpoints}/${result.endpoints.length} 端点树 · ${builtTraces}/${result.traces.length} 方法链 · ${payload.stats.durationMs} ms${dbNote}`,
        );
    } catch (error) {
        content.innerHTML = `<div class="error-box"><strong>分析失败</strong><pre>${escapeHtml(
            error instanceof Error ? error.message : String(error),
        )}</pre></div>`;
        setStatus("失败", true);
    } finally {
        analyzeButton.disabled = false;
    }
};

/**
 * 增量响应只包含本次新建的根。保留客户端已有的调用树，
 * 并让之前发现的调用链继续可见。
 */
const mergeResults = (previous: AnalyzeResponse, next: AnalyzeResponse): AnalyzeResponse => {
    const previousEndpoints = new Map(
        previous.endpoints.map((endpoint) => [endpoint.id, endpoint]),
    );
    const endpoints = next.endpoints.map((endpoint) => {
        const old = previousEndpoints.get(endpoint.id);
        return !endpoint.treeBuilt && old?.treeBuilt ? old : endpoint;
    });

    const previousTraces = new Map(previous.traces.map((trace) => [trace.id, trace]));
    const traces = next.traces.map((trace) => {
        const old = previousTraces.get(trace.id);
        return !trace.treeBuilt && old?.treeBuilt ? old : trace;
    });
    const known = new Set(traces.map((trace) => trace.id));
    for (const trace of previous.traces) {
        if (!known.has(trace.id)) traces.push(trace);
    }

    return { ...next, endpoints, traces };
};

const currentDisplayMode = (): DisplayMode => {
    return {
        params: showParams.checked,
        paramTypes: showParamTypes.checked,
        visibility: showVisibility.checked,
    };
};

const setStatus = (text: string, error = false): void => {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", error);
};

const render = (): void => {
    if (!result) return;
    const data = result;
    content.innerHTML = "";

    content.appendChild(statsSection(data));
    content.appendChild(tabsSection(data));
};

const statsSection = (data: AnalysisResult): HTMLElement => {
    const section = el("section", "stats");
    const items: Array<[string, string, string]> = [
        [
            "模块",
            String(data.stats.modules),
            `${data.modules.filter((m) => m.buildTool === "maven").length} Maven / ${data.modules.filter((m) => m.buildTool === "gradle").length} Gradle`,
        ],
        [
            "源文件",
            String(data.stats.sourceFiles),
            `${data.stats.javaFiles} Java · ${data.stats.kotlinFiles} Kotlin · ${data.stats.groovyFiles} Groovy`,
        ],
        [
            "类型 / 方法",
            `${data.stats.types} / ${data.stats.methods}`,
            `${data.stats.calls} 次调用`,
        ],
        [
            "Controller 端点",
            String(data.stats.endpoints),
            `${data.stats.endpointsBuilt} 已构建调用树`,
        ],
        [
            "方法调用链",
            String(data.stats.traces),
            `${data.stats.tracesBuilt} 已构建 · 精确类名/函数`,
        ],
        [
            "Feign",
            `${data.stats.feignClients} / ${data.stats.feignOperations}`,
            "客户端 / 远程方法",
        ],
        [
            "语法错误",
            String(data.stats.parseErrors),
            data.stats.parseErrors > 0 ? "已容错恢复" : "全部通过",
        ],
    ];
    for (const [label, value, hint] of items) {
        const card = el("div", "stat-card");
        card.appendChild(el("div", "stat-label", label));
        card.appendChild(el("div", "stat-value", value));
        card.appendChild(el("div", "stat-hint", hint));
        section.appendChild(card);
    }
    return section;
};

const tabsSection = (data: AnalysisResult): HTMLElement => {
    const section = el("section", "panel results");
    const tabs = el("div", "tabs");
    const contentArea = el("div", "tab-content");

    const selection = lastSelection;
    const selectedEndpoints = data.endpoints.filter((endpoint) =>
        matchesEndpointSelection(endpoint, selection),
    );
    const selectedTraces = data.traces.filter((trace) => matchesTraceSelection(trace, selection));

    const definitions: Array<[Tab, string, string]> = [
        ["endpoints", "调用链", `${selectedEndpoints.length}`],
        ["traces", "方法调用链", `${selectedTraces.length}`],
        ["modules", "模块依赖", `${data.modules.length}`],
        ["files", "文件依赖", `${data.files.length}`],
        ["json", "JSON", ""],
    ];

    for (const [id, label, count] of definitions) {
        const button = el("button", `tab${activeTab === id ? " active" : ""}`);
        button.append(document.createTextNode(label));
        if (count) button.appendChild(el("span", "tab-count", count));
        button.addEventListener("click", () => {
            activeTab = id;
            render();
        });
        tabs.appendChild(button);
    }

    section.appendChild(tabs);
    section.appendChild(contentArea);

    if (activeTab === "endpoints") contentArea.appendChild(endpointsView(data));
    else if (activeTab === "traces") contentArea.appendChild(tracesView(data));
    else if (activeTab === "modules") contentArea.appendChild(modulesView(data));
    else if (activeTab === "files") contentArea.appendChild(filesView(data));
    else contentArea.appendChild(jsonView(data));

    return section;
};

const endpointsView = (data: AnalysisResult): HTMLElement => {
    const wrapper = el("div", "endpoints");
    const toolbar = el("div", "toolbar");
    const search = document.createElement("input");
    search.placeholder = "过滤端点 / Controller / 方法…";
    search.className = "filter";
    search.value = endpointFilter;
    toolbar.appendChild(search);
    toolbar.appendChild(el("div", "toolbar-hint", "序号即有序调用路径，例如 (0-1-0)"));
    const activeFilters = data.meta.options.classFilters;
    const selectionHint = describeSelection(lastSelection);
    if (selectionHint) toolbar.appendChild(el("div", "toolbar-hint", selectionHint));
    toolbar.appendChild(
        el(
            "div",
            "toolbar-hint",
            `${activeFilters.length > 0 ? `类名过滤 ${activeFilters.join(" · ")}` : "类名过滤已关闭"}${
                data.meta.options.excludeSelfCalls ? " · 已排除自调用" : ""
            }`,
        ),
    );
    wrapper.appendChild(toolbar);

    const list = el("div", "endpoint-list");
    wrapper.appendChild(list);

    const draw = () => {
        endpointFilter = search.value;
        const needle = endpointFilter.trim().toLowerCase();
        list.innerHTML = "";
        const endpoints = data.endpoints
            .filter((endpoint) => matchesEndpointSelection(endpoint, lastSelection))
            .filter((endpoint) => {
                if (!needle) return true;
                return `${endpoint.id} ${endpoint.handlerLabel} ${endpoint.controller}`
                    .toLowerCase()
                    .includes(needle);
            });
        if (endpoints.length === 0) {
            list.appendChild(
                el(
                    "div",
                    "empty",
                    lastSelection.classNames.length > 0 || lastSelection.methodNames.length > 0
                        ? "没有符合“关键词 + 精确类名 + 精确函数名（AND）”的 Controller 端点；请查看“方法调用链”页签。"
                        : "没有匹配的端点",
                ),
            );
            return;
        }
        const mode = currentDisplayMode();
        for (const endpoint of endpoints) list.appendChild(endpointCard(endpoint, mode));
    };

    search.addEventListener("input", draw);
    draw();
    return wrapper;
};

const tracesView = (data: AnalysisResult): HTMLElement => {
    const wrapper = el("div", "endpoints");
    const toolbar = el("div", "toolbar");
    const search = document.createElement("input");
    search.placeholder = "过滤类名 / 函数名 / 接口实现…";
    search.className = "filter";
    search.value = traceFilter;
    toolbar.appendChild(search);
    toolbar.appendChild(
        el("div", "toolbar-hint", "精确类名 + 函数名：接口会展开为每个实现类的调用树"),
    );
    const selectionHint = describeSelection(lastSelection);
    if (selectionHint) toolbar.appendChild(el("div", "toolbar-hint", selectionHint));
    wrapper.appendChild(toolbar);

    const list = el("div", "endpoint-list");
    wrapper.appendChild(list);

    const draw = () => {
        traceFilter = search.value;
        const needle = traceFilter.trim().toLowerCase();
        list.innerHTML = "";
        const traces = data.traces
            .filter((trace) => matchesTraceSelection(trace, lastSelection))
            .filter((trace) => {
                if (!needle) return true;
                return `${trace.className} ${trace.methodName} ${trace.implementationOf ?? ""}`
                    .toLowerCase()
                    .includes(needle);
            });
        if (traces.length === 0) {
            list.appendChild(
                el(
                    "div",
                    "empty",
                    "没有方法调用链。输入精确类名/函数名后分析，例如 OrderService + list。",
                ),
            );
            return;
        }
        const mode = currentDisplayMode();
        for (const trace of traces) list.appendChild(traceCard(trace, mode));
    };

    search.addEventListener("input", draw);
    draw();
    return wrapper;
};

const endpointCard = (endpoint: EndpointInfo, mode: DisplayMode): HTMLElement => {
    const card = el("article", "endpoint-card");
    const head = el("div", "endpoint-head");
    const method = el(
        "span",
        `http http-${endpoint.httpMethod.toLowerCase()}`,
        endpoint.httpMethod,
    );
    head.appendChild(method);
    head.appendChild(el("code", "endpoint-path", endpoint.paths.join("  |  ")));
    const meta = el("div", "endpoint-meta");
    meta.append(
        el("span", "pill", endpoint.controller.split(".").pop() ?? endpoint.controller),
        el("span", "pill muted", endpoint.moduleId ?? "unassigned"),
        el("span", "pill muted", `L${endpoint.line ?? 0}`),
    );
    if (!endpoint.treeBuilt) {
        meta.appendChild(el("span", "pill pending", "未构建"));
        const build = document.createElement("button");
        build.className = "primary small";
        build.textContent = "构建调用树";
        build.addEventListener("click", () => {
            build.disabled = true;
            const methodName = handlerMethodName(endpoint);
            void analyze({
                classNames: [endpoint.controller],
                methodNames: methodName ? [methodName] : [],
                preserve: true,
            }).finally(() => {
                build.disabled = false;
            });
        });
        meta.appendChild(build);
    } else {
        meta.appendChild(el("span", "pill built", "已构建"));
    }
    head.appendChild(meta);
    card.appendChild(head);

    const tree = el("div", "tree");
    tree.appendChild(renderTreeNode(endpoint.tree, true, mode));
    card.appendChild(tree);

    const footer = el("div", "endpoint-footer");
    footer.appendChild(el("span", "", `handler: ${endpoint.handler}`));
    if (endpoint.file) footer.appendChild(el("span", "", endpoint.file));
    card.appendChild(footer);
    return card;
};

const traceCard = (trace: MethodTrace, mode: DisplayMode): HTMLElement => {
    const card = el("article", "endpoint-card trace-card");
    const head = el("div", "endpoint-head");
    head.appendChild(el("span", "http http-trace", "TRACE"));
    head.appendChild(el("code", "endpoint-path", trace.label));
    const meta = el("div", "endpoint-meta");
    meta.append(
        el("span", "pill", trace.kind),
        el("span", "pill muted", trace.moduleId ?? "unassigned"),
        el("span", "pill muted", `L${trace.line ?? 0}`),
    );
    if (trace.implementationOf) {
        const implementationName =
            trace.implementationOf.split(".").pop() ?? trace.implementationOf;
        meta.appendChild(el("span", "pill impl", `impl of ${implementationName}`));
    }
    if (!trace.treeBuilt) {
        meta.appendChild(el("span", "pill pending", "未构建"));
        const build = document.createElement("button");
        build.className = "primary small";
        build.textContent = "构建调用树";
        build.addEventListener("click", () => {
            build.disabled = true;
            void analyze({
                classNames: [trace.className],
                methodNames: [trace.methodName],
                preserve: true,
            }).finally(() => {
                build.disabled = false;
            });
        });
        meta.appendChild(build);
    } else {
        meta.appendChild(el("span", "pill built", "已构建"));
    }
    head.appendChild(meta);
    card.appendChild(head);

    const tree = el("div", "tree");
    tree.appendChild(renderTreeNode(trace.tree, true, mode));
    card.appendChild(tree);

    const footer = el("div", "endpoint-footer");
    footer.appendChild(el("span", "", `class: ${trace.className}`));
    if (trace.file) footer.appendChild(el("span", "", trace.file));
    card.appendChild(footer);
    return card;
};

const handlerMethodName = (endpoint: EndpointInfo): string | undefined => {
    const match = /#([^/]+)\//.exec(endpoint.handler);
    return match?.[1];
};

/** 关键词 AND 精确类名 AND 精确函数名，与服务端过滤逻辑一致。 */
const matchesEndpointSelection = (endpoint: EndpointInfo, selection: Selection): boolean => {
    if (
        !matchesKeywords(selection.keywords, [
            endpoint.id,
            endpoint.handler,
            endpoint.handlerLabel,
            endpoint.controller,
            endpoint.moduleId ?? "",
            ...endpoint.paths,
        ])
    ) {
        return false;
    }
    if (selection.classNames.length > 0) {
        const simpleName = endpoint.controller.split(".").pop() ?? endpoint.controller;
        if (
            !selection.classNames.some(
                (name) => name === endpoint.controller || name === simpleName,
            )
        ) {
            return false;
        }
    }
    if (selection.methodNames.length > 0) {
        const methodName = handlerMethodName(endpoint);
        if (!methodName || !selection.methodNames.includes(methodName)) return false;
    }
    return true;
};

const matchesTraceSelection = (trace: MethodTrace, selection: Selection): boolean => {
    if (
        !matchesKeywords(selection.keywords, [
            trace.id,
            trace.className,
            trace.methodName,
            trace.label,
            trace.implementationOf ?? "",
        ])
    ) {
        return false;
    }
    if (selection.classNames.length > 0) {
        const candidates = [trace.className, trace.implementationOf].filter(
            (value): value is string => Boolean(value),
        );
        if (!candidates.some((value) => matchesClassName(value, selection.classNames))) {
            return false;
        }
    }
    if (selection.methodNames.length > 0 && !selection.methodNames.includes(trace.methodName)) {
        return false;
    }
    return true;
};

const matchesClassName = (value: string, names: readonly string[]): boolean => {
    const simpleName = value.split(".").pop() ?? value;
    return names.some((name) => name === value || name === simpleName);
};

const matchesKeywords = (keywords: readonly string[], values: readonly string[]): boolean => {
    if (keywords.length === 0) return true;
    const haystack = values.join("\n").toLowerCase();
    return keywords.every((keyword) => {
        const regex = /^\/(.+)\/([a-z]*)$/i.exec(keyword);
        if (regex) {
            try {
                return new RegExp(regex[1], `${regex[2].replace(/[gi]/g, "")}i`).test(haystack);
            } catch {
                return haystack.includes(keyword.toLowerCase());
            }
        }
        return haystack.includes(keyword.toLowerCase());
    });
};

const describeSelection = (selection: Selection): string => {
    const parts: string[] = [];
    if (selection.keywords.length > 0) parts.push(`keyword=${selection.keywords.join(",")}`);
    if (selection.classNames.length > 0) parts.push(`class=${selection.classNames.join(",")}`);
    if (selection.methodNames.length > 0) parts.push(`method=${selection.methodNames.join(",")}`);
    return parts.length > 0 ? `精确筛选（AND）：${parts.join(" · ")}` : "";
};

const renderTreeNode = (
    node: CallTreeNode,
    root = false,
    mode: DisplayMode = currentDisplayMode(),
): HTMLElement => {
    const wrapper = el("div", `node-node kind-${node.kind}${node.cyclic ? " cyclic" : ""}`);
    const label = el(root ? "div" : "div", "node-row");
    label.appendChild(el("span", "seq", node.path));
    label.appendChild(el("span", "node-label", formatNodeLabel(node, mode)));

    const kindLabels: Record<string, string> = {
        controller: "controller",
        service: "service",
        component: "bean",
        repository: "repository",
        mapper: "mapper",
        feign: "feign",
        remote: "remote",
        external: "external",
        unknown: "unknown",
    };
    label.appendChild(el("span", `badge badge-${node.kind}`, kindLabels[node.kind] ?? node.kind));
    if (node.feign) {
        label.appendChild(
            el(
                "span",
                "badge badge-feign",
                `${node.feign.httpMethod} ${node.feign.path}${node.feign.service ? ` → ${node.feign.service}` : ""}`,
            ),
        );
    }
    if (node.remote) label.appendChild(el("span", "badge badge-remote", node.remote.endpoint));
    if (node.implementationOf) {
        label.appendChild(el("span", "badge badge-impl", `impl of ${node.implementationOf}`));
    }
    if (node.cyclic) label.appendChild(el("span", "badge badge-cycle", "cycle"));
    if (node.unresolved) label.appendChild(el("span", "badge badge-external", "unresolved"));
    if (node.callCount && node.callCount > 1)
        label.appendChild(el("span", "badge badge-count", `x${node.callCount}`));
    if (node.line) label.appendChild(el("span", "node-line", `L${node.line}`));
    wrapper.appendChild(label);

    if (node.children.length > 0) {
        const children = el("div", "node-children");
        for (const child of node.children) children.appendChild(renderTreeNode(child, false, mode));
        wrapper.appendChild(children);
    }
    return wrapper;
};

const modulesView = (data: AnalysisResult): HTMLElement => {
    const wrapper = el("div", "modules");
    if (data.modules.length === 0) {
        wrapper.appendChild(el("div", "empty", "没有识别到模块"));
        return wrapper;
    }

    for (const module of data.modules) {
        const card = el("article", "module-card");
        const head = el("div", "module-head");
        head.appendChild(el("span", `badge badge-${module.buildTool}`, module.buildTool));
        head.appendChild(el("strong", "", module.name));
        head.appendChild(el("code", "muted-code", module.id));
        if (module.version) head.appendChild(el("span", "pill muted", module.version));
        head.appendChild(el("span", "pill muted", `${module.fileCount} files`));
        card.appendChild(head);

        const dir = el("div", "module-dir", module.dir || ".");
        card.appendChild(dir);

        const deps = module.dependencies;
        if (deps.length === 0) {
            card.appendChild(el("div", "empty small", "无构建依赖"));
        } else {
            const grid = el("div", "dep-grid");
            for (const dep of deps) {
                const chip = el("div", `dep-chip${dep.external ? " external" : " internal"}`);
                chip.appendChild(
                    el("span", "dep-config", dep.configuration ?? dep.scope ?? "compile"),
                );
                const depName =
                    dep.to ??
                    `${dep.groupId ?? "?"}:${dep.artifactId ?? "?"}${dep.version ? `:${dep.version}` : ""}`;
                chip.appendChild(el("code", "", depName));
                if (dep.to) chip.appendChild(el("span", "dep-arrow", "内部模块"));
                grid.appendChild(chip);
            }
            card.appendChild(grid);
        }

        if (module.modules && module.modules.length > 0) {
            const child = el("div", "module-children");
            child.appendChild(el("span", "muted", "聚合子模块："));
            for (const id of module.modules) child.appendChild(el("code", "mini-code", id));
            card.appendChild(child);
        }
        wrapper.appendChild(card);
    }
    return wrapper;
};

const filesView = (data: AnalysisResult): HTMLElement => {
    const wrapper = el("div", "files");
    const toolbar = el("div", "toolbar");
    const search = document.createElement("input");
    search.className = "filter";
    search.placeholder = "过滤文件 / 包名…";
    search.value = fileFilter;
    toolbar.appendChild(search);
    toolbar.appendChild(el("div", "toolbar-hint", "每条边记录依赖类型与行号"));
    wrapper.appendChild(toolbar);

    const list = el("div", "file-list");
    wrapper.appendChild(list);

    const draw = () => {
        fileFilter = search.value;
        const needle = fileFilter.trim().toLowerCase();
        list.innerHTML = "";
        const files = data.files.filter((file) => {
            if (!needle) return true;
            return `${file.path} ${file.packageName} ${file.moduleId ?? ""}`
                .toLowerCase()
                .includes(needle);
        });
        if (files.length === 0) {
            list.appendChild(el("div", "empty", "没有匹配的文件"));
            return;
        }
        for (const file of files) list.appendChild(fileCard(file));
    };
    search.addEventListener("input", draw);
    draw();
    return wrapper;
};

const fileCard = (file: FileAnalysis): HTMLElement => {
    const details = document.createElement("details");
    details.className = "file-card";
    const summary = document.createElement("summary");
    const title = el("div", "file-title");
    title.appendChild(el("span", `lang lang-${file.language}`, file.language));
    title.appendChild(el("code", "", file.path));
    const meta = el("div", "file-meta");
    meta.append(
        el("span", "pill muted", file.moduleId ?? "unassigned"),
        el("span", "pill muted", `${file.dependencies.length} deps`),
        el("span", "pill muted", `${file.calls} calls`),
    );
    title.appendChild(meta);
    summary.appendChild(title);
    details.appendChild(summary);

    if (file.packageName)
        details.appendChild(el("div", "file-package", `package ${file.packageName}`));
    if (file.dependencies.length === 0) {
        details.appendChild(el("div", "empty small", "没有解析到项目内依赖"));
    } else {
        const table = el("div", "dep-table");
        for (const dependency of file.dependencies) {
            const row = el("div", "dep-row");
            row.appendChild(el("code", "dep-target", dependency.to));
            const kinds = el("div", "kind-list");
            for (const kind of dependency.kinds)
                kinds.appendChild(el("span", `kind kind-${kind}`, kind));
            row.appendChild(kinds);
            if (dependency.lines.length > 0) {
                row.appendChild(
                    el(
                        "span",
                        "line-list",
                        `L${dependency.lines.slice(0, 8).join(", ")}${dependency.lines.length > 8 ? "…" : ""}`,
                    ),
                );
            }
            table.appendChild(row);
        }
        details.appendChild(table);
    }
    return details;
};

const jsonView = (data: AnalyzeResponse): HTMLElement => {
    const wrapper = el("div", "json-view");
    const toolbar = el("div", "toolbar");
    const download = document.createElement("button");
    download.className = "primary small";
    download.textContent = "下载 JSON";
    download.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "feign-trace.json";
        anchor.click();
        URL.revokeObjectURL(url);
    });
    toolbar.appendChild(download);
    const dbHint = data.dbPath
        ? ` · SQLite ${data.dbPath} (${formatBytes(data.dbBytes ?? 0)})`
        : "";
    toolbar.appendChild(
        el("div", "toolbar-hint", `${(JSON.stringify(data).length / 1024).toFixed(1)} KB${dbHint}`),
    );
    wrapper.appendChild(toolbar);
    const pre = document.createElement("pre");
    pre.className = "json-pre";
    pre.textContent = JSON.stringify(data, null, 2);
    wrapper.appendChild(pre);
    return wrapper;
};

const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = "",
    text = "",
): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
};

const splitFilters = (value: string): string[] => {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const escapeHtml = (value: string): string => {
    return value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        };
        return entities[character];
    });
};
