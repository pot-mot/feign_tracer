import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { join } from "node:path";
import { parseSourceFile } from "../src/languages/parse-file.ts";
import type { ParsedFile } from "../src/model.ts";
import { createProject, groovyPath, javaPath, kotlinPath, removeDir } from "./test-utils.ts";

/**
 * 语法提取层的识别回归。
 *
 * 这里锁定的是「从源码里认出了什么」：包名、导入形态、类型/成员、注解参数、
 * 参数与局部变量、调用点的接收者分类。任何一次提取器改动都应该让这些断言
 * 明确地失败，而不是悄悄改变分析结论。
 */

const JAVA_RICH = `package com.acme.extract;

import java.util.List;
import java.util.Map;
import static java.util.Collections.emptyList;
import com.acme.other.*;

@Deprecated
@SuppressWarnings({"a", "b"})
public abstract class Rich extends Base implements Runnable {

    @Autowired
    private final OrderService orderService;
    private static final int LIMIT = 10;

    public Rich(OrderService orderService) {
        this.orderService = orderService;
    }

    @Override
    public void run() {
        validate();
        this.orderService.load(id);
        OrderService.create(id);
        new Order(id);
        factory.build(id).commit();
    }

    @Transactional(readOnly = true)
    public List<Order> find(String id, @RequestParam("n") int count) {
        Order cached = orderService.find(id);
        List<Order> rows = orderService.list(id, count);
        return rows;
    }

    abstract void validate();
}
`;

const KOTLIN_SAMPLE = `package com.acme.kt

import com.acme.lib.Greeter
import com.acme.lib.Tools as Toolkit
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@org.springframework.stereotype.Service
class KotlinController(private val greeter: Greeter) {

    @GetMapping("/hello")
    fun hello(@RequestParam("name") name: String): String {
        val upper = name.uppercase()
        return greeter.greet(upper)
    }
}
`;

const GROOVY_SAMPLE = `package com.acme.gr

import com.acme.gr.mapper.GrMapper
import org.springframework.stereotype.Service

@Service
class GrService {

    private final GrMapper grMapper

    GrService(GrMapper grMapper) {
        this.grMapper = grMapper
    }

    List<String> list(String name) {
        return grMapper.list(name)
    }
}
`;

let kotlinFile: ParsedFile;
let groovyFile: ParsedFile;
let javaFile: ParsedFile;
let workDir = "";

const parse = (absPath: string, kind: "java" | "kotlin" | "groovy"): ParsedFile =>
    parseSourceFile({
        absPath,
        relPath: absPath.replace(/\\/g, "/").split("/").slice(-1)[0],
        kind,
    });

before(() => {
    const project = createProject("feign-tracer-extract-", {
        [javaPath("com.acme.extract", "Rich")]: JAVA_RICH,
        [kotlinPath("com.acme.kt", "KotlinController")]: KOTLIN_SAMPLE,
        [groovyPath("com.acme.gr", "GrService")]: GROOVY_SAMPLE,
    });
    workDir = project.root;
    javaFile = parse(join(workDir, javaPath("com.acme.extract", "Rich")), "java");
    kotlinFile = parse(join(workDir, kotlinPath("com.acme.kt", "KotlinController")), "kotlin");
    groovyFile = parse(join(workDir, groovyPath("com.acme.gr", "GrService")), "groovy");
});

after(() => {
    removeDir(workDir);
});

test("Java: 包名与四种导入形态都被正确识别", () => {
    assert.equal(javaFile.packageName, "com.acme.extract");
    assert.deepEqual(
        javaFile.imports.map((item) => ({
            name: item.name,
            static: item.static,
            wildcard: item.wildcard,
        })),
        [
            { name: "java.util.List", static: false, wildcard: false },
            { name: "java.util.Map", static: false, wildcard: false },
            // 静态导入的名字不能带上 static 前缀，否则永远解析不到宿主类型。
            { name: "java.util.Collections.emptyList", static: true, wildcard: false },
            { name: "com.acme.other", static: false, wildcard: true },
        ],
    );
});

test("Java: 类型声明、注解参数、修饰符与父类型", () => {
    assert.equal(javaFile.types.length, 1);
    const type = javaFile.types[0];

    assert.equal(type.fqn, "com.acme.extract.Rich");
    assert.equal(type.kind, "class");
    assert.equal(type.packageName, "com.acme.extract");
    assert.deepEqual(
        type.annotations.map((item) => item.name),
        ["Deprecated", "SuppressWarnings"],
    );
    assert.deepEqual(type.annotations[1].args, { value: '{"a","b"}' });
    assert.deepEqual(type.modifiers, ["public", "abstract"]);
    assert.deepEqual(type.superTypes, ["Base", "Runnable"]);
});

test("Java: 字段的类型、注解、修饰符与初始值", () => {
    const type = javaFile.types[0];
    assert.deepEqual(
        type.fields.map((field) => ({
            name: field.name,
            type: field.type,
            annotations: field.annotations.map((annotation) => annotation.name),
            modifiers: field.modifiers,
            initializer: field.initializer,
            line: field.line,
        })),
        [
            {
                name: "orderService",
                type: "OrderService",
                annotations: ["Autowired"],
                modifiers: ["private", "final"],
                initializer: undefined,
                line: 13,
            },
            {
                name: "LIMIT",
                type: "int",
                annotations: [],
                modifiers: ["private", "static", "final"],
                initializer: "10",
                line: 14,
            },
        ],
    );
});

test("Java: 构造器、抽象方法、参数注解与返回类型", () => {
    const methods = javaFile.types[0].methods;
    assert.deepEqual(
        methods.map((method) => ({
            id: method.id,
            isConstructor: method.isConstructor,
            isAbstract: method.isAbstract,
            returnType: method.returnType,
            hasBody: method.bodyStart !== undefined,
        })),
        [
            {
                id: "com.acme.extract.Rich#Rich/1",
                isConstructor: true,
                isAbstract: false,
                returnType: "Rich",
                hasBody: true,
            },
            {
                id: "com.acme.extract.Rich#run/0",
                isConstructor: false,
                isAbstract: false,
                returnType: "void",
                hasBody: true,
            },
            {
                id: "com.acme.extract.Rich#find/2",
                isConstructor: false,
                isAbstract: false,
                returnType: "List<Order>",
                hasBody: true,
            },
            {
                id: "com.acme.extract.Rich#validate/0",
                isConstructor: false,
                isAbstract: true,
                returnType: "void",
                hasBody: false,
            },
        ],
    );

    const find = methods[2];
    assert.deepEqual(
        find.params.map((param) => ({
            name: param.name,
            type: param.type,
            annotations: param.annotations.map((annotation) => ({
                name: annotation.name,
                args: annotation.args,
            })),
        })),
        [
            { name: "id", type: "String", annotations: [] },
            {
                name: "count",
                type: "int",
                annotations: [{ name: "RequestParam", args: { value: '"n"' } }],
            },
        ],
    );
    assert.deepEqual(
        find.annotations.map((annotation) => ({ name: annotation.name, args: annotation.args })),
        [{ name: "Transactional", args: { readOnly: "true" } }],
    );
});

test("Java: 调用点的接收者分类（隐式 / this / 类型 / 表达式 / 构造器）", () => {
    const run = javaFile.types[0].methods[1];
    assert.deepEqual(
        (run.calls ?? []).map((call) => ({
            name: call.name,
            qualifier: call.qualifier,
            kind: call.qualifierKind,
            argCount: call.argCount,
            args: call.args,
            isConstructor: call.isConstructor,
        })),
        [
            {
                name: "validate",
                qualifier: undefined,
                kind: "implicit",
                argCount: 0,
                args: [],
                isConstructor: false,
            },
            {
                name: "load",
                qualifier: "this.orderService",
                kind: "expr",
                argCount: 1,
                args: ["id"],
                isConstructor: false,
            },
            {
                name: "create",
                qualifier: "OrderService",
                kind: "type",
                argCount: 1,
                args: ["id"],
                isConstructor: false,
            },
            {
                name: "Order",
                qualifier: "Order",
                kind: "constructor",
                argCount: 1,
                args: ["id"],
                isConstructor: true,
            },
            {
                name: "build",
                qualifier: "factory",
                kind: "expr",
                argCount: 1,
                args: ["id"],
                isConstructor: false,
            },
            {
                // 链式调用的接收者是上一次调用的结果，不能截成 "id)" 这种残片。
                name: "commit",
                qualifier: "factory.build(id)",
                kind: "expr",
                argCount: 0,
                args: [],
                isConstructor: false,
            },
        ],
    );
});

test("Java: 局部变量带类型与行号，跨方法不串味", () => {
    const find = javaFile.types[0].methods[2];
    assert.deepEqual(
        (find.locals ?? []).map((local) => ({
            name: local.name,
            type: local.type,
            line: local.line,
        })),
        [
            { name: "cached", type: "Order", line: 31 },
            { name: "rows", type: "List<Order>", line: 32 },
        ],
    );
    assert.deepEqual(javaFile.types[0].methods[1].locals, []);
});

test("Kotlin: 构造器属性成字段，全限定注解归约为简单名，导入别名保留", () => {
    assert.equal(kotlinFile.types.length, 1);
    const type = kotlinFile.types[0];
    assert.equal(type.fqn, "com.acme.kt.KotlinController");
    assert.deepEqual(
        type.annotations.map((annotation) => annotation.name),
        ["RestController", "Service"],
    );
    assert.deepEqual(
        type.fields.map((field) => ({ name: field.name, type: field.type })),
        [{ name: "greeter", type: "Greeter" }],
    );
    assert.deepEqual(
        kotlinFile.imports.map((item) => ({ name: item.name, alias: item.alias })),
        [
            { name: "com.acme.lib.Greeter", alias: undefined },
            { name: "com.acme.lib.Tools", alias: "Toolkit" },
            { name: "org.springframework.web.bind.annotation.GetMapping", alias: undefined },
            { name: "org.springframework.web.bind.annotation.RestController", alias: undefined },
        ],
    );

    const hello = type.methods[0];
    assert.equal(hello.id, "com.acme.kt.KotlinController#hello/1");
    assert.equal(hello.returnType, "String");
    assert.deepEqual(
        (hello.locals ?? []).map((local) => ({ name: local.name, type: local.type })),
        [{ name: "upper", type: undefined }],
    );
    assert.deepEqual(
        (hello.calls ?? []).map((call) => [call.name, call.qualifier]),
        [
            ["uppercase", "name"],
            ["greet", "greeter"],
        ],
    );
});

test("Groovy: 无返回类型且与类同名的方法识别为构造器", () => {
    const type = groovyFile.types[0];
    assert.equal(type.fqn, "com.acme.gr.GrService");
    assert.deepEqual(
        type.methods.map((method) => ({
            id: method.id,
            isConstructor: method.isConstructor,
            returnType: method.returnType,
        })),
        [
            {
                id: "com.acme.gr.GrService#GrService/1",
                isConstructor: true,
                returnType: "GrService",
            },
            {
                id: "com.acme.gr.GrService#list/1",
                isConstructor: false,
                returnType: "List<String>",
            },
        ],
    );
    assert.deepEqual(
        (type.methods[1].calls ?? []).map((call) => [call.name, call.qualifier]),
        [["list", "grMapper"]],
    );
});
