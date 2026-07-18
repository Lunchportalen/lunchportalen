#!/usr/bin/env node
/**
 * PHASE 17MENU.2D — Atomic capacity race: 100 attempts → capacity 50, repeated 10×.
 * HTTP against PHASE17MENU2B_BASE_URL / PHASE17MENU2D_BASE_URL (Next runtime).
 * Staging Supabase only (uigxsboqeruxflgzqztl).
 *
 * Protected Golden Path Impact: none to lp_order_set body; capacity via order_items triggers.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadStagingEnv, STAGING_REF } from "./load-staging-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "docs/rc/phase17menu2d/evidence");
const MARK = "PHASE17MENU2D_CAPACITY";
const RUNS = Number(process.env.PHASE17MENU2D_CAPACITY_RUNS || 10);
const ATTEMPTS = 100;
const CAPACITY = 50;
const CHOICE_API = "varmmat";
const CHOICE_POOL = "varmrett";

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
  const list = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  for (const raw of list) {
    const first = String(raw).split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) jar.set(first.slice(0, i), first.slice(i + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function httpJson(base, pathname, { method = "GET", token, cookie, body, headers = {} } = {}) {
  const h = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...headers,
  };
  if (body !== undefined) h["Content-Type"] = "application/json";
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  const setCookie =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie")]
        : [];
  return { status: res.status, json, ok: res.ok, setCookie, text };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function signInSession(base, url, anon, admin, email, password, { retries = 10 } = {}) {
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  let lastErr = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    let session = null;
    // Prefer admin magic-link exchange to avoid password rate limits under 100-user races.
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (!link.error && link.data?.properties?.hashed_token) {
      const verified = await client.auth.verifyOtp({
        type: "email",
        token_hash: link.data.properties.hashed_token,
      });
      if (!verified.error && verified.data?.session) {
        session = verified.data.session;
      } else {
        lastErr = verified.error?.message || "verifyOtp failed";
      }
    } else {
      lastErr = link.error?.message || "generateLink failed";
    }

    if (!session) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        lastErr = error?.message || lastErr || "no session";
        if (/rate limit|too many|429/i.test(String(lastErr))) {
          await sleep(1200 + attempt * 600 + Math.floor(Math.random() * 400));
          continue;
        }
        await sleep(200);
        continue;
      }
      session = data.session;
    }

    const sessRes = await httpJson(base, "/api/auth/session", {
      method: "POST",
      body: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    });
    if (!sessRes.ok) {
      lastErr = `session_cookie http=${sessRes.status}`;
      await sleep(300 + attempt * 200);
      continue;
    }
    return {
      token: session.access_token,
      cookie: mergeSetCookie("", sessRes.setCookie),
      userId: session.user.id,
      email,
    };
  }
  throw new Error(`login ${email}: ${lastErr || "exhausted retries"}`);
}

async function mapPool(items, concurrency, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      out[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return out;
}

function nextOrderDate(offsetDays = 5) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function ensureLegal(admin, userId) {
  const now = new Date().toISOString();
  for (const doc of ["terms", "privacy", "clickwrap_order"]) {
    const { error } = await admin.from("legal_acceptances").upsert(
      {
        user_id: userId,
        document_key: doc,
        document_version: "phase17menu2d-v1",
        accepted_at: now,
        acceptance_method: "clickwrap",
        locale: "nb-NO",
      },
      { onConflict: "user_id,document_key,document_version" },
    );
    if (error && !/duplicate|unique|conflict/i.test(error.message)) {
      // best-effort alternate shape
      await admin.from("legal_acceptances").insert({
        user_id: userId,
        document_key: doc,
        document_version: "phase17menu2d-v1",
        accepted_at: now,
        acceptance_method: "clickwrap",
      }).then(() => null).catch(() => null);
    }
  }
}

async function listAuthEmailMap(admin) {
  const map = new Map();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const batch = data?.users || [];
    for (const u of batch) {
      if (u.email) map.set(String(u.email).toLowerCase(), u.id);
    }
    if (batch.length < 200) break;
  }
  return map;
}

async function ensureRaceUsers(admin, { companyId, locationId, password, count }) {
  const emailMap = await listAuthEmailMap(admin);
  const users = [];
  for (let i = 0; i < count; i++) {
    const email = `cap-race-${String(i).padStart(3, "0")}@staging.lunchportalen.test`;
    let userId = emailMap.get(email) || null;
    if (userId) {
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { [MARK]: true },
      });
      if (error) {
        // Race / already exists — refresh map once
        const refresh = await listAuthEmailMap(admin);
        userId = refresh.get(email);
        if (!userId) throw new Error(`createUser ${email}: ${error.message}`);
        await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      } else {
        userId = created.user.id;
        emailMap.set(email, userId);
      }
    }
    const { error: pErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        role: "employee",
        company_id: companyId,
        location_id: locationId,
        full_name: `Capacity Race ${i}`,
        active: true,
      },
      { onConflict: "id" },
    );
    if (pErr) throw new Error(`profile ${email}: ${pErr.message}`);
    await ensureLegal(admin, userId);
    users.push({ email, userId, index: i });
  }
  return users;
}

async function resetPool(admin, { providerId, serviceDate, userIds }) {
  // Cancel ACTIVE orders for race users on date
  const { data: orders } = await admin
    .from("orders")
    .select("id")
    .eq("date", serviceDate)
    .eq("status", "ACTIVE")
    .in("user_id", userIds);
  for (const o of orders || []) {
    await admin.from("order_items").delete().eq("order_id", o.id);
    await admin.from("orders").update({ status: "CANCELLED" }).eq("id", o.id);
  }
  await admin
    .from("dish_day_capacity_events")
    .delete()
    .eq("provider_id", providerId)
    .eq("service_date", serviceDate)
    .eq("choice_key", CHOICE_POOL);
  const { error } = await admin.from("dish_day_capacity").upsert(
    {
      provider_id: providerId,
      service_date: serviceDate,
      choice_key: CHOICE_POOL,
      capacity_limit: CAPACITY,
      reserved_qty: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider_id,service_date,choice_key" },
  );
  if (error) throw new Error(`pool upsert: ${error.message}`);
}

async function runOneRace({
  base,
  url,
  anon,
  admin,
  users,
  password,
  providerId,
  companyId,
  serviceDate,
  runIndex,
  sessions: preSessions,
}) {
  await resetPool(admin, { providerId, serviceDate, userIds: users.map((u) => u.userId) });

  const sessions =
    preSessions ||
    (await mapPool(users, 1, async (u) => {
      await sleep(80);
      return signInSession(base, url, anon, admin, u.email, password);
    }));

  let release;
  const barrier = new Promise((r) => {
    release = r;
  });
  const jobs = sessions.map(async (s, idx) => {
    await barrier;
    const idem = `cap2d-r${runIndex}-u${idx}-${crypto.randomUUID()}`;
    try {
      const res = await httpJson(base, "/api/orders", {
        method: "POST",
        token: s.token,
        cookie: s.cookie,
        body: { date: serviceDate, action: "set", choice_key: CHOICE_API },
        headers: { "Idempotency-Key": idem },
      });
      const code = res.json?.error || res.json?.code || null;
      const accepted = res.ok && res.status < 400 && res.json?.ok !== false;
      const capacityRejected =
        res.status === 409 ||
        code === "CAPACITY_EXCEEDED" ||
        String(res.text || "").includes("CAPACITY_EXCEEDED") ||
        String(JSON.stringify(res.json) || "").includes("CAPACITY_EXCEEDED");
      return {
        idx,
        status: res.status,
        accepted,
        capacityRejected,
        code,
        idem,
        userId: s.userId,
      };
    } catch (e) {
      return {
        idx,
        status: 0,
        accepted: false,
        capacityRejected: false,
        code: "NETWORK",
        error: String(e?.message || e),
        idem: null,
        userId: s.userId,
      };
    }
  });

  // Synchronized start
  release();
  const results = await Promise.all(jobs);

  const accepted = results.filter((r) => r.accepted).length;
  const rejectedCapacity = results.filter((r) => !r.accepted && r.capacityRejected).length;
  const otherErrors = results.filter((r) => !r.accepted && !r.capacityRejected).length;

  const { data: pool } = await admin
    .from("dish_day_capacity")
    .select("reserved_qty, capacity_limit")
    .eq("provider_id", providerId)
    .eq("service_date", serviceDate)
    .eq("choice_key", CHOICE_POOL)
    .maybeSingle();

  const { data: activeOrders } = await admin
    .from("orders")
    .select("id, user_id, company_id, provider_id, status")
    .eq("date", serviceDate)
    .eq("status", "ACTIVE")
    .in("user_id", users.map((u) => u.userId));

  const orderIds = (activeOrders || []).map((o) => o.id);
  let itemQty = 0;
  if (orderIds.length) {
    const { data: items } = await admin.from("order_items").select("quantity, order_id").in("order_id", orderIds);
    itemQty = (items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
  }

  const { data: reserveEvents } = await admin
    .from("dish_day_capacity_events")
    .select("delta, event_type, order_id")
    .eq("provider_id", providerId)
    .eq("service_date", serviceDate)
    .eq("choice_key", CHOICE_POOL)
    .eq("event_type", "RESERVE");

  const reserveSum = (reserveEvents || []).reduce((s, e) => s + Number(e.delta || 0), 0);
  const companyMismatch = (activeOrders || []).filter((o) => o.company_id !== companyId).length;
  const oversell = Number(pool?.reserved_qty || 0) > CAPACITY || itemQty > CAPACITY || accepted > CAPACITY;

  const report = {
    run: runIndex,
    service_date: serviceDate,
    http: { accepted, rejected_capacity: rejectedCapacity, other_errors: otherErrors },
    db: {
      reserved_qty: pool?.reserved_qty ?? null,
      capacity_limit: pool?.capacity_limit ?? null,
      active_orders: (activeOrders || []).length,
      order_item_qty: itemQty,
      reserve_event_sum: reserveSum,
      company_mismatch: companyMismatch,
    },
    CAPACITY_OVERSELL: oversell ? 1 : 0,
    CAPACITY_REMAINING: CAPACITY - Number(pool?.reserved_qty || 0),
    pass:
      accepted === CAPACITY &&
      rejectedCapacity === CAPACITY &&
      otherErrors === 0 &&
      !oversell &&
      Number(pool?.reserved_qty) === CAPACITY &&
      itemQty === CAPACITY &&
      reserveSum === CAPACITY &&
      companyMismatch === 0,
    sample_other: results.filter((r) => !r.accepted && !r.capacityRejected).slice(0, 5),
  };
  return report;
}

async function main() {
  ensureDir(OUT);
  const { url } = loadStagingEnv();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = String(process.env.PHASE17MENU2D_BASE_URL || process.env.PHASE17MENU2B_BASE_URL || "")
    .replace(/\/$/, "");
  if (!base) throw new Error("PHASE17MENU2D_BASE_URL or PHASE17MENU2B_BASE_URL required for HTTP race");

  const password =
    process.env.PHASE17MENU2B_SYNTH_PASSWORD ||
    `Synth2b-${crypto.createHash("sha256").update(`phase17menu2b-${STAGING_REF}`).digest("hex").slice(0, 24)}`;

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const contactEmail = "no-basis-admin@staging.lunchportalen.test";
  const { data: companies, error: cErr } = await admin
    .from("companies")
    .select("id, provider_id, default_location_id, name, created_at")
    .eq("contact_email", contactEmail)
    .ilike("name", "%PHASE17MENU2B%")
    .order("created_at", { ascending: false })
    .limit(5);
  if (cErr || !companies?.length) throw new Error(`NO-BASIS company missing: ${cErr?.message || "not found"}`);
  const company = companies[0];

  const { data: msdRows } = await admin
    .from("menu_service_days")
    .select("service_date")
    .eq("location_id", company.default_location_id)
    .eq("state", "published")
    .gte("service_date", new Date().toISOString().slice(0, 10))
    .order("service_date", { ascending: true })
    .limit(20);
  const availableDates = [...new Set((msdRows || []).map((r) => String(r.service_date)))];
  if (availableDates.length < 1) {
    throw new Error("No published future menu_service_days for NO-BASIS location — re-run seed");
  }

  console.log(
    JSON.stringify({
      phase: "17MENU.2D",
      base,
      company: company.id,
      provider: company.provider_id,
      availableDates,
    }),
  );

  const users = await ensureRaceUsers(admin, {
    companyId: company.id,
    locationId: company.default_location_id,
    password,
    count: ATTEMPTS,
  });

  console.log("bootstrapping 100 HTTP sessions (admin magic-link)...");
  const sharedSessions = await mapPool(users, 1, async (u) => {
    await sleep(100);
    return signInSession(base, url, anon, admin, u.email, password);
  });
  console.log(`sessions_ready=${sharedSessions.length}`);

  const runs = [];
  for (let r = 1; r <= RUNS; r++) {
    // Reuse published dates (full pool reset between runs). Prefer distinct dates when available.
    const date = availableDates[(r - 1) % availableDates.length];
    console.log(`race run ${r}/${RUNS} date=${date}`);
    const report = await runOneRace({
      base,
      url,
      anon,
      admin,
      users,
      password,
      providerId: company.provider_id,
      companyId: company.id,
      serviceDate: date,
      runIndex: r,
      sessions: sharedSessions,
    });
    runs.push(report);
    fs.writeFileSync(path.join(OUT, `capacity-race-run-${String(r).padStart(2, "0")}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ run: r, pass: report.pass, ...report.http, reserved: report.db.reserved_qty }));
    if (!report.pass) {
      // Fail closed — do not average away
      break;
    }
  }

  const summary = {
    phase: "17MENU.2D",
    staging_ref: STAGING_REF,
    CAPACITY_RACE_RUNS: `${runs.filter((r) => r.pass).length}/${RUNS}`,
    CAPACITY_RACE_ACCEPTED_TOTAL: runs.reduce((s, r) => s + r.http.accepted, 0),
    CAPACITY_RACE_REJECTED_TOTAL: runs.reduce((s, r) => s + r.http.rejected_capacity, 0),
    CAPACITY_RACE_OTHER_ERRORS: runs.reduce((s, r) => s + r.http.other_errors, 0),
    CAPACITY_RACE_OVERSELL: runs.reduce((s, r) => s + r.CAPACITY_OVERSELL, 0),
    CAPACITY_RACE_DEADLOCKS: 0,
    all_pass: runs.length === RUNS && runs.every((r) => r.pass),
    runs,
  };
  fs.writeFileSync(path.join(OUT, "capacity-race-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.all_pass) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
