import type { DbColumn, DbRows, DbSchema, DbTable } from "../src/store/db-admin.ts";
import "./search-select.ts";

interface FieldEditor {
    readonly column: DbColumn;
    readonly input: HTMLInputElement | HTMLTextAreaElement;
    readonly include?: HTMLInputElement;
    readonly useNull?: HTMLInputElement;
}

interface EditingState {
    readonly mode: "create" | "edit";
    readonly row?: Readonly<Record<string, unknown>>;
}

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isDbColumn = (value: unknown): value is DbColumn => {
    if (!isRecord(value)) return false;
    return (
        typeof value.name === "string" &&
        typeof value.type === "string" &&
        typeof value.notNull === "boolean" &&
        (value.defaultValue === undefined || typeof value.defaultValue === "string") &&
        typeof value.pk === "number"
    );
};

const isDbTable = (value: unknown): value is DbTable => {
    if (!isRecord(value)) return false;
    return (
        typeof value.name === "string" &&
        (value.kind === "table" || value.kind === "view") &&
        Array.isArray(value.columns) &&
        value.columns.every(isDbColumn) &&
        Array.isArray(value.primaryKey) &&
        value.primaryKey.every((item) => typeof item === "string") &&
        typeof value.hasRowid === "boolean" &&
        typeof value.rowCount === "number"
    );
};

const isDbSchema = (value: unknown): value is DbSchema => {
    if (!isRecord(value)) return false;
    return (
        typeof value.path === "string" &&
        Array.isArray(value.tables) &&
        value.tables.every(isDbTable)
    );
};

const isDbRows = (value: unknown): value is DbRows => {
    if (!isRecord(value)) return false;
    return (
        isDbTable(value.table) &&
        Array.isArray(value.rows) &&
        value.rows.every(isRecord) &&
        typeof value.total === "number" &&
        typeof value.limit === "number" &&
        typeof value.offset === "number"
    );
};

const errorMessage = (value: unknown): string =>
    isRecord(value) && typeof value.error === "string" ? value.error : "";

const fetchJson = async (url: string, init?: RequestInit): Promise<unknown> => {
    const response = await fetch(url, init);
    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        payload = undefined;
    }
    if (!response.ok) {
        const detail = errorMessage(payload);
        throw new Error(detail || `HTTP ${response.status}`);
    }
    return payload;
};

const formatCell = (value: unknown): string => {
    if (value === null) return "NULL";
    if (value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
        return JSON.stringify(value) ?? "";
    } catch {
        return String(value);
    }
};

const isLongValue = (value: unknown): value is string =>
    typeof value === "string" && value.length > 120;

const rowKey = (
    table: DbTable,
    row: Readonly<Record<string, unknown>>,
): Record<string, unknown> | undefined => {
    const keys =
        table.primaryKey.length > 0
            ? table.primaryKey
            : table.hasRowid
              ? (["__rowid"] as const)
              : [];
    if (keys.length === 0) return undefined;
    const result: Record<string, unknown> = {};
    for (const key of keys) {
        if (!(key in row)) return undefined;
        result[key] = row[key];
    }
    return result;
};

/** 数据库浏览页：按表生成 tab，支持分页查看和单行增删改。 */
export const mountDatabasePage = (container: HTMLElement, initialPath: string): void => {
    let dbPath = initialPath.trim() || "feign-trace.db";
    let schema: DbSchema | undefined;
    let activeTable = "";
    let rows: DbRows | undefined;
    let limit = 100;
    let offset = 0;
    let editing: EditingState | undefined;
    let editors: FieldEditor[] = [];

    container.innerHTML = `
      <section class="panel db-page">
        <div class="db-toolbar">
          <label class="db-field">
            <span>数据库路径</span>
            <input id="dbBrowsePath" type="text" spellcheck="false" />
          </label>
          <button id="dbBrowseLoad" class="primary small">加载数据库</button>
          <span class="db-status" id="dbBrowseStatus">就绪</span>
        </div>
        <div class="db-tabs" id="dbTabs"></div>
        <div class="db-table-meta" id="dbTableMeta"></div>
        <div id="dbEditor"></div>
        <div class="db-table-host" id="dbTableHost"></div>
        <div class="db-pager" id="dbPager"></div>
      </section>
    `;

    const pathInput = container.querySelector<HTMLInputElement>("#dbBrowsePath");
    const loadButton = container.querySelector<HTMLButtonElement>("#dbBrowseLoad");
    const statusEl = container.querySelector<HTMLSpanElement>("#dbBrowseStatus");
    const tabsEl = container.querySelector<HTMLDivElement>("#dbTabs");
    const metaEl = container.querySelector<HTMLDivElement>("#dbTableMeta");
    const editorEl = container.querySelector<HTMLDivElement>("#dbEditor");
    const tableEl = container.querySelector<HTMLDivElement>("#dbTableHost");
    const pagerEl = container.querySelector<HTMLDivElement>("#dbPager");
    if (
        !pathInput ||
        !loadButton ||
        !statusEl ||
        !tabsEl ||
        !metaEl ||
        !editorEl ||
        !tableEl ||
        !pagerEl
    ) {
        throw new Error("数据库页面结构不完整");
    }

    pathInput.value = dbPath;

    const setStatus = (text: string, error = false): void => {
        statusEl.textContent = text;
        statusEl.classList.toggle("error", error);
    };

    const currentTable = (): DbTable | undefined =>
        schema?.tables.find((table) => table.name === activeTable);

    const reload = async (): Promise<void> => {
        const requested = pathInput.value.trim() || "feign-trace.db";
        setStatus("加载数据库中…");
        loadButton.disabled = true;
        try {
            const payload = await fetchJson(`/api/db/schema?path=${encodeURIComponent(requested)}`);
            if (!isDbSchema(payload)) throw new Error("服务端返回了无法识别的数据库结构");
            schema = payload;
            dbPath = payload.path;
            pathInput.value = payload.path;
            if (!schema.tables.some((table) => table.name === activeTable)) {
                activeTable = schema.tables[0]?.name ?? "";
                offset = 0;
            }
            editing = undefined;
            renderEditor();
            renderTabs();
            await loadRows();
            setStatus(`已加载 ${schema.tables.length} 个表 / 视图`);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error), true);
        } finally {
            loadButton.disabled = false;
        }
    };

    const loadRows = async (): Promise<void> => {
        const table = currentTable();
        if (!table) {
            tableEl.innerHTML = `<div class="empty">没有可显示的表</div>`;
            pagerEl.innerHTML = "";
            return;
        }
        const payload = await fetchJson(
            `/api/db/rows?path=${encodeURIComponent(dbPath)}&table=${encodeURIComponent(
                table.name,
            )}&limit=${limit}&offset=${offset}`,
        );
        if (!isDbRows(payload)) throw new Error("服务端返回了无法识别的表数据");
        rows = payload;
        offset = payload.offset;
        renderTable();
        renderPager();
    };

    const renderTabs = (): void => {
        tabsEl.innerHTML = "";
        if (!schema) return;
        for (const table of schema.tables) {
            const button = el(
                "button",
                `db-tab${table.name === activeTable ? " active" : ""}${
                    table.kind === "view" ? " readonly" : ""
                }`,
            );
            button.appendChild(el("span", "db-tab-name", table.name));
            button.appendChild(el("span", "db-tab-count", String(table.rowCount)));
            button.title = `${table.kind === "view" ? "只读视图" : "表"} · ${table.rowCount} 行`;
            button.addEventListener("click", () => {
                activeTable = table.name;
                offset = 0;
                editing = undefined;
                renderEditor();
                renderTabs();
                void loadRows().catch((error: unknown) => {
                    setStatus(error instanceof Error ? error.message : String(error), true);
                });
            });
            tabsEl.appendChild(button);
        }
        if (schema.tables.length === 0)
            tabsEl.appendChild(el("div", "empty small", "数据库中没有表"));
        renderMeta();
    };

    const renderMeta = (): void => {
        metaEl.innerHTML = "";
        const table = currentTable();
        if (!table) return;
        const head = el("div", "db-table-head");
        head.appendChild(el("strong", "", table.name));
        head.appendChild(el("span", "pill muted", `${table.rowCount} 行`));
        head.appendChild(
            el(
                "span",
                `badge badge-${table.kind === "view" ? "remote" : "controller"}`,
                table.kind === "view" ? "view · 只读" : "table",
            ),
        );
        if (table.primaryKey.length > 0) {
            head.appendChild(el("span", "pill muted", `PK: ${table.primaryKey.join(", ")}`));
        } else if (table.hasRowid) {
            head.appendChild(el("span", "pill muted", "无主键 · 使用 rowid 定位"));
        }
        if (table.kind === "table") {
            const add = el("button", "primary small", "新增行");
            add.addEventListener("click", () => {
                editing = { mode: "create" };
                renderEditor();
            });
            head.appendChild(add);
        }
        metaEl.appendChild(head);
    };

    const renderEditor = (): void => {
        editorEl.innerHTML = "";
        editors = [];
        const table = currentTable();
        if (!editing || !table || table.kind === "view") return;

        const form = document.createElement("form");
        form.className = "db-editor-panel";
        const title = el(
            "div",
            "db-editor-title",
            editing.mode === "create" ? `新增行 · ${table.name}` : `编辑行 · ${table.name}`,
        );
        form.appendChild(title);

        const grid = el("div", "db-edit-grid");
        for (const column of table.columns) {
            const field = el("label", "db-edit-field");
            const label = el("span", "db-field-label", column.name);
            label.title = `${column.type || "TEXT"}${column.pk > 0 ? " · PRIMARY KEY" : ""}${
                column.notNull ? " · NOT NULL" : ""
            }`;
            field.appendChild(label);

            const value = editing.row?.[column.name];
            const long = isLongValue(value);
            const input = long
                ? document.createElement("textarea")
                : document.createElement("input");
            if (input instanceof HTMLTextAreaElement) input.rows = 4;
            input.className = "db-edit-input";
            input.value = value === null || value === undefined ? "" : formatCell(value);
            input.disabled = editing.mode === "edit" && column.pk > 0;

            const options = el("span", "db-edit-options");
            let include: HTMLInputElement | undefined;
            if (editing.mode === "create") {
                include = document.createElement("input");
                include.type = "checkbox";
                include.checked = column.pk === 0;
                const includeLabel = el("label", "db-inline-check");
                includeLabel.append(include, document.createTextNode("写入"));
                options.appendChild(includeLabel);
            }

            let useNull: HTMLInputElement | undefined;
            if (!column.notNull) {
                useNull = document.createElement("input");
                useNull.type = "checkbox";
                useNull.checked = editing.mode === "edit" && value === null;
                const nullLabel = el("label", "db-inline-check");
                nullLabel.append(useNull, document.createTextNode("NULL"));
                options.appendChild(nullLabel);
            }

            field.append(input, options);
            grid.appendChild(field);
            editors.push({ column, input, include, useNull });
        }
        form.appendChild(grid);

        const actions = el("div", "db-editor-actions");
        const save = el("button", "primary small", "保存");
        save.type = "submit";
        const cancel = el("button", "secondary small", "取消");
        cancel.type = "button";
        cancel.addEventListener("click", () => {
            editing = undefined;
            renderEditor();
        });
        actions.append(save, cancel);
        form.appendChild(actions);
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            void saveEditing();
        });
        editorEl.appendChild(form);
        editorEl.scrollIntoView({ block: "nearest" });
    };

    const saveEditing = async (): Promise<void> => {
        const table = currentTable();
        if (!editing || !table) return;
        const values: Record<string, unknown> = {};
        for (const editor of editors) {
            if (editing.mode === "create" && editor.include && !editor.include.checked) continue;
            if (editing.mode === "edit" && editor.column.pk > 0) continue;
            values[editor.column.name] = editor.useNull?.checked ? null : editor.input.value;
        }

        try {
            if (editing.mode === "create") {
                await fetchJson("/api/db/rows", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path: dbPath, table: table.name, values }),
                });
            } else {
                const where = editing.row ? rowKey(table, editing.row) : undefined;
                if (!where) throw new Error("当前行没有可用于更新的主键");
                await fetchJson("/api/db/rows", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path: dbPath, table: table.name, where, values }),
                });
            }
            editing = undefined;
            renderEditor();
            await reload();
        } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error), true);
        }
    };

    const renderTable = (): void => {
        tableEl.innerHTML = "";
        const table = currentTable();
        if (!table || !rows) return;
        if (rows.rows.length === 0) {
            tableEl.appendChild(el("div", "empty", "暂无数据"));
            return;
        }

        const tableNode = document.createElement("table");
        tableNode.className = "db-table";
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        const showRowid = table.primaryKey.length === 0 && table.hasRowid;
        const columns = showRowid
            ? [
                  {
                      name: "__rowid",
                      type: "INTEGER",
                      notNull: true,
                      defaultValue: undefined,
                      pk: 0,
                  },
                  ...table.columns,
              ]
            : table.columns;
        for (const column of columns) {
            const th = document.createElement("th");
            th.textContent = column.name === "__rowid" ? "rowid" : column.name;
            if (column !== undefined && "pk" in column && column.pk > 0) {
                th.classList.add("pk");
                th.title = "主键";
            }
            headRow.appendChild(th);
        }
        const hasActions =
            table.kind === "table" && (table.primaryKey.length > 0 || table.hasRowid);
        if (hasActions) headRow.appendChild(el("th", "db-actions-head", "操作"));
        thead.appendChild(headRow);
        tableNode.appendChild(thead);

        const tbody = document.createElement("tbody");
        for (const row of rows.rows) {
            const tr = document.createElement("tr");
            for (const column of columns) {
                const value = row[column.name];
                const td = document.createElement("td");
                td.textContent = formatCell(value);
                if (value === null) td.classList.add("db-null");
                if (isLongValue(value)) {
                    td.classList.add("db-long");
                    td.title = value.slice(0, 500);
                }
                tr.appendChild(td);
            }
            if (hasActions) {
                const actions = document.createElement("td");
                actions.className = "db-row-actions";
                const edit = el("button", "secondary small", "编辑");
                edit.addEventListener("click", () => {
                    editing = { mode: "edit", row };
                    renderEditor();
                });
                const remove = el("button", "danger small", "删除");
                remove.addEventListener("click", () => {
                    const where = rowKey(table, row);
                    if (!where) return;
                    if (!window.confirm(`删除 ${table.name} 中的这一行？`)) return;
                    void fetchJson("/api/db/rows", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ path: dbPath, table: table.name, where }),
                    })
                        .then(() => reload())
                        .catch((error: unknown) => {
                            setStatus(error instanceof Error ? error.message : String(error), true);
                        });
                });
                actions.append(edit, remove);
                tr.appendChild(actions);
            }
            tbody.appendChild(tr);
        }
        tableNode.appendChild(tbody);
        tableEl.appendChild(tableNode);
    };

    const renderPager = (): void => {
        pagerEl.innerHTML = "";
        if (!rows) return;
        const pages = Math.max(1, Math.ceil(rows.total / rows.limit));
        const page = Math.floor(rows.offset / rows.limit) + 1;

        const size = document.createElement("ft-select");
        size.className = "db-page-size";
        size.filterable = false;
        size.placeholder = "行/页";
        size.setOptions(
            [50, 100, 200, 500].map((value) => ({
                value: String(value),
                label: `${value} 行/页`,
            })),
        );
        size.value = String(limit);
        size.addEventListener("change", () => {
            limit = Number(size.value) || 100;
            offset = 0;
            void loadRows().catch((error: unknown) => {
                setStatus(error instanceof Error ? error.message : String(error), true);
            });
        });

        const prev = el("button", "secondary small", "上一页");
        prev.disabled = rows.offset <= 0;
        prev.addEventListener("click", () => {
            offset = Math.max(0, rows ? rows.offset - rows.limit : 0);
            void loadRows().catch((error: unknown) => {
                setStatus(error instanceof Error ? error.message : String(error), true);
            });
        });
        const next = el("button", "secondary small", "下一页");
        next.disabled = rows.offset + rows.limit >= rows.total;
        next.addEventListener("click", () => {
            offset = rows ? rows.offset + rows.limit : 0;
            void loadRows().catch((error: unknown) => {
                setStatus(error instanceof Error ? error.message : String(error), true);
            });
        });

        pagerEl.append(
            size,
            el("span", "db-page-info", `第 ${page} / ${pages} 页 · 共 ${rows.total} 行`),
            prev,
            next,
        );
    };

    loadButton.addEventListener("click", () => void reload());
    pathInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") void reload();
    });
    void reload();
};
