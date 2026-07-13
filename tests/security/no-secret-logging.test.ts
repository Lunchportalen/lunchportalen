/**
 * Fase J (observability): logs must never contain credentials.
 * Static guard: no console/opsLog call may reference raw Authorization headers,
 * service-role keys, Stripe secrets, or access tokens in app/api or lib.
 */
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app/api", "lib"];

const FORBIDDEN_IN_LOG_CALL = [
  /headers\.get\(\s*["']authorization["']\s*\)/i,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /STRIPE_SECRET_KEY/,
  /access_token/i,
  /CRON_SECRET/,
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

/** Extract single log-call statements (console.* / opsLog) heuristically. */
function logCallSnippets(src: string): string[] {
  const out: string[] = [];
  const re = /(?:console\.(?:log|info|warn|error)|opsLog)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    // Capture a bounded window after the call start (log statements are short).
    out.push(src.slice(m.index, Math.min(src.length, m.index + 400)));
  }
  return out;
}

describe("no secrets in log statements (Fase J)", () => {
  test("app/api and lib log calls never reference credentials", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) continue;
      for (const file of walk(abs)) {
        const src = fs.readFileSync(file, "utf8");
        for (const snippet of logCallSnippets(src)) {
          for (const pattern of FORBIDDEN_IN_LOG_CALL) {
            if (pattern.test(snippet)) {
              offenders.push(`${path.relative(ROOT, file)}: ${pattern}`);
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
