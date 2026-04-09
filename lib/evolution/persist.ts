/**
 * Evolution logging: local JSON + stdout (works with `tsx` / CLI).
 * For `ai_activity_log` rows from Next server, use `insertEvolutionAiLog` from `./persistDb.server`.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const LOG_REL = path.join("repo-intelligence", "evolution-log.json");

function appendLocalLog(entry: Record<string, unknown>) {
  const fp = path.join(process.cwd(), LOG_REL);
  let arr: unknown[] = [];
  try {
    const raw = fs.readFileSync(fp, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    arr = Array.isArray(parsed) ? parsed : [];
  } catch {
    arr = [];
  }
  arr.push({ ...entry, ts: new Date().toISOString() });
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(arr, null, 2), "utf8");
}

export async function persistEvolutionEvent(payload: Record<string, unknown>): Promise<void> {
  const line = { ...payload, ts: new Date().toISOString() };
  console.log("[architecture_evolution]", JSON.stringify(line));
  appendLocalLog(line as Record<string, unknown>);
}
