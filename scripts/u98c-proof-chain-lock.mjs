/**
 * U98C — Fresh-boot proof chain: local_provider :3056, single base URL, sanity:live, Playwright, gates, proof-manifest.json
 */
import { execSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ART = path.join(ROOT, "artifacts", "u98c-proof-chain-lock");
const PORT = "3056";
const BASE_URL = "http://localhost:3056";

function nowIso() {
  return new Date().toISOString();
}

function pngSize(filePath) {
  const b = fs.readFileSync(filePath);
  if (b.length < 24 || b[0] !== 0x89) throw new Error(`Not a PNG: ${filePath}`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function sha256File(filePath) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(filePath));
  return h.digest("hex");
}

function devSingletonLockPath() {
  const workspaceHash = crypto.createHash("sha1").update(ROOT).digest("hex").slice(0, 12);
  return path.join(os.tmpdir(), "lunchportalen-dev-locks", `${workspaceHash}.json`);
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          /* */
        }
      }
    }
  } catch {
    /* */
  }
}

function killExistingDevSingleton(stoppedLines) {
  try {
    const lf = devSingletonLockPath();
    if (fs.existsSync(lf)) {
      const j = JSON.parse(fs.readFileSync(lf, "utf8"));
      const pid = Number(j?.pid);
      if (Number.isInteger(pid) && pid > 0) {
        stoppedLines.push(`Removed dev-singleton lock; killed pid=${pid} port=${j?.port ?? "?"}`);
        killProcessTree(pid);
      }
      fs.rmSync(lf, { force: true });
    }
  } catch (e) {
    stoppedLines.push(`dev-singleton cleanup: ${String(e?.message ?? e)}`);
  }
}

function killPort3056(stoppedLines) {
  try {
    if (process.platform === "win32") {
      let out = "";
      try {
        out = execSync("cmd /c netstat -ano | findstr :3056 | findstr LISTENING", {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch {
        return;
      }
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (/^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
          stoppedLines.push(`killed pid=${pid} (netstat :3056)`);
        } catch {
          /* */
        }
      }
    } else {
      execSync("lsof -ti:3056 | xargs kill -9 2>/dev/null || true", { shell: true, stdio: "pipe" });
      stoppedLines.push("Attempted lsof kill on :3056 (unix)");
    }
  } catch {
    /* */
  }
}

function reportPort3056() {
  try {
    if (process.platform === "win32") {
      try {
        return execSync("cmd /c netstat -ano | findstr :3056 | findstr LISTENING", {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }).trimEnd();
      } catch {
        return "";
      }
    }
    return execSync("ss -tlnp 2>/dev/null | grep :3056 || true; lsof -i :3056 2>/dev/null || true", {
      shell: true,
      encoding: "utf8",
    }).trimEnd();
  } catch (e) {
    return `port report error: ${String(e?.message ?? e)}`;
  }
}

function runCapture(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const logPath = opts.logPath;
    const chunks = [];
    const child = spawn(cmd, args, {
      cwd: ROOT,
      shell: process.platform === "win32",
      env: { ...process.env, ...opts.env },
    });
    child.stdout?.on("data", (d) => {
      chunks.push(d);
    });
    child.stderr?.on("data", (d) => {
      chunks.push(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const buf = Buffer.concat(chunks);
      if (logPath) fs.writeFileSync(logPath, buf, "utf8");
      resolve({ code: code ?? 1, output: buf.toString("utf8") });
    });
  });
}

async function waitHealth(timeoutMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`, { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        fs.writeFileSync(path.join(ART, "health-response.json"), text, "utf8");
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Health check timeout");
}

async function main() {
  const runStartedAt = nowIso();
  let exitCode = 1;
  let child = null;
  /** @type {import('node:fs').WriteStream | null} */
  let bootOut = null;
  /** @type {import('node:fs').WriteStream | null} */
  let bootErr = null;

  fs.rmSync(ART, { recursive: true, force: true });
  fs.mkdirSync(ART, { recursive: true });

  const stoppedLines = [];
  killExistingDevSingleton(stoppedLines);
  killPort3056(stoppedLines);
  await new Promise((r) => setTimeout(r, 800));

  let portReport = reportPort3056();
  let trimmed = (portReport || "").trim();
  let portInUse = trimmed.length > 0;

  if (portInUse) {
    killPort3056(stoppedLines);
    await new Promise((r) => setTimeout(r, 800));
    portReport = reportPort3056();
    trimmed = (portReport || "").trim();
    portInUse = trimmed.length > 0;
  }

  fs.writeFileSync(path.join(ART, "processes-stopped.txt"), stoppedLines.join("\n") + "\n", "utf8");

  fs.writeFileSync(
    path.join(ART, "port-before.txt"),
    [
      `checkedAt: ${nowIso()}`,
      `canonicalBase: ${BASE_URL}`,
      `port: ${PORT}`,
      "netstat -ano | findstr :3056 | findstr LISTENING (win) / ss|lsof :3056 (unix):",
      portReport || "(no output — no listeners or query empty)",
      "",
      portInUse ? "VERDICT: Port 3056 STILL IN USE — aborting proof chain." : "VERDICT: Port 3056 is FREE before boot.",
      "",
    ].join("\n"),
    "utf8",
  );

  if (portInUse) {
    throw new Error("Port 3056 not free after stop/kill — abort");
  }

  const startupCommand = `cross-env PORT=${PORT} LP_CMS_RUNTIME_MODE=local_provider npm run dev`;
  fs.writeFileSync(path.join(ART, "startup-command.txt"), startupCommand + "\n", "utf8");

  bootOut = fs.createWriteStream(path.join(ART, "boot-stdout.txt"), { flags: "w" });
  bootErr = fs.createWriteStream(path.join(ART, "boot-stderr.txt"), { flags: "w" });
  child = spawn("npm", ["run", "dev"], {
    cwd: ROOT,
    shell: true,
    env: { ...process.env, PORT, LP_CMS_RUNTIME_MODE: "local_provider" },
  });
  child.stdout?.pipe(bootOut);
  child.stderr?.pipe(bootErr);

  try {
    await waitHealth();

    const sanity = await runCapture("npm", ["run", "sanity:live"], {
      logPath: path.join(ART, "sanity-output.txt"),
      env: { SANITY_LIVE_URL: BASE_URL },
    });
    fs.writeFileSync(path.join(ART, "sanity-exit-code.txt"), String(sanity.code), "utf8");

    const playwrightCommand = `cross-env LP_E2E_EXTERNAL_SERVER=1 LP_CMS_RUNTIME_MODE=local_provider PLAYWRIGHT_BASE_URL=${BASE_URL} npx playwright test e2e/u98c-proof-chain-lock.e2e.ts --project=chromium --workers=1 --retries=0`;
    fs.writeFileSync(path.join(ART, "playwright-command.txt"), playwrightCommand + "\n", "utf8");

    const pw = await runCapture(
      "npx",
      ["playwright", "test", "e2e/u98c-proof-chain-lock.e2e.ts", "--project=chromium", "--workers=1", "--retries=0"],
      {
        logPath: path.join(ART, "playwright-output.txt"),
        env: {
          ...process.env,
          LP_E2E_EXTERNAL_SERVER: "1",
          LP_CMS_RUNTIME_MODE: "local_provider",
          PLAYWRIGHT_BASE_URL: BASE_URL,
          CI: "1",
        },
      },
    );

    const gateDefs = [
      ["gate-typecheck.txt", "typecheck", ["npm", "run", "typecheck"]],
      ["gate-lint.txt", "lint", ["npm", "run", "lint"]],
      ["gate-build-enterprise.txt", "build-enterprise", ["npm", "run", "build:enterprise"]],
      ["gate-test-run.txt", "test-run", ["npm", "run", "test:run"]],
    ];

    const gateCodes = {};
    for (const [fileName, key, parts] of gateDefs) {
      const r = await runCapture(parts[0], parts.slice(1), {
        logPath: path.join(ART, fileName),
      });
      gateCodes[key] = r.code;
    }

    const runFinishedAt = nowIso();

    const runtimePath = path.join(ART, "playwright-runtime.json");
    if (!fs.existsSync(runtimePath)) {
      throw new Error("Missing playwright-runtime.json from Playwright");
    }
    const rt = JSON.parse(fs.readFileSync(runtimePath, "utf8"));

    const requiredPng = rt.screenshotFiles;
    if (!Array.isArray(requiredPng) || requiredPng.length !== 13) {
      throw new Error("Invalid screenshotFiles in playwright-runtime.json");
    }

    const hashes = [];
    const screenshots = [];
    const t0 = Date.parse(runStartedAt) - 120_000;
    const t1 = Date.parse(runFinishedAt) + 180_000;
    for (const f of requiredPng) {
      const fp = path.join(ART, f);
      if (!fs.existsSync(fp)) throw new Error(`Missing screenshot: ${f}`);
      const st = fs.statSync(fp);
      const mtime = st.mtime.toISOString();
      if (st.mtimeMs < t0 || st.mtimeMs > t1) {
        throw new Error(`Screenshot mtime out of run window: ${f} ${mtime}`);
      }
      const { width, height } = pngSize(fp);
      const sha = sha256File(fp);
      hashes.push(sha);
      screenshots.push({
        file: f,
        sha256: sha,
        width,
        height,
        bytes: st.size,
        mtime,
      });
    }
    const uniq = new Set(hashes);
    if (uniq.size !== hashes.length) {
      throw new Error("Duplicate screenshot SHA256 — proof chain rejected");
    }

    const manifest = {
      runStartedAt,
      runFinishedAt,
      baseUrl: BASE_URL,
      playwrightCommand: rt.playwrightCommand ?? playwrightCommand,
      playwrightExitCode: pw.code,
      usedNodeId: rt.usedNodeId,
      languages: rt.languages,
      runtimeValues: rt.runtimeValues,
      screenshots,
      sanity: { exitCode: sanity.code },
      gates: {
        typecheckExitCode: gateCodes.typecheck,
        lintExitCode: gateCodes.lint,
        buildExitCode: gateCodes["build-enterprise"],
        testRunExitCode: gateCodes["test-run"],
      },
    };

    fs.writeFileSync(path.join(ART, "proof-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    const langsOk =
      Array.isArray(rt.languages) &&
      rt.languages.length >= 2 &&
      rt.languages.some((l) => l.isDefault === true);
    const rv = rt.runtimeValues ?? {};
    const proofOk =
      pw.code === 0 &&
      sanity.code === 0 &&
      gateCodes.typecheck === 0 &&
      gateCodes.lint === 0 &&
      gateCodes["build-enterprise"] === 0 &&
      gateCodes["test-run"] === 0 &&
      langsOk &&
      rv.publishStateAfter === "published" &&
      rv.cultureA &&
      rv.cultureB &&
      rv.invariantFieldAlias &&
      rv.cultureFieldAlias;

    fs.writeFileSync(path.join(ART, "proof-result.txt"), proofOk ? "GODKJENT\n" : "IKKE GODKJENT\n", "utf8");

    exitCode = proofOk ? 0 : 2;
    if (pw.code !== 0 || sanity.code !== 0) exitCode = Math.max(exitCode, 2);
  } catch (e) {
    console.error(e);
    fs.writeFileSync(path.join(ART, "proof-error.txt"), String(e?.stack ?? e), "utf8");
    fs.writeFileSync(path.join(ART, "proof-result.txt"), "IKKE GODKJENT\n", "utf8");
    exitCode = 1;
  } finally {
    if (child?.pid) killProcessTree(child.pid);
    killPort3056([]);
    bootOut?.end();
    bootErr?.end();
    await new Promise((r) => setTimeout(r, 500));
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
