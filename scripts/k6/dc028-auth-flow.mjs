#!/usr/bin/env node
import fs from 'node:fs';

function loadEnv() {
  const out = {};
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"')) v = JSON.parse(v);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv();
const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET;
const base = 'https://staging.app.lunchportalen.no';
const jar = {};

function mergeSetCookie(setCookie) {
  if (!setCookie) return;
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const raw of parts) {
    const pair = raw.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
}
function cookieHeader() {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function buildUrl(path) {
  let url = `${base}${path}`;
  if (bypass) {
    const sep = url.includes('?') ? '&' : '?';
    url += `${sep}x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
  }
  return url;
}

function bypassHeaders(extra = {}) {
  const h = { ...extra };
  if (bypass) {
    h['x-vercel-protection-bypass'] = bypass;
    h['x-vercel-set-bypass-cookie'] = 'true';
  }
  const c = cookieHeader();
  if (c) h.cookie = c;
  return h;
}

async function request(method, path, body) {
  let current = buildUrl(path);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(current, {
      method,
      headers: bypassHeaders({ 'Content-Type': 'application/json' }),
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    mergeSetCookie(res.headers.getSetCookie?.() ?? res.headers.get('set-cookie'));
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      current = loc.startsWith('http') ? loc : new URL(loc, base).toString();
      continue;
    }
    return { status: res.status, text: await res.text(), hop, cookies: [...Object.keys(jar)] };
  }
  return { status: 0, text: 'loop', cookies: [...Object.keys(jar)] };
}

// warmup bypass
const warm = await request('GET', '/api/health');
console.log('warm', warm.status, warm.hop, warm.cookies);

const login = await request('POST', '/api/auth/login', {
  email: env.PLAYWRIGHT_TEST_EMAIL || 'smoke-test@lunchportalen.no',
  password: env.PLAYWRIGHT_TEST_PASSWORD,
});
console.log('login', login.status, login.hop, login.cookies.filter((c) => c.includes('sb')));
console.log('login body', login.text.slice(0, 120));

for (const path of ['/api/week', '/api/orders?date=2026-05-26']) {
  const withBypass = await request('GET', path);
  console.log('withBypass', path, withBypass.status, withBypass.text.slice(0, 120));

  // without bypass query — cookie only
  const res = await fetch(`${base}${path}`, {
    headers: { cookie: cookieHeader() },
    redirect: 'manual',
  });
  const text = await res.text();
  console.log('cookieOnly', path, res.status, text.slice(0, 120));
}
