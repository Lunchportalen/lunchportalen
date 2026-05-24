#!/usr/bin/env node
/** Verify all 20 pool users can login via app /api/auth/login (staging). */
import fs from 'node:fs';

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnvFile('.env.local'), ...process.env };
const baseUrl = (env.K6_BASE_URL || 'https://staging.app.lunchportalen.no').replace(/\/$/, '');
const password = env.K6_POOL_PASSWORD;
const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET || '';

if (!password) {
  console.error('K6_POOL_PASSWORD missing');
  process.exit(1);
}

async function login(email) {
  const url = `${baseUrl}/api/auth/login?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, ok: body?.ok === true, error: body?.error };
}

async function main() {
  const results = [];
  for (let i = 1; i <= 20; i += 1) {
    const email = `k6-vu-${String(i).padStart(2, '0')}@lunchportalen.no`;
    results.push({ email, ...(await login(email)) });
  }
  const failed = results.filter((r) => r.status !== 200 || !r.ok);
  console.log(`app login probe: ${results.length - failed.length}/${results.length} OK`);
  for (const r of failed) {
    console.log(`  FAIL ${r.email} status=${r.status} error=${r.error ?? 'n/a'}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
