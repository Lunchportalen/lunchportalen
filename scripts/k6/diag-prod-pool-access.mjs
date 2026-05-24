#!/usr/bin/env node
/** Diagnose prod pool user profile/agreement access (no secrets logged). */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function scanProdEnv() {
  const PROD = 'hkpokyapzarefrgqzkos';
  for (const file of ['.env.prod-k6.tmp', '.env.local.prod-backup', '.env.local']) {
    if (!fs.existsSync(file)) continue;
    let url = '';
    let anon = '';
    let inProd = false;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim().replace(/^"|"$/g, '');
      if (m[1] === 'NEXT_PUBLIC_SUPABASE_URL') {
        inProd = v.includes(PROD);
        if (inProd) url = v;
      }
      if (inProd && (m[1] === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' || m[1] === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')) {
        anon = v;
      }
    }
    if (url && anon) return { url, anon };
  }
  throw new Error('prod supabase env not found');
}

function loadPassword() {
  for (const file of ['.env.local']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (line.startsWith('K6_PROD_PASSWORD=')) {
        return line.slice('K6_PROD_PASSWORD='.length).trim().replace(/^"|"$/g, '');
      }
    }
  }
  throw new Error('K6_PROD_PASSWORD missing');
}

const { url, anon } = scanProdEnv();
const password = loadPassword();
const sb = createClient(url, anon);
const email = 'k6-vu-01@lunchportalen.no';

const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({ email, password });
console.log('auth:', signErr ? `FAIL ${signErr.message}` : `OK user=${signIn.user?.id?.slice(0, 8)}…`);

const uid = signIn.user?.id;
if (!uid) process.exit(1);

const prof = await sb.from('profiles').select('id, company_id, location_id, role, is_active, disabled_at').eq('id', uid).maybeSingle();
console.log('profile:', prof.error ? `ERR ${prof.error.message}` : prof.data ? 'OK' : 'null');

const { data: agr } = await sb.from('agreements').select('id,status,tier').eq('company_id', prof.data?.company_id).eq('status', 'ACTIVE').limit(1);
console.log('agreements (user client):', agr?.length ?? 0, 'rows');

const appLogin = await fetch('https://app.lunchportalen.no/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const loginJson = await appLogin.json();
const cookies = (appLogin.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const weekCookie = await fetch('https://app.lunchportalen.no/api/week', { headers: { cookie: cookies } });
const weekCookieJson = await weekCookie.json().catch(() => ({}));
console.log('app /api/week (cookie):', weekCookie.status, weekCookieJson.error ?? weekCookieJson.message ?? 'ok');

const weekBearer = await fetch('https://app.lunchportalen.no/api/week', {
  headers: { Authorization: `Bearer ${signIn.session?.access_token}` },
});
const weekBearerJson = await weekBearer.json().catch(() => ({}));
console.log('app /api/week (bearer):', weekBearer.status, weekBearerJson.error ?? weekBearerJson.message ?? 'ok');
