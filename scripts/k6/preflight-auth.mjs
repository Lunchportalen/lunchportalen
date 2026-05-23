#!/usr/bin/env node
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

const env = loadEnvFile('.env.local');
const email = env.PLAYWRIGHT_TEST_EMAIL || 'smoke-test@lunchportalen.no';
const password = env.PLAYWRIGHT_TEST_PASSWORD || '';
const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET || env.VERCEL_PROTECTION_BYPASS || '';
const base = (
  process.env.K6_BASE_URL ||
  env.K6_STAGING_BASE_URL ||
  'https://lunchportalen-git-staging-lunchportalen.vercel.app'
).replace(/\/$/, '');

let url = `${base}/api/auth/login`;
const headers = { 'Content-Type': 'application/json' };
if (bypass) {
  headers['x-vercel-protection-bypass'] = bypass;
  headers['x-vercel-set-bypass-cookie'] = 'true';
}

const res = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify({ email, password }),
  redirect: 'manual',
});
const text = await res.text();
console.log('status', res.status);
console.log('location', res.headers.get('location') || 'none');
console.log('body', text.slice(0, 400));
console.log('hasPassword', Boolean(password));
console.log('hasBypass', Boolean(bypass));
console.log('base', base);
console.log('email', email);
