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
const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
const base = 'https://lunchportalen-git-staging-lunchportalen.vercel.app';
const headers = {};
if (bypass) {
  headers['x-vercel-protection-bypass'] = bypass;
  headers['x-vercel-set-bypass-cookie'] = 'true';
}

for (const path of ['/api/health', '/api/auth/login']) {
  const res = await fetch(`${base}${path}`, { headers, redirect: 'manual' });
  const text = await res.text();
  console.log(path, res.status, res.headers.get('location') || '', text.slice(0, 120));
}
