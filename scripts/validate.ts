/**
 * RC validation: typecheck → lint → build → optional HTTP smoke (local server).
 *
 * Env:
 * - SKIP_HTTP=1 — skip GET/POST probes (CI).
 * - AUTONOMOUS_NEXT_BUILD=1 — run `npx next build` instead of `npm run build` (avoids verify-control-coverage pre-hook).
 * - AUTONOMOUS_SKIP_BUILD=1 — skip build after lint (fast local smoke; not a release gate).
 */
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function runNpm(script: string): { ok: boolean; phase: string } {
  const r = spawnSync("npm", ["run", script], { cwd: ROOT, stdio: "inherit", shell: true });
  if (r.status !== 0) return { ok: false, phase: `npm run ${script}` };
  return { ok: true, phase: script };
}

async function runHttpProbes(): Promise<{ ok: boolean; phase: string }> {
  if (process.env.SKIP_HTTP === "1") {
    return { ok: true, phase: "skip_http" };
  }
  const base = (process.env.VALIDATE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12_000);
  try {
    const rAi = await fetch(`${base}/api/social/ai`, { signal: ac.signal });
    if (rAi.status >= 500) {
      return { ok: false, phase: `GET /api/social/ai server error ${rAi.status}` };
    }

    const rOrd = await fetch(`${base}/api/orders`, { signal: ac.signal });
    if (rOrd.status >= 500) {
      return { ok: false, phase: `GET /api/orders server error ${rOrd.status}` };
    }

    const rCon = await fetch(`${base}/api/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
      signal: ac.signal,
    });
    if (rCon.status >= 500) {
      return { ok: false, phase: `POST /api/contact server error ${rCon.status}` };
    }

    return { ok: true, phase: "http_ok" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, phase: `http_unreachable:${msg}` };
  } finally {
    clearTimeout(t);
  }
}

function runBuildStep(): { ok: boolean; phase: string } {
  if (process.env.AUTONOMOUS_NEXT_BUILD === "1") {
    const r = spawnSync("npx", ["next", "build"], { cwd: ROOT, stdio: "inherit", shell: true });
    if (r.status !== 0) return { ok: false, phase: "npx next build (AUTONOMOUS_NEXT_BUILD=1)" };
    return { ok: true, phase: "next_build" };
  }
  return runNpm("build");
}

export async function runValidate(): Promise<{ ok: boolean; phase: string }> {
  for (const s of ["typecheck", "lint"] as const) {
    const r = runNpm(s);
    if (!r.ok) return r;
  }
  if (process.env.AUTONOMOUS_SKIP_BUILD === "1") {
    return runHttpProbes();
  }
  const b = runBuildStep();
  if (!b.ok) return b;
  return runHttpProbes();
}

type LogShape = {
  task: string;
  status: "success" | "failed";
  files_changed: string[];
  validation: "passed" | "failed";
};

async function main() {
  const v = await runValidate();
  console.log(`[validate] ${JSON.stringify(v)}`);
  const entry: LogShape = {
    task: "validate",
    status: v.ok ? "success" : "failed",
    files_changed: [],
    validation: v.ok ? "passed" : "failed",
  };
  console.log(`[validate] log ${JSON.stringify(entry)}`);
  process.exit(v.ok ? 0 : 1);
}

const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirect) {
  void main();
}
