/**
 * U97I — Single-run proof chain: local_provider :3054, sanity:live, Playwright, gates, proof-manifest.json
 */
import { execSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ART = path.join(ROOT, "artifacts", "u97i-proof-chain-lock");
const BASE_URL = "http://localhost:3054";

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

/** Stops any existing `npm run dev` (dev-singleton) for this workspace so a fresh :3054 boot is possible. */
function killExistingDevSingleton() {
  try {
    const lf = devSingletonLockPath();
    if (fs.existsSync(lf)) {
      const j = JSON.parse(fs.readFileSync(lf, "utf8"));
      const pid = Number(j?.pid);
      if (Number.isInteger(pid) && pid > 0) {
        killProcessTree(pid);
      }
      fs.rmSync(lf, { force: true });
    }
  } catch {
    /* ignore */
  }
}

function killPort3054() {
  try {
    if (process.platform === "win32") {
      execSync(
        'powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 3054 -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"',
        { stdio: "ignore" },
      );
    } else {
      execSync("lsof -ti:3054 | xargs kill -9 2>/dev/null || true", { shell: true, stdio: "ignore" });
    }
  } catch {
    /* ignore */
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

async function main() {
  const runStartedAt = nowIso();
  const runMark = `u97i-${Date.now()}`;
  let exitCode = 1;

  killExistingDevSingleton();
  killPort3054();
  fs.rmSync(ART, { recursive: true, force: true });
  fs.mkdirSync(ART, { recursive: true });

  const startupCommand = `cross-env PORT=3054 LP_CMS_RUNTIME_MODE=local_provider npm run dev`;
  fs.writeFileSync(path.join(ART, "startup-command.txt"), startupCommand + "\n", "utf8");

  const bootLog = path.join(ART, "boot-stdout.txt");
  const bootStream = fs.createWriteStream(bootLog, { flags: "w" });
  const child = spawn("npm", ["run", "dev"], {
    cwd: ROOT,
    shell: true,
    env: { ...process.env, PORT: "3054", LP_CMS_RUNTIME_MODE: "local_provider" },
  });
  child.stdout?.pipe(bootStream);
  child.stderr?.pipe(bootStream);

  try {
    await waitHealth();

    const sanity = await runCapture("npm", ["run", "sanity:live"], {
      logPath: path.join(ART, "sanity-live-output.txt"),
      env: { SANITY_LIVE_URL: BASE_URL },
    });
    fs.writeFileSync(path.join(ART, "sanity-exit-code.txt"), String(sanity.code), "utf8");

    const playwrightCommand = `cross-env U97I_RUN_MARK=${runMark} CI=1 PLAYWRIGHT_BASE_URL=${BASE_URL} npx playwright test e2e/u97i-proof-chain-lock.e2e.ts --project=chromium --workers=1 --retries=0`;
    fs.writeFileSync(path.join(ART, "playwright-command.txt"), playwrightCommand + "\n", "utf8");

    const pw = await runCapture("npx", ["playwright", "test", "e2e/u97i-proof-chain-lock.e2e.ts", "--project=chromium", "--workers=1", "--retries=0"], {
      logPath: path.join(ART, "playwright-output.txt"),
      env: {
        U97I_RUN_MARK: runMark,
        CI: "1",
        PLAYWRIGHT_BASE_URL: BASE_URL,
        LP_CMS_RUNTIME_MODE: "local_provider",
      },
    });

    const gateDefs = [
      ["typecheck", ["npm", "run", "typecheck"]],
      ["lint", ["npm", "run", "lint"]],
      ["build-enterprise", ["npm", "run", "build:enterprise"]],
      ["test-run", ["npm", "run", "test:run"]],
    ];

    const gateCodes = {};
    for (const [name, parts] of gateDefs) {
      const r = await runCapture(parts[0], parts.slice(1), {
        logPath: path.join(ART, `gate-${name}.txt`),
      });
      gateCodes[name] = r.code;
    }

    const runFinishedAt = nowIso();

    const runtimePath = path.join(ART, "runtime-proof.json");
    if (!fs.existsSync(runtimePath)) {
      throw new Error("Missing runtime-proof.json from Playwright");
    }
    const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));

    const requiredPng = [
      "01-document-types-overview.png",
      "02-compact-page-document-type-workspace.png",
      "03-document-type-dirty-save-state.png",
      "04-create-dialog-parent-to-compact-page.png",
      "05-compact-page-created-visible-in-tree.png",
      "06-compact-page-editor.png",
      "07-create-dialog-compact-page-to-micro-landing.png",
      "08-micro-landing-created-visible-in-tree-editor.png",
      "09-structure-allowed-disallowed-child-proof.png",
      "10-document-type-composition-effect-proof.png",
      "11-template-rendering-binding-proof.png",
      "12-current-document-type-binding-proof.png",
      "13-full-content-tree-editor-after-create-flow.png",
    ];

    const hashes = [];
    const screenshots = [];
    for (const f of requiredPng) {
      const fp = path.join(ART, f);
      if (!fs.existsSync(fp)) throw new Error(`Missing screenshot: ${f}`);
      const st = fs.statSync(fp);
      const mtime = st.mtime.toISOString();
      const t0 = Date.parse(runStartedAt) - 60_000;
      const t1 = Date.parse(runFinishedAt) + 120_000;
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
      const dup = hashes.filter((x, i) => hashes.indexOf(x) !== i);
      throw new Error(`Duplicate screenshot SHA256 — proof chain rejected (${dup[0]?.slice(0, 12)}…)`);
    }

    const manifest = {
      runStartedAt,
      runFinishedAt,
      baseUrl: BASE_URL,
      playwrightCommand,
      playwrightExitCode: pw.code,
      testName: "U97I proof chain lock — single run browser proof",
      createdNodes: runtime.createdNodes,
      runtimeValues: runtime.runtimeValues,
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

    const fail =
      pw.code !== 0 ||
      sanity.code !== 0 ||
      gateCodes.typecheck !== 0 ||
      gateCodes.lint !== 0 ||
      gateCodes["build-enterprise"] !== 0 ||
      gateCodes["test-run"] !== 0;

    fs.writeFileSync(
      path.join(ART, "proof-result.txt"),
      fail ? "IKKE GODKJENT\n" : "GODKJENT\n",
      "utf8",
    );

    exitCode = fail ? 2 : 0;
  } catch (e) {
    console.error(e);
    fs.writeFileSync(path.join(ART, "proof-error.txt"), String(e?.stack ?? e), "utf8");
    exitCode = 1;
  } finally {
    killProcessTree(child.pid);
    killPort3054();
    await new Promise((r) => setTimeout(r, 500));
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
