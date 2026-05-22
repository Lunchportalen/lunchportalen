import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "archive", ".git", "tests", "scripts"]);

/** RPCs with intentional runtime fallback — not required in migrations ledger. */
const RUNTIME_SAFE_RPC_ALLOWLIST = new Set(["lp_membership_get", "lp_pgrst_reload_schema"]);

const RPC_RE = /\.rpc\s*\(\s*["'`]([^"'`]+)["'`]/g;
const DYNAMIC_RPC_RE = /rpc(?:WithParamFallbacks)?\s*<[^>]*>\s*\(\s*["'`]([^"'`]+)["'`]/g;
const MIGRATION_FN_RE =
  /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/gi;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (extname(p) === ".ts" || extname(p) === ".tsx") out.push(p);
  }
  return out;
}

function collectCodeRpcs(): Set<string> {
  const refs = new Set<string>();
  for (const file of [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib"))]) {
    const text = readFileSync(file, "utf8");
    for (const re of [RPC_RE, DYNAMIC_RPC_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const name = m[1].trim();
        if (name && !name.includes(" or ") && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) refs.add(name);
      }
    }
  }
  return refs;
}

function collectMigrationRpcs(): Set<string> {
  const names = new Set<string>();
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"))) {
    const text = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    MIGRATION_FN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MIGRATION_FN_RE.exec(text)) !== null) {
      const name = (m[1] ?? m[2] ?? "").trim();
      if (name) names.add(name);
    }
  }
  return names;
}

describe("audit: no broken RPC references in app/lib", () => {
  it("every .rpc() in app/lib is defined in supabase/migrations (or runtime-safe allowlist)", () => {
    const codeRpcs = collectCodeRpcs();
    const migrationRpcs = collectMigrationRpcs();

    const missing = [...codeRpcs]
      .filter((name) => !migrationRpcs.has(name) && !RUNTIME_SAFE_RPC_ALLOWLIST.has(name))
      .sort();

    expect(
      missing,
      `Code references RPC(s) not found in migrations:\n${missing.map((n) => `  - ${n}`).join("\n")}`,
    ).toEqual([]);
  });
});
