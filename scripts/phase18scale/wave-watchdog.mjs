#!/usr/bin/env node
/**
 * Durable Phase 18 HTTP wave runner + watchdog.
 * Spawns the wave as a child, heartbeats every <=60s, dumps diagnostics
 * after 5 minutes without progress.
 *
 * Cloud mode (PHASE18_LOADCERT=1): never probes local Docker Supabase containers;
 * Next health uses PHASE18_BASE_URL; Postgres health uses PHASE18_DATABASE_URL.
 */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const EVIDENCE = path.join(ROOT, "docs/rc/phase18scale/evidence");
const STALL_MS = Number(process.env.PHASE18_WATCHDOG_STALL_MS || 5 * 60 * 1000);
const BEAT_MS = Number(process.env.PHASE18_WATCHDOG_BEAT_MS || 60 * 1000);

const waveOutName = process.env.PHASE18_HTTP_WAVE_OUT || "http-wave.json";
const progressPath = path.join(EVIDENCE, `${path.parse(waveOutName).name}.progress.ndjson`);
const heartbeatPath = path.join(EVIDENCE, `${path.parse(waveOutName).name}.heartbeat.json`);
const diagDir = path.join(EVIDENCE, "watchdog-dumps");
const outTxt = path.join(EVIDENCE, `${path.parse(waveOutName).name}.out.txt`);

const loadCert = ["1", "true", "yes"].includes(String(process.env.PHASE18_LOADCERT || "").toLowerCase());
const mode = loadCert ? "cloud" : "local";
const baseUrl = String(process.env.PHASE18_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

fs.mkdirSync(EVIDENCE, { recursive: true });
fs.mkdirSync(diagDir, { recursive: true });

function sh(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      timeout: opts.timeout ?? 15000,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      ...opts,
    }).trim();
  } catch (e) {
    return `ERR:${(e.stderr || e.message || "").toString().slice(0, 240)}`;
  }
}

function preventSleep() {
  if (process.platform !== "win32") return;
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class P18Exec{ [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);}' -ErrorAction SilentlyContinue; [void][P18Exec]::SetThreadExecutionState([uint32]2147483649);`,
      ],
      { stdio: "ignore", windowsHide: true },
    );
  } catch {
    /* best-effort */
  }
}

function dockerHealthyLocal() {
  const out = sh("docker", ["info", "--format", "{{.ServerVersion}}"]);
  return Boolean(out) && !out.startsWith("ERR:");
}

async function pgStats() {
  if (mode === "cloud") {
    const url = process.env.PHASE18_DATABASE_URL;
    if (!url) return { mode: "cloud", error: "PHASE18_DATABASE_URL_MISSING" };
    const client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      await client.connect();
      const r = await client.query(
        `select count(*) filter (where state='active')::int as active,
                count(*) filter (where wait_event_type is not null and state<>'idle')::int as waiting,
                count(*)::int as total
         from pg_stat_activity where datname=current_database()`,
      );
      return { mode: "cloud", source: "PHASE18_DATABASE_URL", ...r.rows[0] };
    } catch (e) {
      return { mode: "cloud", source: "PHASE18_DATABASE_URL", error: String(e?.message || e).slice(0, 240) };
    } finally {
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  const sql =
    "select count(*) filter (where state='active') as active, count(*) filter (where wait_event_type is not null and state<>'idle') as waiting, count(*) as total from pg_stat_activity where datname=current_database();";
  const out = sh(
    "docker",
    ["exec", "supabase_db_lunchportalen", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-F", ",", "-c", sql],
    { timeout: 20000 },
  );
  if (out.startsWith("ERR:")) return { mode: "local", error: out };
  const [active, waiting, total] = out.split(",").map((x) => Number(x));
  return { mode: "local", source: "docker:supabase_db_lunchportalen", active, waiting, total };
}

async function nextHealth() {
  const healthUrl = `${baseUrl}/api/health`;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const res = await fetch(healthUrl, { signal: ac.signal });
    clearTimeout(t);
    return { mode, url: healthUrl, status: res.status, ok: res.ok };
  } catch (e) {
    return { mode, url: healthUrl, status: "DOWN", ok: false, error: String(e?.message || e).slice(0, 160) };
  }
}

function readLastProgress() {
  if (!fs.existsSync(progressPath)) return null;
  const lines = fs.readFileSync(progressPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return null;
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

async function writeHeartbeat(extra) {
  const outStat = fs.existsSync(outTxt) ? fs.statSync(outTxt) : null;
  const progress = readLastProgress();
  const beat = {
    stamped_at: new Date().toISOString(),
    mode,
    watchdog_pid: process.pid,
    wave_pid: child?.pid ?? null,
    parent_pid: process.ppid,
    process_start_time: startedAt,
    docker_healthy: mode === "local" ? dockerHealthyLocal() : "n/a_cloud_mode",
    next_health: await nextHealth(),
    postgres: await pgStats(),
    progress,
    output_file: {
      path: outTxt,
      bytes: outStat?.size ?? null,
      mtime: outStat?.mtime?.toISOString?.() ?? null,
    },
    ...extra,
  };
  fs.writeFileSync(heartbeatPath, JSON.stringify(beat, null, 2));
  return beat;
}

async function dumpDiagnostics(reason) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpPath = path.join(diagDir, `stall-${stamp}.json`);
  const dump = await writeHeartbeat({ reason, stall_dump: true });
  fs.writeFileSync(dumpPath, JSON.stringify(dump, null, 2));
  console.error(JSON.stringify({ watchdog: "STALL_DUMP", dumpPath, reason }));
  return dumpPath;
}

preventSleep();
const startedAt = new Date().toISOString();
const waveScript = path.join(__dirname, "http-correctness-wave.mjs");
const logFd = fs.openSync(outTxt, "w");
fs.writeSync(logFd, `# watchdog spawn ${startedAt} mode=${mode}\n`);

const child = spawn(process.execPath, [waveScript], {
  cwd: ROOT,
  env: {
    ...process.env,
    PHASE18_PROGRESS_PATH: progressPath,
    PHASE18_HEARTBEAT_PATH: heartbeatPath,
  },
  detached: true,
  stdio: ["ignore", logFd, logFd],
  windowsHide: true,
});
child.unref();
fs.writeSync(logFd, `# wave_pid=${child.pid}\n`);

let lastProgressAt = Date.now();
let lastDone = -1;
let exitCode = null;
let stallDumped = false;

child.on("exit", (code, signal) => {
  exitCode = code;
  writeHeartbeat({ exited: true, exit_code: code, signal }).then(() => {
    console.log(JSON.stringify({ watchdog: "WAVE_EXIT", exit_code: code, signal, mode, stamped_at: new Date().toISOString() }));
    clearInterval(timer);
    process.exit(code === 0 ? 0 : 2);
  });
});

writeHeartbeat({ phase: "spawned" }).then((beat) => {
  console.log(JSON.stringify({ watchdog: "SPAWNED", wave_pid: child.pid, mode, heartbeatPath, progressPath, outTxt, next_health: beat.next_health }));
});

const timer = setInterval(() => {
  preventSleep();
  const progress = readLastProgress();
  const done = Number(progress?.done ?? -1);
  if (done > lastDone) {
    lastDone = done;
    lastProgressAt = Date.now();
    stallDumped = false;
  }
  writeHeartbeat({ exit_code: exitCode }).then((beat) => {
    const stalledFor = Date.now() - lastProgressAt;
    if (!stallDumped && stalledFor >= STALL_MS && exitCode === null) {
      stallDumped = true;
      dumpDiagnostics(`no_progress_${Math.round(stalledFor / 1000)}s`);
    }
    if (mode === "local" && beat.docker_healthy === false) {
      console.error(JSON.stringify({ watchdog: "DOCKER_UNHEALTHY", stamped_at: beat.stamped_at }));
    }
  });
}, BEAT_MS);

process.on("SIGINT", () => {
  try {
    process.kill(child.pid);
  } catch {
    /* ignore */
  }
  process.exit(130);
});
