import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { join } from "node:path";
import { createProjectIndex, flattenTypes, type ProjectIndex } from "../src/graph/index.ts";
import { parseSourceFile } from "../src/languages/parse-file.ts";
import type { ModuleInfo, ParsedFile, TypeInfo } from "../src/model.ts";
import { createProject, javaPath, kotlinPath, removeDir } from "./test-utils.ts";

/**
 * 符号解析层的识别回归：`resolveType` 的优先级、导入形态、继承链、
 * 接口多实现、构造器匹配与 `kindOf` 分类。这些规则直接决定调用链连到哪里，
 * 一旦漂移，整棵树的语义就变了。
 */

const SOURCES: Readonly<Record<string, string>> = {
    [javaPath("com.acme.a", "Foo")]: `package com.acme.a;
public class Foo {
    public void a() {}
}
`,
    [javaPath("com.acme.b", "Foo")]: `package com.acme.b;
public class Foo {
    public void b() {}
}
`,
    [javaPath("com.acme.a", "SamePackage")]: `package com.acme.a;
public class SamePackage {
    private Foo foo;
    public void run() { foo.a(); }
}
`,
    [javaPath("com.acme.c", "Imported")]: `package com.acme.c;
import com.acme.b.Foo;
public class Imported {
    private Foo foo;
    public void run() { foo.b(); }
}
`,
    [javaPath("com.acme.c", "Wildcard")]: `package com.acme.c;
import com.acme.b.*;
public class Wildcard {
    private Foo foo;
    public void run() { foo.b(); }
}
`,
    [javaPath("com.acme.c", "Ambiguous")]: `package com.acme.c;
public class Ambiguous {
    private Foo foo;
}
`,
    [javaPath("com.acme.d", "ModuleScoped")]: `package com.acme.d;
public class ModuleScoped {
    private Foo foo;
}
`,
    [javaPath("com.acme.c", "Exact")]: `package com.acme.c;
public class Exact {
    private com.acme.b.Foo foo;
}
`,
    [javaPath("com.acme.c", "Statics")]: `package com.acme.c;
import static com.acme.a.Foo.a;
public class Statics {
    public void run() { a(); }
}
`,
    [javaPath("com.acme.c", "Base")]: `package com.acme.c;
public class Base {
    public void base() {}
    public void shared() {}
}
`,
    [javaPath("com.acme.c", "Mid")]: `package com.acme.c;
public class Mid extends Base {
    public void mid() {}
}
`,
    [javaPath("com.acme.c", "Leaf")]: `package com.acme.c;
public class Leaf extends Mid {
    public void leaf() {}
    @Override
    public void shared() {}
}
`,
    [javaPath("com.acme.c", "Pay")]: `package com.acme.c;
public interface Pay {
    void charge(int amount);
}
`,
    [javaPath("com.acme.c", "PayA")]: `package com.acme.c;
public class PayA implements Pay {
    @Override
    public void charge(int amount) {}
}
`,
    [javaPath("com.acme.c", "PayB")]: `package com.acme.c;
public class PayB implements Pay {
    @Override
    public void charge(int amount) {}
}
`,
    [javaPath("com.acme.c", "Outer")]: `package com.acme.c;
public class Outer {
    public static class Inner {
        public void touch() {}
    }
    public void use(Inner inner) { inner.touch(); }
}
`,
    [javaPath("com.acme.c", "WithCtor")]: `package com.acme.c;
public class WithCtor {
    public WithCtor(String a) {}
    public WithCtor(String a, int b) {}
}
`,
    [javaPath("com.acme.role", "Roles")]: `package com.acme.role;
@RestController
public class Roles {
    @FeignClient(name = "svc")
    public interface Client {}
}
`,
    [javaPath("com.acme.role", "KindOf")]: `package com.acme.role;
@RestController
public class ControllerLike {}
@FeignClient(name = "svc")
interface FeignLike {}
@Mapper
interface MapperLike {}
@Repository
interface RepoLike {}
@Service
class ServiceLike {}
@Component
class ComponentLike {}
interface PlainLike {}
`,
    [kotlinPath("com.acme.kt", "Defaults")]: `package com.acme.kt
class Defaults {
    fun greet(name: String, punctuation: String): String {
        return name + punctuation
    }
}
`,
};

const MODULE_BY_PACKAGE: Readonly<Record<string, string>> = {
    "com.acme.a": "api",
    "com.acme.b": "svc",
    "com.acme.c": "web",
    "com.acme.d": "api",
    "com.acme.role": "web",
    "com.acme.kt": "web",
};

/** `src/main/<lang>/<package>/Name.ext` 里取出包名。 */
const packageFromPath = (relPath: string): string => {
    const marker = relPath.startsWith("src/main/java/") ? "src/main/java/" : "src/main/kotlin/";
    const segments = relPath.slice(marker.length).split("/");
    return segments.slice(0, -1).join(".");
};

let index: ProjectIndex;
let workDir = "";

before(() => {
    const project = createProject("feign-tracer-resolve-", SOURCES);
    workDir = project.root;
    const modules: ModuleInfo[] = [
        {
            id: "(root)",
            name: "root",
            buildTool: "none",
            dir: "",
            dependencies: [],
            modules: [],
            fileCount: 0,
        },
        { id: "api", name: "api", buildTool: "none", dir: "api", dependencies: [], fileCount: 4 },
        { id: "svc", name: "svc", buildTool: "none", dir: "svc", dependencies: [], fileCount: 1 },
        { id: "web", name: "web", buildTool: "none", dir: "web", dependencies: [], fileCount: 8 },
    ];

    const files: ParsedFile[] = [];
    for (const relPath of Object.keys(SOURCES)) {
        const kind = relPath.endsWith(".kt") ? "kotlin" : "java";
        files.push(
            parseSourceFile({
                absPath: join(workDir, relPath),
                relPath,
                kind,
                moduleId: MODULE_BY_PACKAGE[packageFromPath(relPath)] ?? "(root)",
            }),
        );
    }
    index = createProjectIndex(files, modules);
});

after(() => {
    removeDir(workDir);
});

const typeOf = (fqn: string): TypeInfo => {
    const type = index.typesByFqn.get(fqn);
    assert.notEqual(type, undefined, `未识别出类型 ${fqn}`);
    if (!type) throw new Error(`missing ${fqn}`);
    return type;
};

const fileOf = (path: string): ParsedFile => {
    const file = index.fileByPath.get(path);
    assert.notEqual(file, undefined, `未识别出文件 ${path}`);
    if (!file) throw new Error(`missing ${path}`);
    return file;
};

test("resolveType 按「全限定名 → 同包 → 单类型导入 → 通配导入」的优先级解析", () => {
    assert.equal(
        index.resolveType("com.acme.b.Foo", undefined, undefined)?.fqn,
        "com.acme.b.Foo",
        "全限定名应精确命中",
    );
    assert.equal(
        index.resolveType("Foo", fileOf(javaPath("com.acme.a", "SamePackage")), undefined)?.fqn,
        "com.acme.a.Foo",
        "同包同名优先",
    );
    assert.equal(
        index.resolveType("Foo", fileOf(javaPath("com.acme.c", "Imported")), undefined)?.fqn,
        "com.acme.b.Foo",
        "单类型导入优先于同包之外的候选",
    );
    assert.equal(
        index.resolveType("Foo", fileOf(javaPath("com.acme.c", "Wildcard")), undefined)?.fqn,
        "com.acme.b.Foo",
        "通配导入应能解析到唯一候选",
    );
    assert.equal(
        index.resolveType("com.acme.b.Foo", fileOf(javaPath("com.acme.c", "Exact")), undefined)
            ?.fqn,
        "com.acme.b.Foo",
        "源码里写全限定名时应直接命中",
    );
});

test("resolveType 对同名歧义保持未解析，而不是随便挑一个", () => {
    const file = fileOf(javaPath("com.acme.c", "Ambiguous"));
    assert.equal(index.resolveType("Foo", file, undefined), undefined);
});

test("resolveType 用模块归属打破同名歧义", () => {
    // 两个 Foo 分属 api / svc，引用方也在 api 模块时收敛到同模块的那一个。
    const scoped = fileOf(javaPath("com.acme.d", "ModuleScoped"));
    assert.equal(index.resolveType("Foo", scoped, undefined)?.fqn, "com.acme.a.Foo");

    // 模块不同、包也不同时仍保持未解析。
    const web = fileOf(javaPath("com.acme.c", "Ambiguous"));
    assert.equal(index.resolveType("Foo", web, undefined), undefined);
});

test("嵌套类型通过宿主类型解析", () => {
    const outer = typeOf("com.acme.c.Outer");
    assert.equal(
        index.resolveType("Inner", fileOf(javaPath("com.acme.c", "Outer")), outer)?.fqn,
        "com.acme.c.Outer.Inner",
    );
    assert.deepEqual(
        flattenTypes([outer]).map((type) => type.fqn),
        ["com.acme.c.Outer", "com.acme.c.Outer.Inner"],
    );
});

test("resolveImport 识别普通导入与静态导入的宿主类型", () => {
    const statics = fileOf(javaPath("com.acme.c", "Statics"));
    const staticImport = statics.imports.find((item) => item.static);
    assert.notEqual(staticImport, undefined);
    if (!staticImport) throw new Error("静态导入未被识别");
    assert.deepEqual(
        { name: staticImport.name, static: staticImport.static, wildcard: staticImport.wildcard },
        { name: "com.acme.a.Foo.a", static: true, wildcard: false },
    );
    assert.equal(index.resolveImport(staticImport)?.fqn, "com.acme.a.Foo");

    const imported = fileOf(javaPath("com.acme.c", "Imported"));
    assert.equal(index.resolveImport(imported.imports[0])?.fqn, "com.acme.b.Foo");
    // 通配导入无法定位到具体类型。
    const wildcard = fileOf(javaPath("com.acme.c", "Wildcard"));
    assert.equal(index.resolveImport(wildcard.imports[0]), undefined);
});

test("继承链上的方法可见且不重复", () => {
    const leaf = typeOf("com.acme.c.Leaf");
    const owners = index.methodsOf(leaf).map((method) => `${method.ownerFqn}#${method.name}`);
    assert.deepEqual([...new Set(owners)].sort(), [
        "com.acme.c.Base#base",
        "com.acme.c.Base#shared",
        "com.acme.c.Leaf#leaf",
        "com.acme.c.Leaf#shared",
        "com.acme.c.Mid#mid",
    ]);
    // 自身重写与父类声明同时存在，交由 chooseMethod 决定主目标。
    assert.equal(index.findMethods(leaf, "shared", 0).length, 2);
    // 构造器不参与普通方法查找。
    assert.deepEqual(
        index.findMethods(leaf, "shared", 0).filter((method) => method.isConstructor),
        [],
    );
});

test("按参数个数匹配构造器", () => {
    const type = typeOf("com.acme.c.WithCtor");
    assert.equal(index.findConstructor(type, 1)?.params.length, 1);
    assert.equal(index.findConstructor(type, 2)?.params.length, 2);
    assert.equal(index.findConstructor(type, 3), undefined);
});

test("接口展开出全部具体实现", () => {
    const pay = typeOf("com.acme.c.Pay");
    assert.deepEqual(
        index
            .implementationsOf(pay)
            .map((type) => type.fqn)
            .sort(),
        ["com.acme.c.PayA", "com.acme.c.PayB"],
    );
    assert.deepEqual(
        index
            .concreteTypes(pay)
            .map((type) => type.fqn)
            .sort(),
        ["com.acme.c.Pay", "com.acme.c.PayA", "com.acme.c.PayB"],
    );
    // 具体类不再展开。
    assert.deepEqual(
        index.concreteTypes(typeOf("com.acme.c.PayA")).map((type) => type.fqn),
        ["com.acme.c.PayA"],
    );
});

test("Kotlin 可选参数：实参少于形参时仍能唯一匹配", () => {
    const type = typeOf("com.acme.kt.Defaults");
    assert.equal(index.findMethods(type, "greet", 1).length, 1);
    assert.equal(index.findMethods(type, "greet", 2).length, 1);
    assert.equal(index.findMethods(type, "greet", 3).length, 0);
});

test("kindOf 依据注解与命名归类节点", () => {
    assert.equal(index.kindOf(typeOf("com.acme.role.ControllerLike")), "controller");
    assert.equal(index.kindOf(typeOf("com.acme.role.FeignLike")), "feign");
    assert.equal(index.kindOf(typeOf("com.acme.role.MapperLike")), "mapper");
    assert.equal(index.kindOf(typeOf("com.acme.role.RepoLike")), "repository");
    assert.equal(index.kindOf(typeOf("com.acme.role.ServiceLike")), "service");
    assert.equal(index.kindOf(typeOf("com.acme.role.ComponentLike")), "component");
    // 没有注解也不是已知后缀时落到 component，而不是 unknown。
    assert.equal(index.kindOf(typeOf("com.acme.role.PlainLike")), "component");
    // 命名为 *Repository 的接口即使没有注解也算仓储。
    assert.equal(index.kindOf(typeOf("com.acme.c.Pay")), "component");
});

test("模块解析取最深匹配目录", () => {
    assert.equal(index.moduleOf(javaPath("com.acme.b", "Foo"))?.id, "(root)");
    assert.equal(index.findModule("web")?.id, "web");
    assert.equal(index.findModule("missing"), undefined);
});
