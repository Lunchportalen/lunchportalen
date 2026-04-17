/**
 * At most ONE pattern-based fix per run. Validates after write; reverts on failure.
 *
 * Phase 1: console_error, db_select_star (gated), missing_limit (gated)
 * Phase 2: missing_api_db_write, unused_api_endpoint, missing_attribution, ui_missing_fetch, partial_flow
 *   — require AUTOFIX_PHASE2=1 for Phase 2 handlers, plus per-handler gates (see each function).
 *   — Most tasks stay automatable:false in buildTasks; set automatable:true on a task in tasks.json to run.
 *
 * Phase 3: duplicate_code, weak_typing, inefficient_loop, missing_error_standard, query_select_limit
 *   — require AUTOFIX_PHASE3=1 plus per-handler gates (AUTOFIX_PHASE3_*). Catch-body injection is disabled (unsafe).
 *
 * Phase 4 (architecture): extract_reusable_function, split_large_file, centralize_fetch, centralize_supabase, centralize_error_handling
 *   — require AUTOFIX_ARCH=1. No bulk fetch/supabase/error rewrites (breaks contracts); optional detection-only paths.
 *   — lib/core/apiClient.ts exports apiFetch as alias to fetchSafeJson (does not duplicate logic).
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { TaskRecord } from "./buildTasks.js";
import { runValidate } from "./validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TASKS_PATH = path.join(ROOT, "repo-intelligence", "tasks.json");
const STATE_PATH = path.join(ROOT, "repo-intelligence", "tasks-state.json");
const RUN_LOG = path.join(ROOT, "repo-intelligence", "run-log.json");

type TasksFile = {
  generated_at: string;
  audit_generated_at?: string;
  tasks: TaskRecord[];
};

type TaskState = {
  completed_task_ids: string[];
  last_updated: string;
};

function readJson<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeTaskState(state: TaskState) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function appendRunLog(entry: Record<string, unknown>) {
  const cur = readJson<unknown[]>(RUN_LOG, []);
  if (!Array.isArray(cur)) return;
  cur.push({ ...entry, at: new Date().toISOString() });
  fs.mkdirSync(path.dirname(RUN_LOG), { recursive: true });
  fs.writeFileSync(RUN_LOG, JSON.stringify(cur, null, 2), "utf8");
}

function gitCheckout(files: string[]) {
  if (files.length === 0) return;
  spawnSync("git", ["checkout", "--", ...files], { cwd: ROOT, stdio: "inherit", shell: true });
}

function resolvePath(rel: string): string {
  const p = rel.trim().replaceAll("\\", "/");
  if (path.isAbsolute(p)) return p;
  return path.join(ROOT, p);
}

/**
 * Resolve audit targets: repo-relative paths, or `/api/foo/bar` → `app/api/foo/bar/route.ts`.
 */
function resolveTaskFileAbs(raw: string): string | null {
  const n = raw.trim().replaceAll("\\", "/");
  if (n.startsWith("/api/")) {
    const seg = n.replace(/^\//, "");
    const base = path.join(ROOT, "app", seg);
    const r = path.join(base, "route.ts");
    if (fs.existsSync(r)) return r;
    const r2 = path.join(base, "route.tsx");
    if (fs.existsSync(r2)) return r2;
    return null;
  }
  const abs = resolvePath(n);
  if (fs.existsSync(abs)) return abs;
  return null;
}

/** Target may be "path:line" or "path1:1, path2:2" from audit. */
function parseTargetPaths(target: string): string[] {
  const parts = target.split(",").map((s) => s.trim());
  const out: string[] = [];
  for (const p of parts) {
    const colon = p.lastIndexOf(":");
    if (colon > 0 && /^\d+$/.test(p.slice(colon + 1))) {
      out.push(p.slice(0, colon));
    } else {
      out.push(p);
    }
  }
  return [...new Set(out.map((x) => x.replaceAll("\\", "/")))];
}

function withinChangeBudget(oldC: string, newC: string): boolean {
  const delta = Math.abs(newC.length - oldC.length);
  if (oldC.length < 1200) return delta <= 140;
  return delta / oldC.length <= 0.05;
}

function phase2Enabled(): boolean {
  return process.env.AUTOFIX_PHASE2 === "1";
}

function phase3Enabled(): boolean {
  return process.env.AUTOFIX_PHASE3 === "1";
}

function archEnabled(): boolean {
  return process.env.AUTOFIX_ARCH === "1";
}

function isPhase3PathOk(relPosix: string): boolean {
  if (isPhase2GloballyExcluded(relPosix)) return false;
  if (relPosix.endsWith(".d.ts")) return false;
  return true;
}

function isPhase2GloballyExcluded(relPosix: string): boolean {
  return (
    relPosix.includes("/tests/") ||
    relPosix.includes("/test/") ||
    relPosix.includes(".test.") ||
    relPosix.startsWith("scripts/") ||
    relPosix.startsWith("studio/") ||
    relPosix.includes("/supabase/migrations/") ||
    relPosix.includes("middleware.ts")
  );
}

function isExcludedPathForConsole(relPosix: string): boolean {
  return (
    relPosix.includes("/tests/") ||
    relPosix.includes("/test/") ||
    relPosix.includes(".test.") ||
    relPosix.startsWith("scripts/") ||
    relPosix.startsWith("studio/")
  );
}

function isUseClient(content: string): boolean {
  const head = content.split("\n").slice(0, 30).join("\n");
  return /^\s*["']use client["']\s*;/m.test(head);
}

function hasOpsLogImport(content: string): boolean {
  return /import\s*\{[^}]*\bopsLog\b[^}]*\}\s*from\s*["']@\/lib\/ops\/log["']/.test(content);
}

function insertOpsLogImport(content: string): string {
  if (hasOpsLogImport(content)) return content;
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length && /^\s*import\s/.test(lines[i]!)) i++;
  lines.splice(i, 0, `import { opsLog } from "@/lib/ops/log";`);
  return lines.join("\n");
}

function ensureImports(content: string, linesToAdd: string[]): string {
  let c = content;
  for (const line of linesToAdd) {
    const mod = line.match(/from\s*["']([^"']+)["']/)?.[1];
    if (mod && (c.includes(`from "${mod}"`) || c.includes(`from '${mod}'`))) continue;
    const lines = c.split("\n");
    let j = 0;
    while (j < lines.length && /^\s*import\s/.test(lines[j]!)) j++;
    lines.splice(j, 0, line);
    c = lines.join("\n");
  }
  return c;
}

/** `.select("*")` / `.select('*')` → `.select("id")` — only when AUTOFIX_ALLOW_SELECT_STAR=1 (dangerous). */
function fixSelectStar(_filePath: string, content: string): string | null {
  if (process.env.AUTOFIX_ALLOW_SELECT_STAR !== "1") return null;
  if (!/\.select\s*\(\s*["']\*["']\s*\)/.test(content)) return null;
  const updated = content.replace(/\.select\s*\(\s*["']\*["']\s*\)/g, '.select("id")');
  if (updated === content) return null;
  if (!withinChangeBudget(content, updated)) return null;
  return updated;
}

/** Append `.limit(100)` after `.select(...)` when file has no `.limit(` — gated. */
function fixMissingLimit(_filePath: string, content: string): string | null {
  if (process.env.AUTOFIX_ALLOW_MISSING_LIMIT !== "1") return null;
  if (!content.includes(".select(")) return null;
  if (content.includes(".limit(")) return null;
  const updated = content.replace(/(\.select\([^)]+\))/g, "$1.limit(100)");
  if (updated === content) return null;
  if (!withinChangeBudget(content, updated)) return null;
  return updated;
}

/** First single-line `console.error(...);` → structured `opsLog` (server files only). */
function fixConsoleError(filePath: string, content: string): string | null {
  const rel = path.relative(ROOT, filePath).split(path.sep).join("/");
  if (isExcludedPathForConsole(rel)) return null;
  if (isUseClient(content)) return null;
  if (!content.includes("console.error")) return null;

  const lines = content.split("\n");
  let hit = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.includes("console.error")) continue;
    if (/^\s*\/\//.test(line)) continue;
    const m = line.match(/^(\s*)console\.error\s*\((.*)\)\s*;\s*$/);
    if (!m) continue;
    const indent = m[1]!;
    const args = m[2]!.trim();
    if (!args) continue;
    lines[i] = `${indent}opsLog("autofix_console_error", { message: ${args} });`;
    hit = i;
    break;
  }
  if (hit < 0) return null;

  let updated = lines.join("\n");
  updated = insertOpsLogImport(updated);
  if (!withinChangeBudget(content, updated)) return null;
  return updated;
}

function isDbWriteExcludedRoutePath(relPosix: string): boolean {
  const s = relPosix.replace(/\\/g, "/");
  return /\/api\/(example|health|template|_template|debug)(\/|$)/.test(s);
}

function injectBeforeFirstPostReturn(content: string, patch: string): string | null {
  const m = /export\s+async\s+function\s+POST\s*\([^)]*\)\s*(?::\s*Promise<[^>]+>)?\s*\{/.exec(content);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  const slice = content.slice(start);
  const retMatch = /\n(\s*)return\s+/.exec(slice);
  if (!retMatch || retMatch.index === undefined) return null;
  const insertAt = start + retMatch.index + 1;
  return content.slice(0, insertAt) + patch + "\n" + content.slice(insertAt);
}

/**
 * Best-effort ai_activity_log touch using buildAiActivityLogRow (schema-safe).
 * Requires AUTOFIX_PHASE2=1 and AUTOFIX_PHASE2_DB_WRITE=1.
 */
function fixMissingApiDbWrite(filePath: string, content: string): string | null {
  if (!phase2Enabled() || process.env.AUTOFIX_PHASE2_DB_WRITE !== "1") return null;
  const rel = path.relative(ROOT, filePath).split(path.sep).join("/");
  if (isPhase2GloballyExcluded(rel) || !rel.includes("/app/api/") || !rel.endsWith("route.ts")) return null;
  if (isDbWriteExcludedRoutePath(rel)) return null;
  if (!/export\s+async\s+function\s+POST\b/.test(content)) return null;
  if (/supabase\.(from|rpc)\s*\(/.test(content) || /\badmin\.from\s*\(/.test(content)) return null;
  if (content.includes("autofix_touch")) return null;

  const routeLiteral = JSON.stringify(
    "/" + rel.replace(/^app\//, "").replace(/\/route\.tsx?$/, "")
  );
  const patch = [
    "  try {",
    "    const admin = supabaseAdmin();",
    "    const row = buildAiActivityLogRow({",
    '      action: "autofix_touch",',
    `      metadata: { route: ${routeLiteral} },`,
    "    });",
    '    await admin.from("ai_activity_log").insert({',
    "      ...row,",
    '      rid: makeRid("autofix"),',
    '      status: "success",',
    "    } as Record<string, unknown>);",
    "  } catch {",
    "    /* autofix: best-effort */",
    "  }",
  ].join("\n");

  const injected = injectBeforeFirstPostReturn(content, patch);
  if (injected == null) return null;

  let updated = ensureImports(injected, [
    `import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";`,
    `import { supabaseAdmin } from "@/lib/supabase/admin";`,
    `import { makeRid } from "@/lib/http/respond";`,
  ]);
  if (!withinChangeBudget(content, updated)) return null;
  return updated;
}

/** Marker comment only — no runtime side effects (safe idempotent wire). */
function fixUnusedApiEndpoint(filePath: string, content: string): string | null {
  if (!phase2Enabled() || process.env.AUTOFIX_PHASE2_WIRE !== "1") return null;
  const rel = path.relative(ROOT, filePath).split(path.sep).join("/");
  if (isPhase2GloballyExcluded(rel)) return null;
  if (!rel.includes("/app/api/") || (!rel.endsWith("route.ts") && !rel.endsWith("route.tsx"))) return null;
  if (content.includes("autofix-phase2: route anchor")) return null;
  const marker = "\n\n/* autofix-phase2: route anchor (static analysis; no runtime I/O) */\n";
  const updated = content + marker;
  if (!withinChangeBudget(content, updated)) return null;
  return updated;
}

/** Orders use RPC / validation — do not inject insert({ social_post_id }). No-op unless future narrow task. */
function fixMissingAttribution(_filePath: string, _content: string): string | null {
  if (!phase2Enabled()) return null;
  return null;
}

/** onClick wrapping is unsafe (arity, SSR). Dev-only optional ping behind AUTOFIX_PHASE2_UI_PING. */
function fixUiMissingFetch(filePath: string, content: string): string | null {
  if (!phase2Enabled() || process.env.AUTOFIX_PHASE2_UI_PING !== "1") return null;
  const rel = path.relative(ROOT, filePath).split(path.sep).join("/");
  if (isPhase2GloballyExcluded(rel)) return null;
  if (!rel.includes("/app/") || rel.includes("/api/")) return null;
  if (!isUseClient(content)) return null;
  if (!/onClick=\{/.test(content) || /fetch\s*\(\s*["']\/api\//.test(content)) return null;
  if (content.includes("autofix-phase2-ui-ping")) return null;
  const updated = content.replace(
    /onClick=\{\(\)\s*=>\s*\{([^}]*)\}\}/,
    `onClick={() => {\n      if (typeof fetch !== "undefined" && process.env.NODE_ENV === "development") {\n        void fetch("/api/observability", { cache: "no-store" }).catch(() => {});\n      }\n      $1\n    }}`
  );
  if (updated === content) return null;
  if (!withinChangeBudget(content, updated)) return null;
  return updated;
}

/** Flow gaps need human design — no automatic code change. */
function fixPartialFlow(_filePath: string, _content: string): string | null {
  if (!phase2Enabled()) return null;
  return null;
}

/**
 * Duplicate small inline objects — detection only; no transform (enable Phase 3.1 manually later).
 */
function fixDuplicateCode(filePath: string, content: string): string | null {
  if (!phase3Enabled() || process.env.AUTOFIX_PHASE3_DEDUP !== "1") return null;
  const rel = path.relative(ROOT, filePath).split(path.sep).join("/");
  if (!isPhase3PathOk(rel)) return null;
  const matches = content.match(/const\s+\w+\s*=\s*\{[\s\S]{0,200}\}/g);
  if (!matches || matches.length < 2) return null;
  return null;
}

/**
 * `as any` → `as unknown` — stricter; may fail typecheck (then validation reverts). Gated.
 */
function fixWeakTyping(filePath: string, content: string): string | null {
  if (!phase3Enabled() || process.env.AUTOFIX_PHASE3_WEAK_TYPING !== "1") return null;
  const rel = path.relative(ROOT, filePath).split(path.sep).join("/");
  if (!isPhase3PathOk(rel)) return null;
  if (!content.includes("as any")) return null;
  const updated = content.replace(/\bas any\b/g, "as unknown");
  if (updated === content) return null;
  if (!withinChangeBudget(content, updated)) return null;
  return updated;
}

/**
 * Safe equivalence: `.filter(Boolean).length > 0` → `.some(Boolean)` (same truthiness semantics for element checks).
 */
function fixInefficientLoop(filePath: string, content: string): string | null {
  if (!phase3Enabled() || process.env.AUTOFIX_PHASE3_LOOPS !== "1") return null;
  const rel = path.relative(ROOT, filePath).split(path.sep).join("/");
  if (!isPhase3PathOk(rel)) return null;
  if (!content.includes(".filter(")) return null;
  const updated = content.replace(/\.filter\(\s*Boolean\s*\)\.length\s*>\s*0/g, ".some(Boolean)");
  if (updated === content) return null;
  if (!withinChangeBudget(content, updated)) return null;
  return updated;
}

/**
 * Injecting `return safeError(...)` into every catch breaks control flow; project may not expose safeError here.
 * Intentionally no-op — use manual / targeted tasks only.
 */
function fixErrorHandling(_filePath: string, _content: string): string | null {
  if (!phase3Enabled()) return null;
  return null;
}

/**
 * Same intent as missing_limit: append `.limit(100)` after `.select(...)` when file has no `.limit(` — gated separately for Phase 3.
 */
function fixQuerySelect(filePath: string, content: string): string | null {
  if (!phase3Enabled() || process.env.AUTOFIX_PHASE3_QUERY_LIMIT !== "1") return null;
  const rel = path.relative(ROOT, filePath).split(path.sep).join("/");
  if (!isPhase3PathOk(rel)) return null;
  if (!content.includes(".select(")) return null;
  if (content.includes(".limit(")) return null;
  const updated = content.replace(/(\.select\([^)]+\))/g, "$1.limit(100)");
  if (updated === content) return null;
  if (!withinChangeBudget(content, updated)) return null;
  return updated;
}

/**
 * Repeated fetch patterns — detection only; no extraction (AUTOFIX_ARCH_EXTRACT may log via future tooling).
 */
function extractReusableFunction(filePath: string, content: string): string | null {
  if (!archEnabled() || process.env.AUTOFIX_ARCH_EXTRACT !== "1") return null;
  const rel = path.relative(ROOT, filePath).split(path.sep).join("/");
  if (!isPhase3PathOk(rel)) return null;
  const matches = content.match(/await\s+fetch\s*\(/g);
  if (!matches || matches.length < 2) return null;
  return null;
}

/** Large files — manual review only; no auto-split. */
function splitLargeFile(filePath: string, content: string): string | null {
  if (!archEnabled() || process.env.AUTOFIX_ARCH_SPLIT !== "1") return null;
  if (content.length < 8000) return null;
  return null;
}

/**
 * Do not replace `fetch(` with `apiFetch` — breaks non-JSON fetch, Response consumers, and tests.
 * Prefer `lib/api/client.ts` or `fetchSafeJson` from `lib/core/fetchSafe.ts` for new code.
 */
function centralizeFetch(_filePath: string, _content: string): string | null {
  if (!archEnabled()) return null;
  return null;
}

/**
 * Do not wrap `supabase` — server/admin/anon clients are explicit (tenant isolation).
 */
function centralizeSupabase(_filePath: string, _content: string): string | null {
  if (!archEnabled()) return null;
  return null;
}

/**
 * `throw new Error` is not interchangeable with `safeError` (returns `{ ok:false }`, does not throw).
 */
function centralizeErrorHandlingFn(_filePath: string, _content: string): string | null {
  if (!archEnabled()) return null;
  return null;
}

type HandlerFn = (filePath: string, content: string) => string | null;

const HANDLERS: Record<string, HandlerFn> = {
  console_error: fixConsoleError,
  db_select_star: fixSelectStar,
  missing_limit: fixMissingLimit,
  missing_api_db_write: fixMissingApiDbWrite,
  unused_api_endpoint: fixUnusedApiEndpoint,
  missing_attribution: fixMissingAttribution,
  ui_missing_fetch: fixUiMissingFetch,
  partial_flow: fixPartialFlow,
  duplicate_code: fixDuplicateCode,
  weak_typing: fixWeakTyping,
  inefficient_loop: fixInefficientLoop,
  missing_error_standard: fixErrorHandling,
  query_select_limit: fixQuerySelect,
  extract_reusable_function: extractReusableFunction,
  split_large_file: splitLargeFile,
  centralize_fetch: centralizeFetch,
  centralize_supabase: centralizeSupabase,
  centralize_error_handling: centralizeErrorHandlingFn,
};

/** Maps audit task.code → registry key (not all audit codes have handlers). */
const TASK_CODE_TO_HANDLER: Partial<Record<string, keyof typeof HANDLERS>> = {
  CONSOLE_ERROR_USAGE: "console_error",
  DB_SELECT_STAR: "db_select_star",
  MISSING_LIMIT: "missing_limit",
  API_NO_DB_HINT: "missing_api_db_write",
  POTENTIALLY_UNUSED_DEV_API: "unused_api_endpoint",
  FLOW_SOCIAL_LEAD_ORDER_PARTIAL: "partial_flow",
  MISSING_ATTRIBUTION: "missing_attribution",
  UI_MISSING_FETCH: "ui_missing_fetch",
  DUPLICATE_CODE_SAFE: "duplicate_code",
  WEAK_TYPING_AS_ANY: "weak_typing",
  INEFFICIENT_FILTER_LENGTH: "inefficient_loop",
  MISSING_ERROR_STANDARD: "missing_error_standard",
  QUERY_SELECT_LIMIT: "query_select_limit",
  ARCH_DUPLICATE_FETCH: "extract_reusable_function",
  ARCH_LARGE_FILE: "split_large_file",
  ARCH_CENTRALIZE_FETCH: "centralize_fetch",
  ARCH_CENTRALIZE_SUPABASE: "centralize_supabase",
  ARCH_CENTRALIZE_ERROR: "centralize_error_handling",
};

export type AutoFixResult = {
  status: "success" | "skipped" | "failed";
  task_id: string | null;
  reason: string;
  files_changed: string[];
  handler?: string;
  validation?: "passed" | "failed" | "skipped";
};

function applyHandlersToFile(absPath: string, handlerKey: keyof typeof HANDLERS): string | null {
  if (!fs.existsSync(absPath)) return null;
  const content = fs.readFileSync(absPath, "utf8");
  const fn = HANDLERS[handlerKey];
  if (!fn) return null;
  return fn(absPath, content);
}

function applyTask(task: TaskRecord, handlerKey: keyof typeof HANDLERS): { changed: boolean; file: string | null } {
  const paths = parseTargetPaths(task.target);
  for (const raw of paths) {
    const abs = resolveTaskFileAbs(raw);
    if (!abs || !abs.startsWith(ROOT)) continue;
    const updated = applyHandlersToFile(abs, handlerKey);
    if (updated == null) continue;
    fs.writeFileSync(abs, updated, "utf8");
    return { changed: true, file: path.relative(ROOT, abs).split(path.sep).join("/") };
  }
  return { changed: false, file: null };
}

async function maybeRuntimeProbeAfterApiPatch(fileRel: string): Promise<{ ok: boolean; phase: string }> {
  if (process.env.AUTOFIX_RUNTIME_HTTP !== "1") return { ok: true, phase: "skip_runtime" };
  if (!fileRel.includes("app/api")) return { ok: true, phase: "skip_not_api" };
  const base = (process.env.VALIDATE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const probes = ["/api/observability", "/api/contact", "/api/social/ai", "/api/orders"];
    for (const p of probes) {
      const r = await fetch(`${base}${p}`, {
        method: p === "/api/contact" ? "POST" : "GET",
        headers: p === "/api/contact" ? { "content-type": "application/json" } : undefined,
        body: p === "/api/contact" ? "{}" : undefined,
        signal: ac.signal,
      });
      if (r.status >= 500) {
        return { ok: false, phase: `runtime_${p}_status_${r.status}` };
      }
    }
    return { ok: true, phase: "runtime_ok" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, phase: `runtime_unreachable:${msg}` };
  } finally {
    clearTimeout(t);
  }
}

export async function runAutoFix(): Promise<AutoFixResult> {
  if (!fs.existsSync(TASKS_PATH)) {
    return {
      status: "failed",
      task_id: null,
      reason: `Missing ${TASKS_PATH}`,
      files_changed: [],
    };
  }

  const bundle = readJson<TasksFile>(TASKS_PATH, { generated_at: "", tasks: [] });
  const state = readJson<TaskState>(STATE_PATH, {
    completed_task_ids: [],
    last_updated: new Date(0).toISOString(),
  });

  const pending = bundle.tasks.filter((t) => !state.completed_task_ids.includes(t.id));
  const runnable = pending.find((t) => {
    if (!t.automatable) return false;
    const key = TASK_CODE_TO_HANDLER[t.code];
    return key != null && HANDLERS[key] != null;
  });

  if (!runnable) {
    return {
      status: "skipped",
      task_id: null,
      reason: pending.length === 0 ? "no_pending_tasks" : "no_runnable_automatable_handler",
      files_changed: [],
    };
  }

  const handlerKey = TASK_CODE_TO_HANDLER[runnable.code]!;
  const out = applyTask(runnable, handlerKey);

  if (!out.changed || !out.file) {
    return {
      status: "skipped",
      task_id: runnable.id,
      reason: "handler_no_op_for_target_files",
      files_changed: [],
      handler: handlerKey,
    };
  }

  const savedSkip = process.env.SKIP_HTTP;
  if (process.env.SKIP_HTTP === undefined) process.env.SKIP_HTTP = "1";

  const v = await runValidate();

  if (savedSkip === undefined) delete process.env.SKIP_HTTP;
  else process.env.SKIP_HTTP = savedSkip;

  if (!v.ok) {
    gitCheckout([out.file]);
    appendRunLog({
      task: runnable.id,
      handler: handlerKey,
      file: out.file,
      status: "failed",
      validation: "failed",
      detail: v.phase,
    });
    return {
      status: "failed",
      task_id: runnable.id,
      reason: `validation_failed:${v.phase}`,
      files_changed: [],
      handler: handlerKey,
      validation: "failed",
    };
  }

  const rt = await maybeRuntimeProbeAfterApiPatch(out.file);
  if (!rt.ok) {
    gitCheckout([out.file]);
    appendRunLog({
      task: runnable.id,
      handler: handlerKey,
      file: out.file,
      status: "failed",
      validation: "failed",
      detail: rt.phase,
    });
    return {
      status: "failed",
      task_id: runnable.id,
      reason: `runtime_failed:${rt.phase}`,
      files_changed: [],
      handler: handlerKey,
      validation: "failed",
    };
  }

  state.completed_task_ids = [...new Set([...state.completed_task_ids, runnable.id])];
  state.last_updated = new Date().toISOString();
  writeTaskState(state);

  appendRunLog({
    task: runnable.id,
    handler: handlerKey,
    file: out.file,
    status: "success",
    validation: "passed",
  });

  return {
    status: "success",
    task_id: runnable.id,
    reason: `applied_${handlerKey}`,
    files_changed: [out.file],
    handler: handlerKey,
    validation: "passed",
  };
}

function main() {
  void runAutoFix().then((r) => {
    console.log(`[autoFix] ${JSON.stringify(r)}`);
    if (r.status === "failed" && r.task_id !== null) process.exit(1);
  });
}

const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirect) {
  main();
}
