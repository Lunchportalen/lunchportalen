/**
 * AST: normalize NextResponse.json payloads in app/api route.ts files to contract shape.
 * Run: npx tsx scripts/ast-api-nextresponse-contract.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";
import {
  Project,
  SyntaxKind,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RID_MODULE = "@/lib/http/rid";
const RID_FN = "rid";

function isEdgeRuntime(sourceFile: SourceFile): boolean {
  return /export\s+const\s+runtime\s*=\s*["']edge["']/.test(sourceFile.getFullText());
}

function hasImportRid(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some(
    (d) =>
      d.getModuleSpecifierValue() === RID_MODULE &&
      d.getNamedImports().some((n) => n.getName() === RID_FN),
  );
}

function ensureImportRid(sourceFile: SourceFile): void {
  if (hasImportRid(sourceFile)) return;
  sourceFile.addImportDeclaration({
    moduleSpecifier: RID_MODULE,
    namedImports: [{ name: RID_FN }],
  });
}

function objectLiteralHasProp(obj: ObjectLiteralExpression, name: string): boolean {
  for (const p of obj.getProperties()) {
    if (p.getKind() === SyntaxKind.PropertyAssignment) {
      if (p.asKindOrThrow(SyntaxKind.PropertyAssignment).getName() === name) return true;
    } else if (p.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
      if (p.asKindOrThrow(SyntaxKind.ShorthandPropertyAssignment).getName() === name) return true;
    }
  }
  return false;
}

function isNextResponseJsonCall(expr: CallExpression): boolean {
  const e = expr.getExpression();
  if (e.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
  const pa = e.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
  return pa.getExpression().getText() === "NextResponse" && pa.getName() === "json";
}

function getContainingFunction(call: CallExpression) {
  let p = call.getParent();
  while (p) {
    const k = p.getKind();
    if (k === SyntaxKind.FunctionDeclaration) return p.asKindOrThrow(SyntaxKind.FunctionDeclaration);
    if (k === SyntaxKind.ArrowFunction) return p.asKindOrThrow(SyntaxKind.ArrowFunction);
    if (k === SyntaxKind.FunctionExpression) return p.asKindOrThrow(SyntaxKind.FunctionExpression);
    p = p.getParent();
  }
  return undefined;
}

function blockHasRequestId(blockText: string): boolean {
  return /\bconst\s+requestId\s*=\s*rid\s*\(/.test(blockText) || /\blet\s+requestId\s*=\s*rid\s*\(/.test(blockText);
}

function ensureRequestId(fn: ReturnType<typeof getContainingFunction>): void {
  if (!fn) return;
  const body = fn.getBody();
  if (!body || body.getKind() !== SyntaxKind.Block) return;
  const block = body.asKindOrThrow(SyntaxKind.Block);
  if (blockHasRequestId(block.getText())) return;
  block.insertStatements(0, `const requestId = ${RID_FN}();`);
}

function secondArgSuffix(call: CallExpression): string {
  const args = call.getArguments();
  return args.length >= 2 ? `, ${args[1]!.getText()}` : "";
}

function httpStatusFromCall(call: CallExpression): string {
  const args = call.getArguments();
  if (args.length < 2 || args[1]!.getKind() !== SyntaxKind.ObjectLiteralExpression) return "500";
  const o = args[1]!.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const pa = o.getProperty("status")?.asKind(SyntaxKind.PropertyAssignment);
  if (pa) return pa.getInitializer()?.getText() ?? "500";
  const sh = o.getProperties().find(
    (p) => p.getKind() === SyntaxKind.ShorthandPropertyAssignment && p.asKindOrThrow(SyntaxKind.ShorthandPropertyAssignment).getName() === "status",
  )?.asKind(SyntaxKind.ShorthandPropertyAssignment);
  if (sh) return sh.getName();
  return "500";
}

function fixObjectLiteralCall(call: CallExpression): "skip" | "fixed" {
  const args = call.getArguments();
  if (args.length < 1) return "skip";
  const first = args[0]!;
  if (first.getKind() !== SyntaxKind.ObjectLiteralExpression) return "skip";

  const obj = first.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const hasOk = objectLiteralHasProp(obj, "ok");
  const hasRid = objectLiteralHasProp(obj, "rid");

  if (hasOk && hasRid) {
    const okInit = obj.getProperty("ok")?.asKind(SyntaxKind.PropertyAssignment)?.getInitializer()?.getText();
    const shorthandOk = obj.getProperty("ok")?.getKind() === SyntaxKind.ShorthandPropertyAssignment;
    const isFalse = okInit === "false";
    if (!isFalse && !shorthandOk && okInit !== "true" && okInit !== undefined) {
      /* ok: someExpr */
    }

    if (isFalse) {
      let changed = false;
      if (!objectLiteralHasProp(obj, "error")) {
        obj.addPropertyAssignment({ name: "error", initializer: `"ERROR"` });
        changed = true;
      }
      if (!objectLiteralHasProp(obj, "message")) {
        obj.addPropertyAssignment({ name: "message", initializer: `"Request failed"` });
        changed = true;
      }
      if (!objectLiteralHasProp(obj, "status")) {
        obj.addPropertyAssignment({ name: "status", initializer: httpStatusFromCall(call) });
        changed = true;
      }
      return changed ? "fixed" : "skip";
    }

    if (!objectLiteralHasProp(obj, "data")) {
      obj.addPropertyAssignment({ name: "data", initializer: "null" });
      return "fixed";
    }
    return "skip";
  }

  ensureRequestId(getContainingFunction(call));
  ensureImportRid(call.getSourceFile());

  const inner = obj.getText();
  call.replaceWithText(`NextResponse.json({ ok: true, rid: requestId, data: ${inner} }${secondArgSuffix(call)})`);
  return "fixed";
}

function processFile(sourceFile: SourceFile): number {
  if (isEdgeRuntime(sourceFile)) return 0;
  if (!sourceFile.getFullText().includes("NextResponse.json")) return 0;

  const calls = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(isNextResponseJsonCall)
    .sort((a, b) => b.getStart() - a.getStart());

  let fixed = 0;
  for (const call of calls) {
    const args = call.getArguments();
    if (args[0]?.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const r = fixObjectLiteralCall(call);
      if (r === "fixed") {
        fixed += 1;
        ensureImportRid(sourceFile);
      }
    }
  }

  return fixed;
}

function main() {
  const project = new Project({
    tsConfigFilePath: path.join(ROOT, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  const routes = globSync("app/api/**/route.ts", { cwd: ROOT, posix: true }).map((r) =>
    path.join(ROOT, r.replace(/\//g, path.sep)),
  );

  let filesModified = 0;
  let callsFixed = 0;
  const skippedFiles: string[] = [];

  for (const filePath of routes) {
    const sf = project.addSourceFileAtPath(filePath);
    if (isEdgeRuntime(sf)) {
      skippedFiles.push(`${path.relative(ROOT, filePath)} (edge)`);
      project.removeSourceFile(sf);
      continue;
    }
    const before = sf.getFullText();
    const n = processFile(sf);
    if (sf.getFullText() !== before) {
      sf.saveSync();
      filesModified += 1;
      callsFixed += n;
    } else if (before.includes("NextResponse.json")) {
      skippedFiles.push(`${path.relative(ROOT, filePath)} (NextResponse.json — no AST changes)`);
    }
    project.removeSourceFile(sf);
  }

  console.log(
    JSON.stringify(
      { filesModified, nextResponseJsonCallsFixed: callsFixed, skippedFiles },
      null,
      2,
    ),
  );
}

main();
