#!/usr/bin/env node
/**
 * Run one HTTP correctness ramp stage under the durable watchdog,
 * then reconcile persisted gates against verified local Postgres only.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPhase18Env } from "./load-env.mjs";
import { resolvePhase18DatabaseUrl } from "./lib/local-db.mjs";
import { requirePrimaryServiceDate } from "./lib/run-service-date.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const EVIDENCE = path.join(ROOT, "docs/rc/phase18scale/evidence");

loadPhase18Env();
resolvePhase18DatabaseUrl();

function resolveServiceDate() {
  return requirePrimaryServiceDate();
}

const target = Number(process.env.PHASE18_HTTP_WAVE || 0);
const concurrency = Number(process.env.PHASE18_HTTP_CONCURRENCY || 2);
const date = resolveServiceDate();
const outName = process.env.PHASE18_HTTP_WAVE_OUT || `http-wave-${target}-c${concurrency}.json`;
const skipHttp = ["1", "true", "yes"].includes(
  String(process.env.PHASE18_SKIP_HTTP || "").toLowerCase(),
);

if (!target) {
  console.error("PHASE18_HTTP_WAVE required");
  process.exit(1);
}

function runNode(script, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve(code);
      else reject(Object.assign(new Error(`${path.basename(script)} exited ${code}`), { exitCode: code, script }));
    });
  });
}

async function main() {
  const loadCert = ["1", "true", "yes"].includes(
    String(process.env.PHASE18_LOADCERT || "").toLowerCase(),
  );
  const modeEnv = loadCert
    ? { PHASE18_LOADCERT: "1" }
    : { PHASE18_FORCE_ISOLATED_LOCAL: "1" };
  console.log(JSON.stringify({ stage: "start", target, concurrency, outName, skipHttp, loadCert }));
  if (!skipHttp) {
    await runNode(path.join(__dirname, "wave-watchdog.mjs"), {
      PHASE18_HTTP_WAVE: String(target),
      PHASE18_HTTP_CONCURRENCY: String(concurrency),
      PHASE18_HTTP_WAVE_OUT: outName,
      PHASE18_SERVICE_DATE: date,
      ...modeEnv,
    });
  }
  await runNode(path.join(__dirname, "reconcile-stage-gates.mjs"), {
    PHASE18_HTTP_WAVE: String(target),
    PHASE18_HTTP_CONCURRENCY: String(concurrency),
    PHASE18_HTTP_WAVE_OUT: outName,
    PHASE18_SERVICE_DATE: date,
    ...modeEnv,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(e.exitCode || 1);
});
