#!/usr/bin/env node
/**
 * Deterministic autofix for Phase 18 / launch controller failures.
 * Smallest focused change only. Never prints secrets. Never touches prod/staging refs.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const RESOLVE = path.join(ROOT, "scripts/phase18scale/resolve-cloud-target.mjs");
const PROOF = path.join(ROOT, "scripts/phase18scale/auth-refresh-coverage-proof.mjs");

function sh(cmd, args) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function bumpPoolerRetries() {
  let src = fs.readFileSync(RESOLVE, "utf8");
  if (!src.includes("probePoolerAuthWithRetries")) {
    throw new Error("resolve-cloud-target missing probePoolerAuthWithRetries");
  }
  let changed = false;
  if (src.includes('attempts: 6,\n  label: "initial"')) {
    src = src.replace('attempts: 6,\n  label: "initial"', 'attempts: 10,\n  label: "initial"');
    changed = true;
  }
  if (src.includes("connectionTimeoutMillis: 30000")) {
    src = src.replace("connectionTimeoutMillis: 30000", "connectionTimeoutMillis: 45000");
    changed = true;
  }
  if (src.includes("await new Promise((r) => setTimeout(r, 1000 * attempt));")) {
    src = src.replace(
      "await new Promise((r) => setTimeout(r, 1000 * attempt));",
      "await new Promise((r) => setTimeout(r, 2500 * attempt));",
    );
    changed = true;
  }
  if (!changed) {
    console.log(JSON.stringify({ autofix: "noop", reason: "pooler_retry_already_tuned" }));
    return false;
  }
  fs.writeFileSync(RESOLVE, src);
  console.log(JSON.stringify({ autofix: "applied", file: "resolve-cloud-target.mjs", class: "NETWORK_OR_POOLER_ERROR" }));
  return true;
}

function hardenApiKeysResolution() {
  let src = fs.readFileSync(RESOLVE, "utf8").replace(/\r\n/g, "\n");
  if (src.includes("PHASE18_PROJECT_NOT_FOUND") && src.includes("fetchApiKeysWithRetry")) {
    console.log(JSON.stringify({ autofix: "noop", reason: "api_keys_hardening_already_present" }));
    return false;
  }

  const helper = `
async function fetchProjectOrThrow() {
  const projRes = await fetchJson(\`https://api.supabase.com/v1/projects/\${ref}\`, {
    headers: { Authorization: \`Bearer \${token}\` },
  });
  if (!projRes.ok) {
    if (projRes.status === 404 || projRes.status === 400) {
      console.error(\`PHASE18_PROJECT_NOT_FOUND: project HTTP \${projRes.status}\`);
    } else {
      console.error(\`project HTTP \${projRes.status}\`);
    }
    process.exit(2);
  }
  const status = String(projRes.body?.status || "").toLowerCase();
  if (status && !["active_healthy", "active_unhealthy", "coming_up"].includes(status)) {
    console.error(\`PHASE18_PROJECT_NOT_ACTIVE: status=\${status || "unknown"}\`);
    process.exit(2);
  }
  return projRes;
}

async function fetchApiKeysWithRetry() {
  let last = { ok: false, status: 0, body: null };
  for (let attempt = 1; attempt <= 4; attempt++) {
    last = await fetchJson(\`https://api.supabase.com/v1/projects/\${ref}/api-keys\`, {
      headers: { Authorization: \`Bearer \${token}\` },
    });
    if (last.ok) return last;
    if (last.status === 404 || (last.status === 400 && attempt >= 2)) {
      console.error(\`PHASE18_PROJECT_NOT_FOUND: api-keys HTTP \${last.status}\`);
      process.exit(2);
    }
    console.error(JSON.stringify({ phase18_api_keys_retry: { attempt, status: last.status } }));
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  console.error(\`api-keys HTTP \${last.status}\`);
  process.exit(2);
}

`;

  if (!src.includes("async function fetchProjectOrThrow")) {
    const anchor = "async function fetchJson(url, init) {";
    if (!src.includes(anchor)) throw new Error("resolve-cloud-target missing fetchJson");
    src = src.replace(anchor, `${helper}${anchor}`);
  }

  const oldBlock = `const keysRes = await fetchJson(\`https://api.supabase.com/v1/projects/\${ref}/api-keys\`, {
  headers: { Authorization: \`Bearer \${token}\` },
});
if (!keysRes.ok) {
  console.error(\`api-keys HTTP \${keysRes.status}\`);
  process.exit(2);
}
const keys = Array.isArray(keysRes.body) ? keysRes.body : [];
const anon = keys.find((k) => k.name === "anon" || k.name === "publishable");
const service = keys.find((k) => k.name === "service_role" || k.name === "secret");
if (!anon?.api_key || !service?.api_key) {
  console.error("missing anon/service_role keys");
  process.exit(2);
}

const projRes = await fetchJson(\`https://api.supabase.com/v1/projects/\${ref}\`, {
  headers: { Authorization: \`Bearer \${token}\` },
});
if (!projRes.ok) {
  console.error(\`project HTTP \${projRes.status}\`);
  process.exit(2);
}
const region = String(projRes.body?.region || "").trim();`;

  const newBlock = `const projRes = await fetchProjectOrThrow();
const keysRes = await fetchApiKeysWithRetry();
const keys = Array.isArray(keysRes.body) ? keysRes.body : [];
const anon = keys.find((k) => k.name === "anon" || k.name === "publishable");
const service = keys.find((k) => k.name === "service_role" || k.name === "secret");
if (!anon?.api_key || !service?.api_key) {
  console.error("missing anon/service_role keys");
  process.exit(2);
}
const region = String(projRes.body?.region || "").trim();`;

  if (!src.includes("const keysRes = await fetchJson(`https://api.supabase.com/v1/projects/${ref}/api-keys`")) {
    // Already reordered / partially patched
    if (src.includes("fetchApiKeysWithRetry")) {
      fs.writeFileSync(RESOLVE, src);
      console.log(JSON.stringify({ autofix: "applied", file: "resolve-cloud-target.mjs", note: "helpers_only" }));
      return true;
    }
    throw new Error("unexpected resolve-cloud-target api-keys block");
  }

  if (!src.includes(oldBlock)) {
    throw new Error("resolve-cloud-target api-keys block mismatch — refusing unsafe patch");
  }
  src = src.replace(oldBlock, newBlock);
  fs.writeFileSync(RESOLVE, src);
  console.log(
    JSON.stringify({
      autofix: "applied",
      file: "resolve-cloud-target.mjs",
      class: "RESOURCE_EXPIRATION",
      note: "project probe before api-keys + PHASE18_PROJECT_NOT_FOUND",
    }),
  );
  return true;
}

function bumpAuthRateLimit() {
  let src = fs.readFileSync(PROOF, "utf8");
  if (src.includes("rate_limit_pause_ms: 90000")) {
    src = src.replace("rate_limit_pause_ms: 90000", "rate_limit_pause_ms: 120000");
    src = src.replace("await sleep(90000);", "await sleep(120000);");
    fs.writeFileSync(PROOF, src);
    console.log(JSON.stringify({ autofix: "applied", file: "auth-refresh-coverage-proof.mjs" }));
    return true;
  }
  console.log(JSON.stringify({ autofix: "noop", reason: "auth_rate_limit_already_tuned" }));
  return false;
}

function main() {
  const errorClass = String(process.env.AUTOFIX_ERROR_CLASS || "");
  const fingerprint = String(process.env.AUTOFIX_FINGERPRINT || "");
  const runId = String(process.env.AUTOFIX_RUN_ID || "");
  const errorText = String(process.env.AUTOFIX_ERROR || "");
  console.log(JSON.stringify({ autofix_start: { errorClass, fingerprint, runId } }));

  let changed = false;
  if (
    errorClass === "RESOURCE_EXPIRATION" ||
    /api-keys HTTP|PHASE18_PROJECT_NOT_FOUND|project HTTP/i.test(errorText)
  ) {
    changed = hardenApiKeysResolution() || changed;
  } else if (errorClass === "NETWORK_OR_POOLER_ERROR") {
    changed = bumpPoolerRetries() || changed;
    changed = hardenApiKeysResolution() || changed;
  } else if (errorClass === "RATE_LIMIT_ERROR" || errorClass === "AUTH_OR_SESSION_ERROR") {
    changed = bumpAuthRateLimit() || changed;
  } else if (/source-and-target-safety|api-keys|resolve isolated/i.test(`${process.env.AUTOFIX_JOB || ""}\n${errorText}`)) {
    changed = hardenApiKeysResolution() || changed;
  } else {
    console.log(JSON.stringify({ autofix: "noop", reason: "no_deterministic_patch_for_class", errorClass }));
  }

  if (changed) {
    try {
      sh("node", ["scripts/phase18scale/lib/pooler-auth-errors.test.mjs"]);
      sh("node", ["--check", "scripts/phase18scale/resolve-cloud-target.mjs"]);
    } catch (e) {
      console.error(String(e?.stderr || e?.message || e));
      process.exit(2);
    }
  }

  fs.mkdirSync(path.join(ROOT, "docs/rc/autonomous-release"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "docs/rc/autonomous-release/LAST-AUTOFIX.json"),
    `${JSON.stringify(
      {
        errorClass,
        fingerprint,
        runId,
        changed,
        stamped_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed ? "true" : "false"}\n`);
  }
}

main();
