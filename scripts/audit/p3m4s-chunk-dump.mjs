/**
 * Split schema dump into apply chunks (statement-aware, strips psql meta).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const inPath = join(root, "scripts", "audit", "staging-schema-dump-2026-05-20.sql");
const outDir = join(root, "scripts", "audit", "staging-schema-chunks");

const raw = readFileSync(inPath, "utf8");
const cleaned = raw
  .split(/\r?\n/)
  .filter((line) => {
    if (/^\\restrict\b/.test(line) || /^\\unrestrict\b/.test(line)) return false;
    if (/^\s*--/.test(line)) return false; // pg_dump comments (may contain ';')
    if (/^\s*$/.test(line)) return false;
    return true;
  })
  .join("\n");

/** Split on semicolons outside dollar-quoted bodies. */
function splitStatements(sql) {
  const stmts = [];
  let buf = "";
  let dollar = null;
  let i = 0;
  while (i < sql.length) {
    if (dollar) {
      const close = sql.indexOf(dollar, i);
      if (close === -1) {
        buf += sql.slice(i);
        break;
      }
      buf += sql.slice(i, close + dollar.length);
      i = close + dollar.length;
      dollar = null;
      continue;
    }
    const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
    if (m) {
      dollar = m[0];
      buf += m[0];
      i += m[0].length;
      continue;
    }
    const ch = sql[i];
    if (ch === ";") {
      const piece = buf.trim();
      if (piece && !piece.startsWith("--")) stmts.push(piece);
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const tail = buf.trim();
  if (tail && !tail.startsWith("--")) stmts.push(tail);
  return stmts.filter((s) => s.length > 0 && !/^SET\s/i.test(s) && !/^SELECT pg_catalog\.set_config/i.test(s));
}

const statements = splitStatements(cleaned);
mkdirSync(outDir, { recursive: true });

const MAX = 75_000; // chars per chunk (MCP apply_migration payload limit)
const chunks = [];
let current = "";
let idx = 0;

for (const stmt of statements) {
  const next = current ? `${current};\n\n${stmt}` : stmt;
  if (next.length > MAX && current) {
    chunks.push(current);
    current = stmt;
    idx++;
  } else {
    current = next;
  }
}
if (current) chunks.push(current);

chunks.forEach((body, i) => {
  const n = String(i + 1).padStart(3, "0");
  writeFileSync(join(outDir, `chunk-${n}.sql`), body + ";\n", "utf8");
});

const manifest = {
  statementCount: statements.length,
  chunkCount: chunks.length,
  totalChars: cleaned.length,
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
