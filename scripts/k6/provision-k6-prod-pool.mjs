#!/usr/bin/env node
/**
 * Provision K6 VU pool passwords on PRODUCTION (20 users).
 * Run after migration 20260524130000_k6_prod_tenant.sql.
 *
 *   node scripts/k6/provision-k6-prod-pool.mjs
 *
 * Requires prod Supabase in env (hkpokyapzarefrgqzkos). Writes K6_PROD_PASSWORD
 * to .env.local (never commit). See DC-035 for notifications opt-out (no column yet).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const POOL_SIZE = 20;
const PROD_PROJECT_REF = 'hkpokyapzarefrgqzkos';
const COMPANY_ID = 'e0a00000-0000-4000-8000-000000000001';

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

/** Scan env file; when duplicate Supabase URLs exist, bind keys to prod block. */
function scanProdSupabaseFromFile(file) {
  if (!fs.existsSync(file)) return { url: '', anonKey: '', serviceKey: '' };
  let url = '';
  let anonKey = '';
  let serviceKey = '';
  let inProdBlock = false;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (m[1] === 'NEXT_PUBLIC_SUPABASE_URL') {
      inProdBlock = v.includes(PROD_PROJECT_REF);
      if (inProdBlock) url = v;
      continue;
    }
    if (!inProdBlock) continue;
    if (
      (m[1] === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' || m[1] === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') &&
      v.length > 20
    ) {
      anonKey = v;
    }
    if (m[1] === 'SUPABASE_SERVICE_ROLE_KEY' && v.length > 20) serviceKey = v;
  }
  return { url, anonKey, serviceKey };
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

function pickProdValue(maps, keys) {
  for (const key of keys) {
    for (const map of maps) {
      const v = map[key];
      if (v) return v;
    }
  }
  return '';
}

function resolveProdEnv(...maps) {
  const root = process.cwd();
  let scanned = { url: '', anonKey: '', serviceKey: '' };
  for (const f of ['.env.prod-k6.tmp', '.env.local.prod-backup']) {
    const part = scanProdSupabaseFromFile(path.join(root, f));
    if (part.url) scanned = part;
  }

  const url =
    pickProdValue(maps, ['K6_PROD_SUPABASE_URL']) ||
    scanned.url ||
    [].concat(...maps.map((m) => [m.NEXT_PUBLIC_SUPABASE_URL, m.SUPABASE_URL]))
      .find((v) => v && v.includes(PROD_PROJECT_REF)) ||
    '';

  const serviceKey =
    pickProdValue(maps, ['K6_PROD_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) ||
    scanned.serviceKey ||
    '';
  const anonKey =
    pickProdValue(maps, ['K6_PROD_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY']) ||
    scanned.anonKey ||
    '';

  if (!url.includes(PROD_PROJECT_REF)) {
    console.error(
      `Refusing: Supabase URL must point to prod (${PROD_PROJECT_REF}). Got: ${url ? `${url.slice(0, 48)}…` : '(empty)'}`,
    );
    console.error('Set K6_PROD_* keys or add prod URL to .env.local.prod-backup.');
    process.exit(1);
  }

  return { url, serviceKey, anonKey };
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

/**
 * DC-035: profiles.notifications_enabled does not exist yet — no-op until migration.
 */
async function disablePoolNotifications() {
  console.log('notifications: skipped (DC-035 — no profiles.notifications_enabled column)');
}

async function main() {
  const root = process.cwd();
  const prodPullEnv = loadEnvFile(path.join(root, '.env.prod-k6.tmp'));
  const backupEnv = loadEnvFile(path.join(root, '.env.local.prod-backup'));
  const localEnv = loadEnvFile(path.join(root, '.env.local'));
  const envMaps = [prodPullEnv, backupEnv, localEnv, process.env];
  const { url, serviceKey, anonKey } = resolveProdEnv(...envMaps);

  if (!url || !serviceKey || !anonKey) {
    console.error('Missing prod SUPABASE_URL / SERVICE_ROLE / ANON key');
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
      console.warn(`missing: ${email} (apply migration 20260524130000_k6_prod_tenant first)`);
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
    console.error('No pool users updated. Apply k6_prod_tenant migration first.');
    process.exit(1);
  }

  await disablePoolNotifications();

  mergeEnvLocal({
    K6_PROD_PASSWORD: password,
    K6_PROD_COMPANY_ID: COMPANY_ID,
    K6_PROD_SUPABASE_URL: url,
  });

  const probeStatus = await verifyLogin(url, anonKey, poolEmail(1), password);
  console.log(`prod pool users updated: ${updated}/${POOL_SIZE} (missing: ${missing})`);
  console.log(`password length: ${password.length}`);
  console.log(`password prefix: ${password.slice(0, 4)}…`);
  console.log(`login probe k6-vu-01: ${probeStatus === 200 ? 'OK' : `FAIL ${probeStatus}`}`);

  if (probeStatus !== 200) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
