#!/usr/bin/env node
/**
 * Phase 14C.2 — staging runtime preflight (health SHA + stability).
 *
 * Usage:
 *   node scripts/smoke/staging-runtime-preflight.mjs --base https://staging.app.lunchportalen.no --expected-sha <40-char>
 */
import fs from "node:fs";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : "";
}

const base = (arg("--base") || process.env.PLAYWRIGHT_BASE_URL || "").replace(/\/$/, "");
const expectedSha = (arg("--expected-sha") || process.env.EXPECTED_RUNTIME_SHA || "").toLowerCase();
const env = { ...loadEnvFile(".env.local"), ...process.env };
const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET || env.VERCEL_PROTECTION_BYPASS || "";

if (!base) {
  console.error("FAIL: --base required");
  process.exit(1);
}
if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
  console.error("FAIL: --expected-sha must be 40-char git SHA");
  process.exit(1);
}

async function healthOnce() {
  const url = `${base}/api/health?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-vercel-protection-bypass": bypass,
      "x-vercel-set-bypass-cookie": "true",
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`health not JSON status=${res.status} body=${text.slice(0, 120)}`);
  }
  const data = json?.data ?? json;
  const version = String(data?.version ?? data?.release?.git_sha ?? "").toLowerCase();
  return { status: res.status, version, ok: json?.ok === true && data?.ok !== false };
}

let lastVersion = "";
for (let i = 1; i <= 3; i++) {
  const h = await healthOnce();
  lastVersion = h.version;
  if (h.status !== 200 || !h.ok) {
    console.error(`FAIL: health probe ${i}/3 status=${h.status} ok=${h.ok}`);
    process.exit(1);
  }
  if (h.version !== expectedSha) {
    console.error(`FAIL: health probe ${i}/3 version=${h.version || "(empty)"} expected=${expectedSha}`);
    process.exit(1);
  }
  console.log(`OK: health probe ${i}/3 version=${h.version.slice(0, 8)}…`);
}

console.log(`PASS: staging runtime preflight base=${base} sha=${lastVersion}`);
