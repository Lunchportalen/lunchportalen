/**
 * Deterministic filesystem heuristics for architecture smells (no AST; fast).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { globSync } from "glob";

import type { AnalysisResult, EvolutionIssue, Severity } from "./types";

const SCAN_GLOBS = ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"] as const;
const IGNORE = ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/studio/**"] as const;

function readUtf8(p: string): string {
  return fs.readFileSync(p, "utf8");
}

function lineCount(content: string): number {
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

function collectFiles(root: string): string[] {
  const out = new Set<string>();
  for (const g of SCAN_GLOBS) {
    const files = globSync(g, {
      cwd: root,
      nodir: true,
      ignore: [...IGNORE],
    });
    for (const f of files) {
      out.add(path.join(root, f).split(path.sep).join("/"));
    }
  }
  return [...out].sort();
}

const FROM_RE = /\.from\s*\(\s*["']([a-z_][a-z0-9_]*)["']\s*\)/gi;
const IMPORT_RE = /from\s*["']([^"']+)["']/g;

/** Hot platform modules — high fan-in is expected; not reported as coupling smells. */
const COUPLING_ALLOW = new Set<string>([
  "@/lib/http/respond",
  "@/lib/http/routeGuard",
  "@/lib/http/withApiAiEntrypoint",
  "@/lib/http/withObservability",
  "@/lib/supabase/admin",
  "@/lib/supabase/server",
  "@/lib/ops/log",
  "@/lib/date/oslo",
]);

function extractImports(content: string): string[] {
  const s = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(IMPORT_RE.source, "g");
  while ((m = re.exec(content)) !== null) {
    const spec = m[1]!.trim();
    if (spec.startsWith("@/")) s.add(spec);
  }
  return [...s];
}

function extractFromTables(content: string): string[] {
  const t = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(FROM_RE.source, "gi");
  while ((m = re.exec(content)) !== null) {
    t.add(m[1]!);
  }
  return [...t];
}

function basename(p: string): string {
  return path.basename(p);
}

export function analyzeSystem(root: string = process.cwd()): AnalysisResult {
  const generated_at = new Date().toISOString();
  const files = collectFiles(root);
  const issues: EvolutionIssue[] = [];

  const importCounts = new Map<string, number>();
  const basenameCounts = new Map<string, number>();
  let fetchTotal = 0;
  const tableCounts = new Map<string, number>();

  for (const abs of files) {
    let content: string;
    try {
      content = readUtf8(abs);
    } catch {
      continue;
    }
    const rel = path.relative(root, abs).split(path.sep).join("/");
    const lines = lineCount(content);

    if (lines > 1000) {
      issues.push({
        type: "large_file",
        target: rel,
        severity: "high",
        detail: `${lines} lines`,
        metrics: { lines },
      });
    } else if (lines > 500) {
      issues.push({
        type: "large_file",
        target: rel,
        severity: "medium",
        detail: `${lines} lines`,
        metrics: { lines },
      });
    }

    const bn = basename(rel);
    basenameCounts.set(bn, (basenameCounts.get(bn) ?? 0) + 1);

    for (const spec of extractImports(content)) {
      importCounts.set(spec, (importCounts.get(spec) ?? 0) + 1);
    }

    fetchTotal += (content.match(/\bfetch\s*\(/g) ?? []).length;

    for (const tbl of extractFromTables(content)) {
      tableCounts.set(tbl, (tableCounts.get(tbl) ?? 0) + 1);
    }
  }

  const skipBasenames = new Set(["route.ts", "route.tsx", "page.tsx", "layout.tsx", "loading.tsx", "error.tsx"]);
  for (const [bn, c] of basenameCounts) {
    if (c >= 5 && !skipBasenames.has(bn)) {
      issues.push({
        type: "duplication",
        target: bn,
        severity: c >= 10 ? "high" : "medium",
        detail: `${c} files named ${bn}`,
        metrics: { count: c },
      });
    }
  }

  const sortedImports = [...importCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [spec, c] of sortedImports.slice(0, 12)) {
    if (!spec.startsWith("@/lib/") || COUPLING_ALLOW.has(spec)) continue;
    if (c >= 55) {
      issues.push({
        type: "coupling",
        target: spec,
        severity: c >= 120 ? "high" : "medium",
        detail: `imported in ${c} files`,
        metrics: { files: c },
      });
    }
  }

  if (fetchTotal >= 180) {
    issues.push({
      type: "repeated_api_pattern",
      target: "fetch(…)",
      severity: fetchTotal >= 400 ? "high" : "medium",
      detail: `~${fetchTotal} fetch( calls in scanned tree`,
      metrics: { fetch_calls: fetchTotal },
    });
  }

  const sortedTables = [...tableCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [tbl, c] of sortedTables.slice(0, 3)) {
    if (c >= 35) {
      issues.push({
        type: "repeated_db_pattern",
        target: tbl,
        severity: c >= 70 ? "high" : "medium",
        detail: `.from("${tbl}") ~${c} times`,
        metrics: { from_calls: c },
      });
    }
  }

  /** Heuristic: many `.rpc(` or `orderWrite` string hits — flag for human review only. */
  let rpcHits = 0;
  for (const abs of files) {
    try {
      const content = readUtf8(abs);
      rpcHits += (content.match(/\.rpc\s*\(/g) ?? []).length;
    } catch {
      /* skip */
    }
  }
  if (rpcHits >= 60) {
    issues.push({
      type: "repeated_business_logic",
      target: "rpc/order paths",
      severity: "medium",
      detail: `~${rpcHits} .rpc( occurrences in scanned tree`,
      metrics: { rpc_calls: rpcHits },
    });
  }

  issues.sort((a, b) => {
    const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
    return rank[a.severity] - rank[b.severity] || a.target.localeCompare(b.target);
  });

  return {
    issues: issues.slice(0, 50),
    generated_at,
    root: path.resolve(root),
    files_scanned: files.length,
  };
}
