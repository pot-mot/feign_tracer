# AGENTS.md

本文件是本仓库的编码规范与协作约定。所有人工维护的 TypeScript 代码都必须遵守；自动生成代码按文末例外处理。

## 类型系统

### 严格类型

- 禁止使用 `any`。无法确定类型时使用 `unknown`，并在边界处通过类型守卫收窄。
- `tsconfig.json` 必须启用：
  - `strict`
  - `noUnusedLocals`
  - `noUnusedParameters`
  - `erasableSyntaxOnly`
  - `verbatimModuleSyntax`
- 不允许用 `@ts-ignore` 绕过错误；确需抑制时使用带说明的 `@ts-expect-error`。
- 非空断言 `!` 仅限外部 API 已保证、且无法用控制流表达的场景；优先改为显式判空。

### `null` / `undefined`

- 优先使用 `undefined` 表示“没有值”。
- 严格区分 `null` 与 `undefined`，禁止 `==` / `!=`，一律使用 `===` / `!==`。
- SQLite 驱动等外部边界必须使用 `null`（SQL NULL）时，只在持久化层使用；进入业务层前转换为 `undefined`。
- 可选属性使用 `?:`，不要写成 `| null`。

### `readonly` 与不可变数据

- 尽可能使用 `const` 声明常量与函数。
- 不需要重新赋值的接口属性使用 `readonly`。
- 对外返回的分析结果、配置和常量集合优先使用只读视图。
- 深层只读使用统一的 `DeepReadonly<T>`：

```ts
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
    ? T
    : T extends ReadonlyArray<infer U>
      ? ReadonlyArray<DeepReadonly<U>>
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;
```

### 禁止不安全类型断言

严禁 `as any`、`as unknown as Xxx` 等旁路类型系统的转换。安全的 `as` 仅限：

- `as const` 常量断言；
- DOM 事件目标窄化，如 `e.target as HTMLElement`、`e.target as Node`；
- material / 第三方实例窄化，且必须配合 `instanceof` 守卫；
- `JSON.parse()` 返回 `as unknown`，随后必须交给校验层；
- 判别式 Map 访问：当 `Map<Key, BaseType>` 运行时保存不同子类型时，用 `Record<Key, SubType>` 集中窄化。

```ts
type SourceMap = {
    type_a: ContextA;
    type_b: ContextB;
};

const getSource = <K extends KeyType>(key: K): SourceMap[K] | undefined =>
    map.get(key) as SourceMap[K] | undefined;
```

### 两阶段初始化

禁止用 `undefined as unknown as Xxx` 在对象字面量中占位再覆盖。工厂函数无法一次性构造完整对象时，返回 `Omit<FullType, "panel">`，由调用方组装：

```ts
const partial = createPartial();
const full: FullType = { ...partial, panel: createPanel(partial) };
```

### 枚举

禁止 `enum`。使用 `as const` 常量数组 + 索引类型，保证运行时可以取值：

```ts
const ENUM_TYPE_CONSTANTS = ["A", "B"] as const;
type EnumType = (typeof ENUM_TYPE_CONSTANTS)[number];
```

## 代码风格

### 缩进

- 统一使用 4 个空格，不使用 Tab。
- 由 Prettier 统一格式化（`tabWidth: 4`）。

### 函数

- 拒绝非必要的 `class`、`function` 声明与 `this`。
- 尽可能使用 `const` 箭头函数，包括导出函数：

```ts
export const analyzeDirectory = (
    input: AnalyzeInput,
): DeepReadonly<AnalysisResult> => {
    // ...
};
```

- 仅以下场景保留 `class`：
  - 必须继承第三方基类（如 ANTLR `BaseErrorListener`）；
  - 第三方框架强制要求（如 Vite 配置）。
- 递归函数使用 `const` 箭头函数时，必须保证首次调用发生在初始化之后。

### 注释

- 所有注释必须使用中文。
- 注释解释“为什么”，不重复代码表面含义。
- 公共 API、复杂算法、外部格式兼容逻辑必须有中文说明。
- 自动生成文件中的英文注释不在此规范范围内。

## Import / Export

- 类型专用导入必须使用 `import type`；同模块同时需要值和类型时使用内联修饰符：

```ts
import { Value, type SomeType } from "./module.ts";
```

- 类型名冲突时使用别名：

```ts
import type { Material as ThreeMaterial } from "three";
```

- 相对导入必须包含 `.ts` 扩展名；只有 `xxx/index.ts` 可以省略为目录路径：

```ts
import { analyzeDirectory } from "./analyze.ts";
import { createProjectIndex } from "./graph/index.ts";
```

- 禁止 `export default`，全部使用命名导出。
- 唯一例外：`vite.config.ts` 的框架入口必须 `export default defineConfig(...)`；不得把该例外扩散到其他文件。

## 项目结构约定

- `src/generated/**`：ANTLR 自动生成代码，不手工修改、不参与风格审查，文件头保留 `// @ts-nocheck`。
- `src/graph/**`：调用链、端点、类型索引与解析逻辑。
- `src/languages/**`：Java / Kotlin / Groovy 源码提取。
- `src/store/sqlite.ts`：SQLite 持久化与增量合并；允许在绑定参数处使用 SQL `null`。
- `web/main.ts`：浏览器端 UI，禁止依赖 Node.js API。
- `examples/**`：可运行的验证样例。

## 测试与验收

提交前必须执行：

```bash
npm run typecheck
npm run format
npm test
npm run test:cycles
npm run build
```

验收要求：

- 类型检查零错误；
- `examples/shop` 能生成端点树、Feign 远程调用链与 SQLite 数据库；
- `examples/cycles` 能展开两个接口实现，并在递归节点标记 `cyclic: true`；
- Web UI 的搜索条件按“端点关键词 + 精确类名 + 精确函数名”AND 过滤；
- 增量构建后未选中的端点树和方法链仍然保留。

## 例外与边界

- ANTLR 生成的 Lexer/Parser/Listener 代码属于工具产物，允许不符合本规范。
- `vite.config.ts` 的默认导出是 Vite 的硬性入口约定。
- SQLite 驱动返回 `null`、绑定 SQL NULL 属外部协议，不视为违反 `undefined` 优先原则。
- 第三方库类型缺失时，优先通过本地声明文件补全；不得用 `any` 或双重断言绕过。
