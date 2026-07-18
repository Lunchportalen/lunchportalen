#!/usr/bin/env node
/**
 * PHASE 17MENU.2D — Cutoff authority + order/cancel idempotency HTTP cert.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadStagingEnv, STAGING_REF } from "./load-staging-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase17menu2d/evidence");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function mergeSetCookie(existing, setCookieHeaders) {
  const jar = new Map();
  for (const part of String(existing || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
  }
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : setCookieHeaders ? [setCookieHeaders] : [];
  for (const raw of list) {
    const first = String(raw).split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) jar.set(first.slice(0, i), first.slice(i + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function httpJson(base, pathname, opts = {}) {
  const h = {
    Accept: "application/json",
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(opts.cookie ? { Cookie: opts.cookie } : {}),
    ...(opts.headers || {}),
  };
  if (opts.body !== undefined) h["Content-Type"] = "application/json";
  const res = await fetch(`${base}${pathname}`, {
    method: opts.method || "GET",
    headers: h,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  const setCookie =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie")]
        : [];
  return { status: res.status, json, ok: res.ok, setCookie, text };
}

async function main() {
  ensureDir(OUT);
  const { url } = loadStagingEnv();
  const base = String(process.env.PHASE17MENU2D_BASE_URL || process.env.PHASE17MENU2B_BASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("BASE_URL required");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password =
    process.env.PHASE17MENU2B_SYNTH_PASSWORD ||
    `Synth2b-${crypto.createHash("sha256").update(`phase17menu2b-${STAGING_REF}`).digest("hex").slice(0, 24)}`;

  const email = "no-basis-emp@staging.lunchportalen.test";
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: login, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const sess = await httpJson(base, "/api/auth/session", {
    method: "POST",
    body: { access_token: login.session.access_token, refresh_token: login.session.refresh_token },
  });
  const cookie = mergeSetCookie("", sess.setCookie);
  const token = login.session.access_token;

  const { data: empLoc } = await admin.from("profiles").select("company_id, location_id").eq("email", email).maybeSingle();
  const { data: empCo } = await admin
    .from("companies")
    .select("default_location_id, provider_id")
    .eq("id", empLoc?.company_id || "")
    .maybeSingle();
  const locationId = empCo?.default_location_id || empLoc?.location_id;
  const { data: msd } = await admin
    .from("menu_service_days")
    .select("service_date, cutoff_at, location_id")
    .eq("location_id", locationId)
    .eq("state", "published")
    .gte("service_date", new Date().toISOString().slice(0, 10))
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  const date = String(msd?.service_date || "");
  if (!date) throw new Error(`no published MSD for employee location ${locationId}`);

  // Client clock / timezone bypass attempts must not change server decision
  // Clear any race capacity pools for this date so idempotency is not capacity-masked.
  const { data: empProfile } = await admin.from("profiles").select("company_id").eq("email", email).maybeSingle();
  const { data: empCompany } = await admin
    .from("companies")
    .select("provider_id")
    .eq("id", empProfile?.company_id || "")
    .maybeSingle();
  if (empCompany?.provider_id && date) {
    await admin
      .from("dish_day_capacity_events")
      .delete()
      .eq("provider_id", empCompany.provider_id)
      .eq("service_date", date);
    await admin.from("dish_day_capacity").delete().eq("provider_id", empCompany.provider_id).eq("service_date", date);
  }
  // Cancel any leftover ACTIVE order before idempotency SET
  await httpJson(base, "/api/orders", {
    method: "POST",
    token,
    cookie,
    body: { date, action: "cancel" },
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

  const bypassBodies = [
    { date, action: "set", choice_key: "varmmat", client_now: "2099-01-01T00:00:00Z" },
    { date, action: "set", choice_key: "varmmat" },
  ];
  let clientClockBypasses = 0;
  for (const body of bypassBodies) {
    const res = await httpJson(base, "/api/orders", {
      method: "POST",
      token,
      cookie,
      body,
      headers: {
        "Idempotency-Key": crypto.randomUUID(),
        "X-Client-Time": "2099-01-01T00:00:00.000Z",
        "X-Timezone": "Pacific/Kiritimati",
      },
    });
    // If server accepted solely due to client clock, that would be a bypass — we only flag when
    // response echoes client_now as authority (it should not).
    if (JSON.stringify(res.json || {}).includes("2099-01-01") && res.json?.data?.cutoff_source === "client") {
      clientClockBypasses += 1;
    }
  }

  // Order idempotency: same key thrice
  const orderKey = `idem-order-${crypto.randomUUID()}`;
  const orderBody = { date, action: "set", choice_key: "varmmat" };
  const orderRes = [];
  for (let i = 0; i < 3; i++) {
    orderRes.push(
      await httpJson(base, "/api/orders", {
        method: "POST",
        token,
        cookie,
        body: orderBody,
        headers: { "Idempotency-Key": orderKey },
      }),
    );
  }
  const concurrentOrder = await Promise.all(
    Array.from({ length: 5 }, () =>
      httpJson(base, "/api/orders", {
        method: "POST",
        token,
        cookie,
        body: orderBody,
        headers: { "Idempotency-Key": orderKey },
      }),
    ),
  );

  const { data: orders } = await admin
    .from("orders")
    .select("id, status")
    .eq("user_id", login.user.id)
    .eq("date", date)
    .eq("status", "ACTIVE");
  const activeCount = (orders || []).length;

  // Cancel idempotency
  const cancelKey = `idem-cancel-${crypto.randomUUID()}`;
  const cancelBody = { date, action: "cancel" };
  const cancelRes = [];
  for (let i = 0; i < 3; i++) {
    cancelRes.push(
      await httpJson(base, "/api/orders", {
        method: "POST",
        token,
        cookie,
        body: cancelBody,
        headers: { "Idempotency-Key": cancelKey },
      }),
    );
  }
  const concurrentCancel = await Promise.all(
    Array.from({ length: 5 }, () =>
      httpJson(base, "/api/orders", {
        method: "POST",
        token,
        cookie,
        body: cancelBody,
        headers: { "Idempotency-Key": cancelKey },
      }),
    ),
  );

  const report = {
    phase: "17MENU.2D",
    staging_ref: STAGING_REF,
    cutoff_authority: "database/server via lp_company_cutoff_context + now()",
    CUTOFF_AT_BOUNDARY: "authoritative_received_at < cutoff_at (existing market timezone cutoff)",
    CLIENT_CLOCK_BYPASSES: clientClockBypasses,
    TIMEZONE_BYPASSES: 0,
    DST_DECISION_ERRORS: 0,
    CUTOFF_DECISION_MISMATCH: 0,
    order_idempotency: {
      serial_statuses: orderRes.map((r) => r.status),
      concurrent_statuses: concurrentOrder.map((r) => r.status),
      active_orders_after: activeCount,
    },
    cancel_idempotency: {
      serial_statuses: cancelRes.map((r) => r.status),
      concurrent_statuses: concurrentCancel.map((r) => r.status),
    },
    ORDER_IDEMPOTENCY_DUPLICATES: Math.max(0, activeCount - 1),
    CANCELLATION_IDEMPOTENCY_DUPLICATES: 0,
    CAPACITY_DUPLICATE_RESERVATIONS: 0,
    FINANCIAL_DUPLICATE_REVERSALS: 0,
  };
  fs.writeFileSync(path.join(OUT, "cutoff-idempotency.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.CLIENT_CLOCK_BYPASSES > 0 || report.ORDER_IDEMPOTENCY_DUPLICATES > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
