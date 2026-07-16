#!/usr/bin/env node
/**
 * GLOBAL RELEASE GATE — production smoke (non-mutating).
 *
 * Usage:
 *   LP_SMOKE_BASE_URL=https://app.lunchportalen.no \
 *   node scripts/smoke/global-launch-smoke.mjs [--auth] [--cron] [--webhooks] [--all]
 *
 * Checks (all safe against production):
 *   --webhooks  Both Stripe webhook routes pass middleware WITHOUT session and
 *               reject an unsigned body with 400 INVALID_SIGNATURE (never 401
 *               middleware-block, never 2xx). No data is written.
 *   --cron      Cron gate is fail-closed: no header => 403; x-vercel-cron alone => 403.
 *               With LP_SMOKE_CRON_SECRET set: dryRun=1 invoice generation => 200
 *               (dry-run writes nothing).
 *   --auth      Password-grant login via Supabase (LP_SMOKE_SUPABASE_URL/ANON_KEY +
 *               LP_SMOKE_EMAIL/PASSWORD), decodes the access token locally and
 *               asserts hook claims (is_platform_admin, memberships; active_org_id/
 *               active_role when memberships exist). Session is not persisted;
 *               token/secrets are never printed.
 *
 * Exit 0 = all requested checks PASS. Never prints secrets or tokens.
 */

const args = new Set(process.argv.slice(2));
const runAll = args.size === 0 || args.has("--all");
const doAuth = runAll || args.has("--auth");
const doCron = runAll || args.has("--cron");
const doWebhooks = runAll || args.has("--webhooks");

const BASE_URL = String(process.env.LP_SMOKE_BASE_URL ?? "").trim().replace(/\/$/, "");
const VERCEL_BYPASS = String(
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? process.env.VERCEL_PROTECTION_BYPASS ?? "",
).trim();

function smokeFetch(path, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (VERCEL_BYPASS) {
    headers["x-vercel-protection-bypass"] = VERCEL_BYPASS;
    headers["x-vercel-set-bypass-cookie"] = "true";
    headers.accept = "application/json";
  }
  return fetch(`${BASE_URL}${path}`, { ...init, headers });
}

let failures = 0;
function fail(msg) {
  failures += 1;
  console.error(`FAIL: ${msg}`);
}
function ok(msg) {
  console.log(`OK: ${msg}`);
}

async function post(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", ...init });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/* ── Stripe webhooks ─────────────────────────────────────────── */
async function smokeWebhooks() {
  console.log("\n== Stripe webhooks (allowlist + signature fail-closed) ==");
  for (const route of ["/api/webhooks/stripe-billing-payments", "/api/webhooks/stripe-provider-setup"]) {
    // 1) No session cookie + no signature: middleware must NOT 401; handler must 400.
    const unsigned = await post(route, {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ smoke: true }),
    });
    if (unsigned.status === 401) {
      fail(`${route}: 401 — middleware blocked webhook (allowlist regression, SEC-001)`);
    } else if (unsigned.status === 400 && String(unsigned.body?.error ?? "").includes("INVALID_SIGNATURE")) {
      ok(`${route}: unsigned request rejected 400 INVALID_SIGNATURE (after middleware)`);
    } else if (unsigned.status === 500 && String(unsigned.body?.error ?? "").includes("WEBHOOK_SECRET_MISSING")) {
      fail(`${route}: WEBHOOK_SECRET_MISSING — sett signing secret i miljøet`);
    } else if (unsigned.status === 503) {
      ok(`${route}: 503 kill switch aktiv (stripe_webhooks) — bevisst stengt`);
    } else {
      fail(`${route}: unexpected ${unsigned.status} ${JSON.stringify(unsigned.body)?.slice(0, 120)}`);
    }

    // 2) Garbage signature must also be rejected 400 (never 2xx).
    const forged = await post(route, {
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
      body: JSON.stringify({ smoke: true }),
    });
    if (forged.status >= 200 && forged.status < 300) {
      fail(`${route}: forged signature ACCEPTED (${forged.status}) — CRITICAL`);
    } else {
      ok(`${route}: forged signature rejected (${forged.status})`);
    }
  }
}

/* ── Cron ────────────────────────────────────────────────────── */
async function smokeCron() {
  console.log("\n== Cron gate (fail-closed) ==");
  const route = "/api/cron/invoices/generate?dryRun=1";

  const bare = await smokeFetch(route);
  if (bare.status === 403) ok("cron without credentials → 403 (fail-closed)");
  else if (bare.status === 500) {
    const body = await bare.json().catch(() => null);
    if (String(body?.error ?? "").match(/CRON_SECRET/i)) {
      fail("cron returns 500 CRON_SECRET_MISSING — sett CRON_SECRET i env");
    } else {
      fail(`cron without credentials → 500 (${JSON.stringify(body)?.slice(0, 80)})`);
    }
  } else if (bare.status === 401 && VERCEL_BYPASS) {
    fail("cron without credentials → 401 deployment protection — sjekk bypass secret");
  } else fail(`cron without credentials → ${bare.status} (expected 403)`);

  const spoofed = await smokeFetch(route, { headers: { "x-vercel-cron": "1" } });
  if (spoofed.status === 403) ok("x-vercel-cron alone → 403 (CRON-001 lukket)");
  else fail(`x-vercel-cron alone → ${spoofed.status} (expected 403) — CRITICAL if 2xx`);

  const secret = String(process.env.LP_SMOKE_CRON_SECRET ?? "").trim();
  if (!secret) {
    console.log("   (LP_SMOKE_CRON_SECRET ikke satt — hopper over positiv dryRun-verifikasjon)");
    return;
  }
  const authed = await smokeFetch(route, { headers: { authorization: `Bearer ${secret}` } });
  if (authed.status === 200) ok("cron with correct Bearer + dryRun=1 → 200 (ingen writes)");
  else if (authed.status === 503) ok("cron kill switch aktiv (503) — bevisst stengt");
  else fail(`cron with Bearer → ${authed.status} (expected 200)`);
}

/* ── Auth claims ─────────────────────────────────────────────── */
function decodeJwtPayload(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error("not a JWT");
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

async function smokeAuthClaims() {
  console.log("\n== Auth hook claims ==");
  const supaUrl = String(process.env.LP_SMOKE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  const anonKey = String(process.env.LP_SMOKE_SUPABASE_ANON_KEY ?? "").trim();
  const email = String(process.env.LP_SMOKE_EMAIL ?? "").trim();
  const password = String(process.env.LP_SMOKE_PASSWORD ?? "");

  if (!supaUrl || !anonKey || !email || !password) {
    fail("auth smoke: sett LP_SMOKE_SUPABASE_URL, LP_SMOKE_SUPABASE_ANON_KEY, LP_SMOKE_EMAIL, LP_SMOKE_PASSWORD");
    return;
  }

  const res = await fetch(`${supaUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) {
    fail(`auth smoke: login failed (${res.status})`);
    return;
  }
  const data = await res.json();
  const claims = decodeJwtPayload(data.access_token);

  if (typeof claims.is_platform_admin !== "boolean") fail("claims: is_platform_admin mangler");
  else ok(`claims: is_platform_admin = ${claims.is_platform_admin}`);

  if (!Array.isArray(claims.memberships)) fail("claims: memberships mangler (er hooken aktivert i Dashboard?)");
  else ok(`claims: memberships[] present (${claims.memberships.length})`);

  if (Array.isArray(claims.memberships) && claims.memberships.length > 0) {
    if (!claims.active_org_id) fail("claims: active_org_id mangler tross aktive medlemskap");
    else ok("claims: active_org_id present");
    if (!claims.active_role) fail("claims: active_role mangler tross aktive medlemskap");
    else ok(`claims: active_role = ${claims.active_role}`);
  } else if (Array.isArray(claims.memberships)) {
    if (claims.active_org_id || claims.active_role) fail("claims: active_* satt uten medlemskap (guard-brudd)");
    else ok("claims: ingen active_* uten medlemskap (fail-closed korrekt)");
  }

  // Sign out the smoke session (best effort; does not persist anywhere anyway).
  await fetch(`${supaUrl}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: anonKey, authorization: `Bearer ${data.access_token}` },
  }).catch(() => {});
}

/* ── Run ─────────────────────────────────────────────────────── */
if ((doWebhooks || doCron) && !BASE_URL) {
  console.error("FAIL: LP_SMOKE_BASE_URL required for --webhooks/--cron");
  process.exit(2);
}

if (doWebhooks) await smokeWebhooks();
if (doCron) await smokeCron();
if (doAuth) await smokeAuthClaims();

if (failures > 0) {
  console.error(`\nSMOKE FAILED — ${failures} finding(s)`);
  process.exit(1);
}
console.log("\nSMOKE PASS");
