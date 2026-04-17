/**
 * Deterministic audit heuristics for repo-intelligence/auditReport.json.
 * Reuses scanRepo data where possible; does not mutate application code.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { glob } from "glob";

import {
  buildApiMap,
  buildDbMap,
  buildErrors,
  buildFlows,
  loadPublicTableNames,
  scanAllFileEntries,
  type RepoFileEntry,
} from "../scanRepo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

export type AuditIssue = {
  id: string;
  code: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  files?: string[];
  evidence?: string;
};

export type AuditReport = {
  generated_at: string;
  repo_root: string;
  roots_scanned: string[];
  critical_blockers: AuditIssue[];
  missing: AuditIssue[];
  partial: AuditIssue[];
};

function rel(p: string): string {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readUtf8(p: string): string {
  return fs.readFileSync(p, "utf8");
}

/** Extra roots per spec (api/ at repo root if present). */
function collectExtendedRoots(): string[] {
  const bases = ["app", "lib", "supabase", "components", "scripts"];
  if (exists(path.join(ROOT, "api"))) bases.push("api");
  return bases;
}

/** Scan additional text files under optional roots for pattern-only checks. */
function collectExtraFilesForPatterns(): string[] {
  const roots = collectExtendedRoots();
  const out: string[] = [];
  for (const r of roots) {
    const pattern = path.join(ROOT, r, "**/*.{ts,tsx,mjs,js}").split("\\").join("/");
    const files = glob.sync(pattern, {
      nodir: true,
      ignore: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/coverage/**"],
    });
    out.push(...files.map((f) => rel(f)));
  }
  return [...new Set(out)].sort();
}

/** Real code only: supabase.from('*') — not string literals in audit messages. */
const FROM_STAR_RE = /\bsupabase\s*\.\s*from\s*\(\s*['"]\*['"]\s*\)/g;

function findFromStar(files: string[]): Array<{ file: string; line: number }> {
  const hits: Array<{ file: string; line: number }> = [];
  for (const fr of files) {
    if (fr.startsWith("scripts/audit/")) continue;
    const abs = path.join(ROOT, fr);
    if (!exists(abs)) continue;
    let src: string;
    try {
      src = readUtf8(abs);
    } catch {
      continue;
    }
    const lines = src.split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      FROM_STAR_RE.lastIndex = 0;
      if (FROM_STAR_RE.test(lines[i]!)) {
        hits.push({ file: fr, line: i + 1 });
      }
    }
  }
  return hits;
}

const CONSOLE_ERR_RE = /\bconsole\.error\s*\(/g;

function isConsoleErrorExcludedPath(fr: string): boolean {
  return (
    fr.includes("/tests/") ||
    fr.includes("/test/") ||
    fr.includes(".test.") ||
    fr.includes("scripts/ci/") ||
    fr.endsWith(".mjs")
  );
}

function findConsoleErrors(files: string[]): Array<{ file: string; line: number }> {
  const hits: Array<{ file: string; line: number }> = [];
  for (const fr of files) {
    if (isConsoleErrorExcludedPath(fr)) continue;
    const abs = path.join(ROOT, fr);
    if (!exists(abs)) continue;
    let src: string;
    try {
      src = readUtf8(abs);
    } catch {
      continue;
    }
    const lines = src.split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      CONSOLE_ERR_RE.lastIndex = 0;
      if (CONSOLE_ERR_RE.test(lines[i]!)) {
        hits.push({ file: fr, line: i + 1 });
      }
    }
  }
  return hits.slice(0, 200);
}

function hasRoute(apiMap: ReturnType<typeof buildApiMap>, route: string): boolean {
  return apiMap.some((a) => a.route === route);
}

function buildReferencedApiSet(files: RepoFileEntry[]): Set<string> {
  const referencedApi = new Set<string>();
  for (const f of files) {
    for (const u of f.fetch_urls) {
      if (u.startsWith("/api/")) referencedApi.add(u.replace(/\/$/, "").split("?")[0]!);
    }
  }
  return referencedApi;
}

/** Heuristic: API route handlers with no .from / .rpc in the same file. */
function findApiRoutesWithoutDbHint(files: RepoFileEntry[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (f.type !== "api") continue;
    if (f.uses_tables.length > 0 || f.rpc_calls.length > 0) continue;
    const abs = path.join(ROOT, f.path);
    if (!exists(abs)) continue;
    const src = readUtf8(abs);
    if (/\/\/\s*NO_DB|read-only|redirect/i.test(src)) continue;
    if (f.path.includes("/api/health")) continue;
    out.push(f.path);
  }
  return out.sort();
}

/** Heuristic: social API routes that accept mutations but show no obvious persist calls. */
function findAiSocialPersistGaps(files: RepoFileEntry[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (f.type !== "api") continue;
    if (!f.path.startsWith("app/api/social/")) continue;
    if (!f.http_methods.some((m) => m === "POST" || m === "PUT" || m === "PATCH")) continue;
    const abs = path.join(ROOT, f.path);
    const src = readUtf8(abs);
    const persistHint =
      /\.(insert|upsert|update)\s*\(/.test(src) ||
      /\bauditWrite/.test(src) ||
      /persist/i.test(src) ||
      /runInstrumentedApi/.test(src);
    if (!persistHint) out.push(f.path);
  }
  return out.sort();
}

function issue(
  code: string,
  severity: AuditIssue["severity"],
  message: string,
  files?: string[],
  evidence?: string
): AuditIssue {
  const basis = [code, message, ...(files ?? []).slice(0, 3)].join("|");
  const id = `AUD_${createHash("sha256").update(basis).digest("hex").slice(0, 16)}`;
  return { id, code, severity, message, files, evidence };
}

export function generateAuditReport(): AuditReport {
  const generated_at = new Date().toISOString();
  const roots_scanned = collectExtendedRoots();

  const files = scanAllFileEntries();
  const publicTables = loadPublicTableNames();
  const dbMap = buildDbMap(files);
  const apiMap = buildApiMap(files);
  const flowBundle = buildFlows(apiMap, dbMap);
  const repoErrors = buildErrors(files, dbMap, publicTables);

  const patternFiles = collectExtraFilesForPatterns();
  const fromStar = findFromStar(patternFiles);
  const consoleHits = findConsoleErrors(patternFiles);

  const critical_blockers: AuditIssue[] = [];
  const missing: AuditIssue[] = [];
  const partial: AuditIssue[] = [];

  if (fromStar.length > 0) {
    critical_blockers.push(
      issue(
        "SUPABASE_FROM_STAR",
        "critical",
        "Wildcard table argument in supabase.from(...) is forbidden — use an explicit table name.",
        fromStar.map((h) => `${h.file}:${h.line}`),
        "Literal asterisk as table name breaks typing, RLS reasoning, and auditability."
      )
    );
  }

  const required = ["/api/contact", "/api/orders", "/api/social/redirect"] as const;
  for (const r of required) {
    if (!hasRoute(apiMap, r)) {
      critical_blockers.push(
        issue(
          "MISSING_CANONICAL_ROUTE",
          "critical",
          `Missing canonical API route file for ${r} (expected app/api/.../route.ts).`,
          [`expected:${r}`]
        )
      );
    }
  }

  for (const g of repoErrors.gaps) {
    if (g.type === "table_not_in_database_ts") {
      missing.push(
        issue(
          "TABLE_NOT_IN_DATABASE_TS",
          "high",
          g.description,
          g.files,
          g.type
        )
      );
    } else if (g.type === "fetch_reference_unresolved") {
      missing.push(
        issue(
          "FETCH_REFERENCE_UNRESOLVED",
          "high",
          g.description,
          g.files,
          g.type
        )
      );
    } else if (g.type === "layout_without_pages") {
      partial.push(
        issue(
          "LAYOUT_WITHOUT_PAGES",
          "medium",
          g.description,
          g.files ? [g.description] : undefined,
          g.type
        )
      );
    }
  }

  const referenced = buildReferencedApiSet(files);
  const declaredRoutes = new Set(apiMap.map((a) => a.route));
  const unusedDevLike: string[] = [];
  const devLike = /^\/api\/(example|debug|dev|template|_template)(\/|$)/;
  for (const route of declaredRoutes) {
    if (!devLike.test(route)) continue;
    if (!referenced.has(route)) unusedDevLike.push(route);
  }
  if (unusedDevLike.length > 0) {
    partial.push(
      issue(
        "POTENTIALLY_UNUSED_DEV_API",
        "low",
        "Dev/example/template API routes with no in-repo fetch() reference (heuristic).",
        unusedDevLike.slice(0, 40),
        "Dynamic callers not counted; safe to ignore if called externally."
      )
    );
  }

  const noDb = findApiRoutesWithoutDbHint(files);
  if (noDb.length > 0) {
    partial.push(
      issue(
        "API_NO_DB_HINT",
        "medium",
        "Route modules with no .from() / .rpc() in-file (proxy, static, or intentional).",
        noDb.slice(0, 60),
        "Confirm each route is intentionally DB-free or delegates to another module."
      )
    );
  }

  const aiPersist = findAiSocialPersistGaps(files);
  if (aiPersist.length > 0) {
    partial.push(
      issue(
        "AI_SOCIAL_PERSIST_HEURISTIC",
        "medium",
        "Social API routes with mutating methods but no obvious insert/upsert/update/audit pattern in the route file.",
      aiPersist.slice(0, 40),
        "Heuristic only — may persist via shared helpers."
      )
    );
  }

  const flow0 = flowBundle.flows[0];
  if (flow0 && flow0.confidence === "partial") {
    partial.push(
      issue(
        "FLOW_SOCIAL_LEAD_ORDER_PARTIAL",
        "medium",
        "Social → lead → order flow is only partially satisfied by static scan (missing routes/tables in scanned graph).",
        flow0.steps,
        flow0.inference
      )
    );
  }

  if (consoleHits.length > 0) {
    partial.push(
      issue(
        "CONSOLE_ERROR_USAGE",
        "low",
        "console.error(...) occurrences in production source (excludes tests and scripts/ci).",
        consoleHits.slice(0, 50).map((h) => `${h.file}:${h.line}`),
        "Prefer structured logging (opsLog / logApiError) where applicable."
      )
    );
  }

  return {
    generated_at,
    repo_root: ROOT,
    roots_scanned,
    critical_blockers,
    missing,
    partial,
  };
}
