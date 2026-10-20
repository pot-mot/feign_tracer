import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const outRoot = join(root, "src", "generated");

const targets = [
  { name: "xml", dir: "xml", lexer: "XMLLexer.g4", parser: "XMLParser.g4" },
  { name: "java", dir: "java", lexer: "Java20Lexer.g4", parser: "Java20Parser.g4" },
  { name: "kotlin", dir: "kotlin", lexer: "KotlinLexer.g4", parser: "KotlinParser.g4" },
  { name: "groovy", dir: "groovy", lexer: "GroovyLexer.g4", parser: "GroovyParser.g4" },
];

const antlrRunner = join(root, "node_modules", "antlr-ng", "dist", "cli", "runner.js");

function antlr(args) {
  execFileSync(process.execPath, [antlrRunner, ...args], {
    cwd: root,
    stdio: "inherit",
  });
}

function stamp(dir) {
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".ts")) continue;
    const full = join(dir, file);
    const text = readFileSync(full, "utf8");
    if (!text.startsWith("// @ts-nocheck")) {
      writeFileSync(full, "// @ts-nocheck\n" + text);
    }
  }
}

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

for (const target of targets) {
  const grammarDir = join(root, "grammars", target.dir);
  const outDir = join(outRoot, target.name);
  mkdirSync(outDir, { recursive: true });

  console.log(`[generate] ${target.name} lexer`);
  antlr([
    "-D", "language=TypeScript",
    "-o", outDir,
    "--lib", grammarDir,
    join(grammarDir, target.lexer),
  ]);

  console.log(`[generate] ${target.name} parser`);
  antlr([
    "-D", "language=TypeScript",
    "-o", outDir,
    "--lib", outDir,
    "--generate-visitor=true",
    join(grammarDir, target.parser),
  ]);

  stamp(outDir);
}

console.log("[generate] done");
