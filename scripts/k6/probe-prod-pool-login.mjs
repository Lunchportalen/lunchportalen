#!/usr/bin/env node
/** SP-4 live prod read-path probe (k6-vu-01). */
import fs from 'node:fs';

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
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

const env = { ...loadEnv('.env.local'), ...process.env };
const base = 'https://app.lunchportalen.no';
const email = 'k6-vu-01@lunchportalen.no';
const password = env.K6_PROD_PASSWORD;

if (!password) {
  console.error('missing K6_PROD_PASSWORD');
  process.exit(1);
}

const loginRes = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const loginJson = await loginRes.json().catch(() => ({}));
const setCookie = loginRes.headers.getSetCookie?.() ?? [];
if (setCookie.length === 0 && loginRes.headers.get('set-cookie')) {
  // Node fetch fallback: split on comma before sb- cookie names
  const raw = loginRes.headers.get('set-cookie');
  for (const part of raw.split(/,(?=sb-)/)) setCookie.push(part.trim());
}
const cookieHeader = setCookie.map((c) => c.split(';')[0]).join('; ');

console.log(
  `login: ${loginRes.status} ok=${loginJson.ok === true} cookies=${setCookie.length} names=${setCookie.map((c) => c.split('=')[0]).join(',')} role=${loginJson.role ?? 'null'}`,
);

let fail = loginRes.status !== 200 || loginJson.ok !== true || !cookieHeader;

const accessToken = loginJson?.data?.session?.access_token ?? '';

for (const path of ['/api/week', '/api/orders', '/api/me']) {
  const r = await fetch(`${base}${path}`, {
    headers: {
      cookie: cookieHeader,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  const j = await r.json().catch(() => ({}));
  let note = 'bad';
  if (path === '/api/me' && r.status === 200 && j.ok === true && j.data?.user?.email) note = 'profile_ok';
  if (path === '/api/week' && r.status === 200 && j.ok === true) note = 'week_ok';
  if (path === '/api/orders' && r.status === 200 && j.ok === true) note = 'orders_ok';
  if (r.status !== 200 || j.ok !== true) {
    note += ` code=${j.error ?? j.code ?? 'n/a'} msg=${String(j.message ?? '').slice(0, 80)}`;
  }
  console.log(`${path}: ${r.status} ${note}`);
  if (r.status !== 200 || j.ok !== true) fail = true;
}

process.exit(fail ? 1 : 0);
