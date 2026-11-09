export interface SelectOption {
    readonly value: string;
    readonly label: string;
}

const normalizeOption = (option: string | SelectOption): SelectOption =>
    typeof option === "string" ? { value: option, label: option } : option;

/**
 * 自绘可搜索下拉输入框（类似 el-select filterable）。
 *
 * 输入框本身就是搜索框：聚焦后输入文字直接过滤选项，可点击候选项，
 * 也可以直接保留手输内容；不再依赖原生 select，也不再需要额外的输入框。
 */
export class SearchSelectElement extends HTMLElement {
    private optionsList: SelectOption[] = [];
    private selectedValue = "";
    private filteredOptions: SelectOption[] = [];
    private highlighted = -1;
    private openState = false;
    private keyboardNavigated = false;
    private lastCommitted = "";
    /** 弹层过滤词；输入框显示值在选中后可能与过滤词不同。 */
    private query = "";
    private readonly input: HTMLInputElement;
    private readonly clearButton: HTMLButtonElement;
    private readonly popup: HTMLDivElement;
    private readonly list: HTMLDivElement;
    private readonly empty: HTMLDivElement;

    constructor() {
        super();
        const root = this.attachShadow({ mode: "open" });
        root.innerHTML = `
          <style>
            :host {
              position: relative;
              display: inline-block;
              min-width: 0;
              color: var(--text, #e6ecf7);
              font: inherit;
            }
            :host([hidden]) { display: none; }
            .control {
              display: flex;
              align-items: center;
              width: 100%;
              min-height: 34px;
              border: 1px solid var(--border, #242c3d);
              border-radius: 9px;
              background: rgba(8, 12, 20, 0.8);
            }
            .control:hover, :host(.open) .control {
              border-color: var(--accent, #5aa7ff);
            }
            .input {
              flex: 1;
              min-width: 0;
              padding: 7px 10px;
              border: 0;
              background: transparent;
              color: inherit;
              font: inherit;
              font-size: 12.5px;
              outline: none;
            }
            .input::placeholder { color: var(--text-faint, #6f7a8f); }
            .input:disabled { opacity: 0.55; cursor: not-allowed; }
            .clear, .chevron {
              flex: 0 0 auto;
              border: 0;
              background: transparent;
              color: var(--text-faint, #6f7a8f);
              cursor: pointer;
              padding: 0 6px;
              font: inherit;
            }
            .clear:hover, .chevron:hover { color: var(--text, #e6ecf7); }
            .clear { font-size: 15px; line-height: 1; }
            .chevron { font-size: 10px; padding-right: 9px; }
            .clear[hidden] { display: none; }
            .popup {
              position: absolute;
              z-index: 60;
              left: 0;
              right: auto;
              top: calc(100% + 6px);
              bottom: auto;
              min-width: 240px;
              max-width: calc(100vw - 16px);
              max-height: 300px;
              display: flex;
              flex-direction: column;
              padding: 6px;
              border: 1px solid var(--border, #242c3d);
              border-radius: 10px;
              background: #111827;
              box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
            }
            :host([data-placement="top"]) .popup {
              top: auto;
              bottom: calc(100% + 6px);
            }
            :host([data-align="end"]) .popup {
              left: auto;
              right: 0;
            }
            .popup[hidden] { display: none; }
            .list { overflow: auto; min-height: 0; }
            .option {
              display: block;
              width: 100%;
              padding: 7px 9px;
              border: 0;
              border-radius: 7px;
              background: transparent;
              color: var(--text-dim, #95a0b5);
              font: inherit;
              font-size: 12.5px;
              text-align: left;
              cursor: pointer;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .option:hover, .option.highlighted {
              color: var(--text, #e6ecf7);
              background: rgba(90, 167, 255, 0.16);
            }
            .option.selected { color: var(--text, #e6ecf7); font-weight: 600; }
            .empty {
              padding: 10px 8px;
              color: var(--text-faint, #6f7a8f);
              font-size: 12px;
            }
            .empty[hidden] { display: none; }
          </style>
          <div class="control" part="control">
            <input class="input" part="input" spellcheck="false" autocomplete="off" />
            <button class="clear" part="clear" type="button" title="清空" hidden>×</button>
            <button class="chevron" type="button" tabindex="-1">▾</button>
          </div>
          <div class="popup" hidden part="popup">
            <div class="list" role="listbox"></div>
            <div class="empty" hidden>没有匹配项，可直接使用输入内容</div>
          </div>
        `;

        const control = root.querySelector<HTMLDivElement>(".control");
        const input = root.querySelector<HTMLInputElement>(".input");
        const clear = root.querySelector<HTMLButtonElement>(".clear");
        const chevron = root.querySelector<HTMLButtonElement>(".chevron");
        const popup = root.querySelector<HTMLDivElement>(".popup");
        const list = root.querySelector<HTMLDivElement>(".list");
        const empty = root.querySelector<HTMLDivElement>(".empty");
        if (!control || !input || !clear || !chevron || !popup || !list || !empty) {
            throw new Error("SearchSelect 结构不完整");
        }
        this.input = input;
        this.clearButton = clear;
        this.popup = popup;
        this.list = list;
        this.empty = empty;

        control.addEventListener("click", () => {
            if (this.disabled) return;
            this.open();
            this.input.focus();
        });
        input.addEventListener("focus", () => this.open());
        input.addEventListener("input", () => {
            const query = input.value;
            // 选中后继续输入时弹层可能已关闭，先重新打开再应用过滤词。
            if (!this.openState) this.open();
            this.selectedValue = "";
            this.query = query;
            this.keyboardNavigated = false;
            this.renderOptions();
            this.syncClear();
            this.dispatchEvent(
                new CustomEvent("input", {
                    bubbles: true,
                    composed: true,
                    detail: { query },
                }),
            );
        });
        input.addEventListener("keydown", (event) => this.onInputKeydown(event));
        input.addEventListener("blur", () => {
            // 延迟关闭，让候选项的点击/选择先完成。
            window.setTimeout(() => {
                if (!this.openState) return;
                this.commit();
            }, 120);
        });
        clear.addEventListener("click", (event) => {
            event.stopPropagation();
            this.setValue("");
            this.dispatchChange();
            if (this.filterable) this.input.focus();
        });
        chevron.addEventListener("click", (event) => {
            event.stopPropagation();
            if (this.openState) this.close();
            else this.open();
        });
        this.list.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const option = target.closest<HTMLElement>(".option");
            if (option) this.choose(option.dataset.value ?? "");
        });
    }

    connectedCallback(): void {
        document.addEventListener("pointerdown", this.onDocumentPointerDown);
        window.addEventListener("resize", this.onViewportChange);
        window.addEventListener("scroll", this.onViewportChange, true);
        this.input.placeholder = this.placeholder;
        this.input.readOnly = !this.filterable;
        this.input.disabled = this.disabled;
        this.render();
    }

    disconnectedCallback(): void {
        document.removeEventListener("pointerdown", this.onDocumentPointerDown);
        window.removeEventListener("resize", this.onViewportChange);
        window.removeEventListener("scroll", this.onViewportChange, true);
        this.close();
    }

    private readonly onDocumentPointerDown = (event: PointerEvent): void => {
        if (event.composedPath().includes(this)) return;
        this.commit();
    };

    private readonly onViewportChange = (): void => {
        if (this.openState) this.updatePlacement();
    };

    get options(): readonly SelectOption[] {
        return this.optionsList;
    }

    /** 有选中项时返回 option.value；手输内容直接返回值本身。 */
    get value(): string {
        return this.selectedValue || this.input.value;
    }

    set value(value: string) {
        this.setValue(value);
    }

    get placeholder(): string {
        return this.getAttribute("placeholder") ?? "请选择或输入";
    }

    set placeholder(value: string) {
        this.setAttribute("placeholder", value);
        this.input.placeholder = value;
    }

    get filterable(): boolean {
        return !this.hasAttribute("no-filter");
    }

    set filterable(value: boolean) {
        if (value) this.removeAttribute("no-filter");
        else this.setAttribute("no-filter", "");
        this.input.readOnly = !value;
    }

    get disabled(): boolean {
        return this.hasAttribute("disabled");
    }

    set disabled(value: boolean) {
        if (value) this.setAttribute("disabled", "");
        else this.removeAttribute("disabled");
        this.input.disabled = value;
        if (value) this.close();
    }

    /** 只更新候选列表，不覆盖用户正在输入的内容。 */
    setOptions(options: readonly (string | SelectOption)[]): void {
        this.optionsList = options.map(normalizeOption);
        this.renderOptions();
    }

    open(): void {
        if (this.disabled || this.openState) return;
        this.openState = true;
        this.classList.add("open");
        this.popup.hidden = false;
        // 重新打开时展示完整候选；输入时再写入过滤词。
        this.query = "";
        this.renderOptions();
        this.dispatchEvent(new CustomEvent("open", { bubbles: true, composed: true }));
    }

    close(): void {
        if (!this.openState) return;
        this.openState = false;
        this.classList.remove("open");
        this.popup.hidden = true;
        this.highlighted = -1;
        this.keyboardNavigated = false;
    }

    private setValue(value: string): void {
        const option = this.optionsList.find(
            (candidate) => candidate.value === value || candidate.label === value,
        );
        this.selectedValue = option?.value ?? "";
        this.input.value = option?.label ?? value;
        this.query = "";
        this.lastCommitted = this.value;
        this.renderOptions();
        this.syncClear();
    }

    private choose(value: string): void {
        const option = this.optionsList.find((candidate) => candidate.value === value);
        if (!option) return;
        this.selectedValue = option.value;
        this.input.value = option.label;
        this.query = "";
        this.lastCommitted = option.value;
        this.syncClear();
        this.renderOptions();
        this.close();
        this.input.focus();
        this.dispatchChange();
    }

    private commit(): void {
        this.close();
        const value = this.value;
        if (value !== this.lastCommitted) {
            this.lastCommitted = value;
            this.dispatchChange();
        }
    }

    private dispatchChange(): void {
        this.dispatchEvent(
            new CustomEvent("change", {
                bubbles: true,
                composed: true,
                detail: { value: this.value },
            }),
        );
    }

    private syncClear(): void {
        this.clearButton.hidden = !this.filterable || this.input.value.length === 0;
    }

    private render(): void {
        this.input.value = this.selectedValue || this.input.value;
        this.renderOptions();
        this.syncClear();
    }

    private renderOptions(): void {
        const query = this.query.trim().toLowerCase();
        this.filteredOptions = this.optionsList.filter((option) => {
            if (!query) return true;
            return (
                option.label.toLowerCase().includes(query) ||
                option.value.toLowerCase().includes(query)
            );
        });
        this.highlighted = this.filteredOptions.length > 0 ? 0 : -1;
        this.list.replaceChildren();
        for (const option of this.filteredOptions) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "option";
            button.dataset.value = option.value;
            button.textContent = option.label;
            button.title = option.label;
            button.setAttribute("role", "option");
            if (option.value === this.selectedValue) button.classList.add("selected");
            this.list.appendChild(button);
        }
        this.empty.hidden = this.filteredOptions.length > 0;
        this.applyHighlight();
        if (this.openState) this.updatePlacement();
    }

    /** 根据可视区域选择展开方向：优先下侧、向右展开。 */
    private updatePlacement(): void {
        if (!this.openState) return;
        this.popup.style.maxHeight = "";
        const host = this.getBoundingClientRect();
        const popup = this.popup.getBoundingClientRect();
        const gap = 6;
        const margin = 8;
        const spaceBelow = window.innerHeight - host.bottom - gap - margin;
        const spaceAbove = host.top - gap - margin;
        const placeTop = popup.height > spaceBelow && spaceAbove > spaceBelow;
        this.dataset.placement = placeTop ? "top" : "bottom";

        const verticalSpace = placeTop ? spaceAbove : spaceBelow;
        if (popup.height > verticalSpace) {
            this.popup.style.maxHeight = `${Math.max(80, Math.floor(verticalSpace))}px`;
        }

        const spaceRight = window.innerWidth - host.left - margin;
        const spaceLeft = host.right - margin;
        const alignEnd = popup.width > spaceRight && spaceLeft > spaceRight;
        this.dataset.align = alignEnd ? "end" : "start";
    }

    private applyHighlight(): void {
        const buttons = [...this.list.querySelectorAll<HTMLElement>(".option")];
        buttons.forEach((button, index) => {
            button.classList.toggle("highlighted", index === this.highlighted);
        });
        if (this.highlighted >= 0) {
            buttons[this.highlighted]?.scrollIntoView({ block: "nearest" });
        }
    }

    private onInputKeydown(event: KeyboardEvent): void {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (this.filteredOptions.length === 0) return;
            this.keyboardNavigated = true;
            const delta = event.key === "ArrowDown" ? 1 : -1;
            this.highlighted =
                (this.highlighted + delta + this.filteredOptions.length) %
                this.filteredOptions.length;
            this.applyHighlight();
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            if (!this.filterable) {
                const option = this.filteredOptions[this.highlighted] ?? this.filteredOptions[0];
                if (option) this.choose(option.value);
                return;
            }
            const exact = this.filteredOptions.find(
                (option) => option.value === this.input.value || option.label === this.input.value,
            );
            if (this.keyboardNavigated || exact) {
                const option =
                    exact ?? this.filteredOptions[this.highlighted] ?? this.filteredOptions[0];
                if (option) this.choose(option.value);
                return;
            }
            this.commit();
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            this.commit();
            this.input.focus();
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "ft-select": SearchSelectElement;
    }
}

if (!customElements.get("ft-select")) {
    customElements.define("ft-select", SearchSelectElement);
}
