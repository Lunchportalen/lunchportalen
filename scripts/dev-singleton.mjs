import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const workspaceRoot = process.cwd();
const nextCliPath = path.join(workspaceRoot, "node_modules", "next", "dist", "bin", "next");
const forwardedArgs = process.argv.slice(2);
const lockDir = path.join(os.tmpdir(), "lunchportalen-dev-locks");
const workspaceHash = crypto.createHash("sha1").update(workspaceRoot).digest("hex").slice(0, 12);
const lockFile = path.join(lockDir, `${workspaceHash}.json`);

function safeTrim(value) {
  return String(value ?? "").trim();
}

function readRequestedPort() {
  const fromEnv = safeTrim(process.env.PORT);
  if (fromEnv) return fromEnv;

  for (let index = 0; index < forwardedArgs.length; index += 1) {
    const arg = safeTrim(forwardedArgs[index]);
    if ((arg === "--port" || arg === "-p") && forwardedArgs[index + 1]) {
      return safeTrim(forwardedArgs[index + 1]);
    }
  }

  return "3000";
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return safeTrim(error?.code) === "EPERM";
  }
}

function readLock() {
  try {
    if (!fs.existsSync(lockFile)) return null;
    const parsed = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function removeLockIfOwned() {
  try {
    const current = readLock();
    if (!current || current.pid === process.pid) {
      fs.rmSync(lockFile, { force: true });
    }
  } catch {
    // Best effort cleanup only.
  }
}

function ensureSingleton() {
  fs.mkdirSync(lockDir, { recursive: true });

  const existing = readLock();
  if (existing && isProcessRunning(Number(existing.pid))) {
    const runningPort = safeTrim(existing.port) || "unknown";
    const startedAt = safeTrim(existing.startedAt) || "unknown";
    console.error(
      `[dev-singleton] Another dev server is already running for ${workspaceRoot}.`,
    );
    console.error(
      `[dev-singleton] Existing pid=${existing.pid} port=${runningPort} startedAt=${startedAt}.`,
    );
    console.error(
      "[dev-singleton] Stop the existing server before starting another instance.",
    );
    process.exit(1);
  }

  if (existing) {
    fs.rmSync(lockFile, { force: true });
  }

  const payload = {
    pid: process.pid,
    cwd: workspaceRoot,
    port: readRequestedPort(),
    startedAt: new Date().toISOString(),
    argv: forwardedArgs,
  };
  fs.writeFileSync(lockFile, JSON.stringify(payload, null, 2), "utf8");
}

ensureSingleton();

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  removeLockIfOwned();
}

const child = spawn(process.execPath, [nextCliPath, "dev", ...forwardedArgs], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("[dev-singleton] Failed to start next dev.", error);
  cleanup();
  process.exit(1);
});

child.on("exit", (code, signal) => {
  cleanup();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    cleanup();
    if (!child.killed) {
      child.kill(signal);
    }
  });
}

process.on("exit", cleanup);
