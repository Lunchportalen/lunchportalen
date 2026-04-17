/**
 * Query engine over repo-intelligence/*.json (facts only; no repo file reads).
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INTEL_DIR = path.join(__dirname, "..", "..", "repo-intelligence");

export type QueryResult = {
  query: string;
  kind: string;
  answer: unknown;
  confidence: "confirmed" | "inferred";
  sources: string[];
};

function readJson<T>(name: string): T | null {
  const p = path.join(INTEL_DIR, name);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Supported structured queries (deterministic keyword routing). */
export function queryRepo(question: string): QueryResult {
  const q = normalize(question);
  const sources: string[] = [];

  const dbMap = readJson<{ tables: Record<string, { used_in: string[] }> }>("db-map.json");
  const flows = readJson<{ flows: Array<{ name: string; confidence: string; steps: string[]; inference: string }> }>(
    "flows.json"
  );
  const apiMap = readJson<{ endpoints: Array<{ route: string; file: string; uses_tables: string[] }> }>("api-map.json");
  const errors = readJson<{ gaps: Array<{ type: string; description: string }> }>("errors.json");

  if (dbMap) sources.push("db-map.json");
  if (flows) sources.push("flows.json");
  if (apiMap) sources.push("api-map.json");
  if (errors) sources.push("errors.json");

  /* where is X used */
  const whereM = q.match(/where\s+is\s+([a-z_][a-z0-9_]*)\s+used/);
  if (whereM && dbMap) {
    const table = whereM[1];
    const entry = dbMap.tables[table];
    return {
      query: question,
      kind: "table_usage",
      answer: entry ? { table, used_in: entry.used_in } : { table, used_in: [] },
      confidence: "confirmed",
      sources,
    };
  }

  /* social flow */
  if (q.includes("social") && (q.includes("flow") || q.includes("funnel"))) {
    const list = flows?.flows?.filter((f) => f.name.includes("social")) ?? [];
    return {
      query: question,
      kind: "social_flow",
      answer: list,
      confidence: "confirmed",
      sources,
    };
  }

  /* which API writes / uses table */
  const apiTable = q.match(/which\s+api\s+(?:writes|uses)\s+([a-z_][a-z0-9_]*)/);
  if (apiTable && apiMap) {
    const table = apiTable[1];
    const hits = apiMap.endpoints.filter((e) => e.uses_tables.includes(table));
    return {
      query: question,
      kind: "api_table_usage",
      answer: {
        table,
        note: "Static scan: supabase.from() only; does not distinguish read vs write.",
        endpoints: hits.map((h) => ({ route: h.route, file: h.file })),
      },
      confidence: "inferred",
      sources,
    };
  }

  /* broken flows / gaps */
  if (q.includes("broken") || q.includes("gap")) {
    return {
      query: question,
      kind: "errors_gaps",
      answer: errors?.gaps ?? [],
      confidence: "confirmed",
      sources,
    };
  }

  return {
    query: question,
    kind: "unknown",
    answer: {
      hint: "Try: where is lead_pipeline used | what is social flow | which api uses orders | find broken flows",
    },
    confidence: "confirmed",
    sources,
  };
}

export function loadIntelSnapshotForAi(): {
  meta: unknown;
  repoMapSummary: { file_count: number };
  routes: unknown;
  apiMap: unknown;
  dbMap: unknown;
  flows: unknown;
} | null {
  const meta = readJson("meta.json");
  const repoMap = readJson<{ files: unknown[] }>("repo-map.json");
  const routes = readJson("routes.json");
  const apiMap = readJson("api-map.json");
  const dbMap = readJson("db-map.json");
  const flows = readJson("flows.json");
  if (!meta && !repoMap) return null;
  return {
    meta,
    repoMapSummary: { file_count: Array.isArray(repoMap?.files) ? repoMap.files.length : 0 },
    routes,
    apiMap,
    dbMap,
    flows,
  };
}
