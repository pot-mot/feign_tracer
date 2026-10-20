/**
 * 递归只读类型。
 *
 * 对外暴露的分析结果使用该类型，避免调用方意外修改共享数据；
 * 函数本身保留原类型，防止把可调用对象错误地映射为普通对象。
 */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
    ? T
    : T extends ReadonlyArray<infer U>
      ? ReadonlyArray<DeepReadonly<U>>
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;
