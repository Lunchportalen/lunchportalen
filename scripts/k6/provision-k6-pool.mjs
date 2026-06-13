#!/usr/bin/env node
/**
 * Provision K6 VU pool passwords on staging (20 users).
 * Run after migration 20260624120100_k6_test_users.sql.
 *
 *   node scripts/k6/provision-k6-pool.mjs
 *
 * Writes K6_POOL_PASSWORD to .env.local (never commit).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const POOL_SIZE = 20;
const COMPANY_ID = '8b0b8fa4-8d89-4795-b92b-e09129dd635f';

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

function mergeEnvLocal(updates) {
  const file = path.join(process.cwd(), '.env.local');
  const existing = loadEnvFile(file);
  const merged = { ...existing, ...updates };
  const lines = Object.entries(merged).map(([k, v]) => {
    const needsQuote = /[\s#"'\\]/.test(v);
    return `${k}=${needsQuote ? JSON.stringify(v) : v}`;
  });
  fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
}

function poolEmail(n) {
  return `k6-vu-${String(n).padStart(2, '0')}@lunchportalen.no`;
}

async function listUsers(url, serviceKey, email) {
  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const json = await res.json();
  const users = json?.users ?? [];
  return users.find((u) => String(u.email ?? '').toLowerCase() === email.toLowerCase()) ?? null;
}

async function resetPassword(url, serviceKey, userId, password) {
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password, email_confirm: true }),
  });
  return res.status;
}

async function verifyLogin(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.status;
}

async function main() {
  const env = { ...loadEnvFile('.env.local'), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) {
    console.error('Missing SUPABASE_URL / SERVICE_ROLE / ANON key in .env.local');
    process.exit(1);
  }

  const password = crypto.randomBytes(24).toString('base64url');
  let updated = 0;
  let missing = 0;

  for (let i = 1; i <= POOL_SIZE; i += 1) {
    const email = poolEmail(i);
    const user = await listUsers(url, serviceKey, email);
    if (!user?.id) {
      missing += 1;
      console.warn(`missing: ${email} (run migration 20260624120100_k6_test_users first)`);
      continue;
    }
    const status = await resetPassword(url, serviceKey, user.id, password);
    if (status >= 200 && status < 300) {
      updated += 1;
    } else {
      console.warn(`reset failed: ${email} status=${status}`);
    }
  }

  if (updated === 0) {
    console.error('No pool users updated. Apply k6_test_users migration first.');
    process.exit(1);
  }

  mergeEnvLocal({ K6_POOL_PASSWORD: password, K6_POOL_COMPANY_ID: COMPANY_ID });

  const probeStatus = await verifyLogin(url, anonKey, poolEmail(1), password);
  console.log(`pool users updated: ${updated}/${POOL_SIZE} (missing: ${missing})`);
  console.log(`password length: ${password.length}`);
  console.log(`login probe k6-vu-01: ${probeStatus === 200 ? 'OK' : `FAIL ${probeStatus}`}`);

  if (probeStatus !== 200) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
