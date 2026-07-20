#!/usr/bin/env node
/**
 * Controlled local correctness ramp at concurrency 2.
 * Default stages: 1000 → 2500 → 5000 → 10000.
 * Override with PHASE18_RAMP_STAGES=2500,5000,10000
 * Skips stages that already have gates.pass === true unless PHASE18_FORCE_STAGE=1.
 */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPhase18Env } from "./load-env.mjs";
import { resolvePhase18DatabaseUrl } from "./lib/local-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const EVIDENCE = path.join(ROOT, "docs/rc/phase18scale/evidence");
const concurrency = 2;

loadPhase18Env();
const db = resolvePhase18DatabaseUrl();
const date = process.env.PHASE18_SERVICE_DATE || "2026-07-21";
const STAGES = String(process.env.PHASE18_RAMP_STAGES || "1000,2500,5000,10000")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);
const forceStage = ["1", "true", "yes"].includes(
  String(process.env.PHASE18_FORCE_STAGE || "").toLowerCase(),
);

function preventSleep() {
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class P18Exec{ [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);}' -ErrorAction SilentlyContinue; [void][P18Exec]::SetThreadExecutionState([uint32]2147483649); powercfg /change standby-timeout-ac 0; powercfg /change hibernate-timeout-ac 0;`,
      ],
      { stdio: "ignore", windowsHide: true },
    );
  } catch {
    /* best-effort */
  }
}

function dockerOk() {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", windowsHide: true, timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

function nextOk() {
  try {
    const r = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "try { (Invoke-WebRequest -Uri http://127.0.0.1:3000/api/health -UseBasicParsing -TimeoutSec 5).StatusCode } catch { 'DOWN' }",
      ],
      { encoding: "utf8", windowsHide: true, timeout: 12000 },
    ).trim();
    return r === "200";
  } catch {
    return false;
  }
}

function stageAlreadyPass(outName) {
  const gatePath = path.join(EVIDENCE, `${path.parse(outName).name}.gates.json`);
  if (!fs.existsSync(gatePath)) return false;
  try {
    const g = JSON.parse(fs.readFileSync(gatePath, "utf8"));
    return g.pass === true;
  } catch {
    return false;
  }
}

function writeExit(summary) {
  summary.stamped_end = new Date().toISOString();
  summary.db_target = db.identity;
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, "controlled-ramp-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

function runStage(target) {
  return new Promise((resolve, reject) => {
    const outName = `http-wave-${target}-c${concurrency}-ramp.json`;
    const child = spawn(process.execPath, [path.join(__dirname, "run-ramp-stage.mjs")], {
      cwd: ROOT,
      env: {
        ...process.env,
        PHASE18_HTTP_WAVE: String(target),
        PHASE18_HTTP_CONCURRENCY: String(concurrency),
        PHASE18_HTTP_WAVE_OUT: outName,
        PHASE18_HTTP_TIMEOUT_MS: process.env.PHASE18_HTTP_TIMEOUT_MS || "30000",
        PHASE18_FORCE_ISOLATED_LOCAL: "1",
        PHASE18_SERVICE_DATE: date,
        PHASE18_DATABASE_URL: process.env.PHASE18_DATABASE_URL,
        SUPABASE_LOCAL_DB_URL: process.env.SUPABASE_LOCAL_DB_URL,
      },
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve({ outName, exitCode: 0 });
      else {
        const err = new Error(`stage ${target} exited ${code}`);
        err.exitCode = code;
        err.failingStage = target;
        err.failingCommand = "run-ramp-stage.mjs";
        err.outName = outName;
        reject(err);
      }
    });
  });
}

async function main() {
  preventSleep();
  const summary = {
    phase: "18SCALE",
    kind: "CONTROLLED_RAMP",
    service_date: date,
    concurrency,
    stages_planned: STAGES,
    stages: [],
    db_target: db.identity,
    stamped_start: new Date().toISOString(),
    exit_reason: null,
    failing_stage: null,
    failing_command: null,
    child_exit_code: null,
    final_counters: null,
  };
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, "controlled-ramp.pid"), String(process.pid));

  try {
    for (const target of STAGES) {
      preventSleep();
      const outName = `http-wave-${target}-c${concurrency}-ramp.json`;
      if (!forceStage && stageAlreadyPass(outName)) {
        const gates = JSON.parse(
          fs.readFileSync(path.join(EVIDENCE, `${path.parse(outName).name}.gates.json`), "utf8"),
        );
        summary.stages.push({ ...gates, skipped_http_already_pass: true });
        console.log(JSON.stringify({ ramp: "STAGE_SKIP_ALREADY_PASS", target }));
        continue;
      }
      if (!dockerOk()) {
        summary.exit_reason = "DOCKER_GONE";
        summary.decision = "LOCAL_MACHINE_UNSUITABLE_FOR_SUSTAINED_LOAD";
        summary.APPLICATION_CAPACITY_FAILURE = "NOT_PROVEN";
        summary.failing_stage = target;
        writeExit(summary);
        process.exit(3);
      }
      if (!nextOk()) {
        summary.exit_reason = "NEXT_DOWN";
        summary.decision = "LOCAL_MACHINE_UNSUITABLE_FOR_SUSTAINED_LOAD";
        summary.APPLICATION_CAPACITY_FAILURE = "NOT_PROVEN";
        summary.failing_stage = target;
        writeExit(summary);
        process.exit(3);
      }
      console.log(JSON.stringify({ ramp: "STAGE_START", target, concurrency, date }));
      const { outName: doneOut } = await runStage(target);
      const gates = JSON.parse(
        fs.readFileSync(path.join(EVIDENCE, `${path.parse(doneOut).name}.gates.json`), "utf8"),
      );
      summary.stages.push(gates);
      summary.final_counters = gates.wave || {
        SET_OK: gates.PERSISTED_SET_SUCCESS,
        CANCEL_OK: gates.PERSISTED_CANCELLATION_SUCCESS,
      };
      if (!gates.pass) {
        summary.pass = false;
        summary.exit_reason = "STAGE_GATES_FAIL";
        summary.failing_stage = target;
        summary.failing_command = "reconcile-stage-gates.mjs";
        summary.child_exit_code = 2;
        writeExit(summary);
        process.exit(2);
      }
      console.log(JSON.stringify({ ramp: "STAGE_PASS", target }));
    }

    summary.pass = true;
    summary.exit_reason = "ALL_STAGES_PASS";
    summary.LOCAL_CORRECTNESS_HTTP_RAMP = "PASS";
    writeExit(summary);
    process.exit(0);
  } catch (e) {
    summary.pass = false;
    summary.exit_reason = e.exit_reason || e.message || "UNHANDLED";
    summary.failing_stage = e.failingStage || summary.failing_stage;
    summary.failing_command = e.failingCommand || null;
    summary.child_exit_code = e.exitCode ?? null;
    summary.error = String(e.message || e);
    writeExit(summary);
    process.exit(e.exitCode || 1);
  }
}

main();
