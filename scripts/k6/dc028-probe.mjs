#!/usr/bin/env node
import fs from 'node:fs';

function readBypass() {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('VERCEL_AUTOMATION_BYPASS_SECRET=')) continue;
    let v = line.slice('VERCEL_AUTOMATION_BYPASS_SECRET='.length).trim();
    if (v.startsWith('"')) v = JSON.parse(v);
    return v;
  }
  return '';
}

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
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function probe(label, startUrl, headers = {}) {
  let current = startUrl;
  for (let hop = 0; hop < 8; hop += 1) {
    const h = { ...headers };
    const c = cookieHeader();
    if (c) h.cookie = c;
    const res = await fetch(current, { redirect: 'manual', headers: h });
    const setCookie = res.headers.getSetCookie?.() ?? res.headers.get('set-cookie');
    mergeSetCookie(setCookie);
    const loc = res.headers.get('location') || '';
    const ct = res.headers.get('content-type') || '';
    console.log(
      `[${label}] hop=${hop} status=${res.status} ct=${ct.split(';')[0]} loc=${loc.slice(0, 80)} cookies=${Object.keys(jar).join(',')}`,
    );
    if (res.status < 300 || res.status >= 400 || !loc) {
      const text = await res.text();
      console.log(`  body: ${text.slice(0, 150).replace(/\s+/g, ' ')}`);
      return res.status;
    }
    current = loc.startsWith('http') ? loc : new URL(loc, current).toString();
  }
  console.log(`[${label}] redirect loop`);
  return 0;
}

const bypass = readBypass();
console.log('bypass len', bypass.length, 'prefix', bypass.slice(0, 6));
const base = process.argv[2] || 'https://staging.app.lunchportalen.no';
const path = process.argv[3] || '/api/health';

const url = `${base}${path}?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
await probe('with-jar', url, {
  'x-vercel-protection-bypass': bypass,
  'x-vercel-set-bypass-cookie': 'true',
});

await probe('root-warmup', `${base}/?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`, {
  'x-vercel-protection-bypass': bypass,
  'x-vercel-set-bypass-cookie': 'true',
});
await probe('health-after-root', `${base}${path}`, {});
