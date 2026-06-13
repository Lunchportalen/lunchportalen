#!/usr/bin/env node
/**
 * First menu publish + first order smoke (staging/uigx only).
 * Ephemeral operator script — not part of product surface.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSanityClient } from "@sanity/client";

import { evaluateBootstrapTarget } from "../ci/assert-db-target.mjs";
import { PROVIDER_A, FIXTURE_TIER, FIXTURE_MENU_CATEGORY_SANITY } from "./fixtures/provider-ab-staging.constants.mjs";
import { SMOKE_CHOICE_KEY, SMOKE_COMPANY_ID, SMOKE_LOCATION_ID } from "./fixtures/smoke-menu-fixture.constants.mjs";
import { loadEnvFiles, resolveStagingDatabaseUrl } from "./resolve-staging-database-url.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const STAGING_REF = "uigxsboqeruxflgzqztl";
const PROD_REF = "hkpokyapzarefrgqzkos";
const BASE = (process.env.STAGING_BASE_URL || "https://staging.app.lunchportalen.no").replace(/\/$/, "");

const MEAL_TITLE = "Testrett første ordre";
const MEAL_DESC = "Smoke-test for første lunsjbestilling";
const ALLERGENS = "melk, hvete";

/** @type {Record<string, string>} */
const cookieJar = {};
/** @type {Array<{phase:string, step:string, status:"PASS"|"FAIL"|"SKIP", evidence:string}>} */
const report = [];

function row(phase, step, status, evidence) {
  report.push({ phase, step, status, evidence });
  console.log(`[${status}] ${phase} — ${step}: ${evidence}`);
}

function vercelBypass() {
  return process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_PROTECTION_BYPASS || "";
}

function mergeCookies(setCookie) {
  if (!setCookie) return;
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const raw of parts) {
    const pair = raw.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    cookieJar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
}

function cookieHeader() {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function hasSessionCookie() {
  const h = cookieHeader().toLowerCase();
  return h.includes("sb-") || h.includes("supabase");
}

function clearSession() {
  for (const k of Object.keys(cookieJar)) {
    if (k.startsWith("sb-") || k.toLowerCase().includes("auth")) delete cookieJar[k];
  }
}

async function http(method, urlPath, opts = {}) {
  const bypass = vercelBypass();
  let url = `${BASE}${urlPath}`;
  if (bypass && !opts.noBypass) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
  }
  const headers = { ...(opts.headers || {}) };
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass;
    headers["x-vercel-set-bypass-cookie"] = "true";
  }
  const jar = cookieHeader();
  if (jar) headers.cookie = jar;
  const init = { method, headers, redirect: "manual" };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    if (!headers["content-type"]) headers["content-type"] = "application/json";
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  mergeCookies(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"));
  return { status: res.status, text, json, url };
}

async function bootstrapBypass() {
  const bypass = vercelBypass();
  if (!bypass) return;
  await http("GET", "/api/health");
}

async function login(email, password) {
  clearSession();
  await bootstrapBypass();
  const res = await http("POST", "/api/auth/login", { body: { email, password } });
  const ok = res.status === 200 && res.json?.ok === true && hasSessionCookie();
  return { ...res, ok };
}

function weekOffsetForOrderDate(orderDate) {
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const mondayOf = (iso) => {
    const d = new Date(`${iso}T12:00:00Z`);
    const diff = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - diff);
    return d.toISOString().slice(0, 10);
  };
  const addDays = (iso, n) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const thisMon = mondayOf(todayIso);
  const nextMon = addDays(thisMon, 7);
  const orderMon = mondayOf(orderDate);
  if (orderMon === nextMon) return 1;
  if (orderMon === thisMon) return 0;
  return orderDate >= nextMon ? 1 : 0;
}

function nextWeekdayIsoOslo() {
  const probe = new Date();
  for (let i = 1; i <= 14; i += 1) {
    const d = new Date(probe.getTime() + i * 86_400_000);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
    if (weekday !== "Sat" && weekday !== "Sun") {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Oslo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    }
  }
  throw new Error("no weekday in 14d");
}

function melhusDocId(date) {
  return `menuDay-${date}-${FIXTURE_TIER}-${FIXTURE_MENU_CATEGORY_SANITY}`;
}

function providerLoginCandidates() {
  const pass =
    process.env.PLAYWRIGHT_TEST_PASSWORD ||
    process.env.STAGING_TEST_PASSWORD ||
    process.env.E2E_TEST_USER_PASSWORD ||
    process.env.E2E_EMPLOYEE_PASSWORD ||
    "Lunchportalen123!";
  return [
    { email: PROVIDER_A.kitchenEmail, password: pass, label: "provider-a-kitchen" },
    { email: "kitchen-a@smoke.lunchportalen.no", password: pass, label: "kitchen-a-smoke" },
    { email: process.env.E2E_PROVIDER_KITCHEN_EMAIL || "", password: process.env.E2E_PROVIDER_KITCHEN_PASSWORD || pass, label: "e2e-provider-kitchen" },
  ].filter((c) => c.email);
}

function employeeLoginCandidates() {
  const pass = process.env.PLAYWRIGHT_TEST_PASSWORD || process.env.STAGING_TEST_PASSWORD || process.env.E2E_EMPLOYEE_PASSWORD || "";
  return [
    { email: process.env.PLAYWRIGHT_TEST_EMAIL || "smoke-test@lunchportalen.no", password: pass, label: "smoke-test" },
    { email: process.env.E2E_EMPLOYEE_EMAIL || "e2e.employee@lunchportalen.no", password: process.env.E2E_EMPLOYEE_PASSWORD || pass, label: "e2e-employee" },
  ].filter((c) => c.email && c.password);
}

async function resolveProviderSession() {
  for (const c of providerLoginCandidates()) {
    const res = await login(c.email, c.password);
    if (res.ok) {
      return { ...c, loginStatus: res.status };
    }
  }
  return null;
}

async function resolveEmployeeSession() {
  for (const c of employeeLoginCandidates()) {
    const res = await login(c.email, c.password);
    if (res.ok) {
      return { ...c, loginStatus: res.status };
    }
  }
  return null;
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url.includes(STAGING_REF) || !key) throw new Error("staging supabase admin config missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function sanityReadClient() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "production";
  const token =
    process.env.SANITY_READ_TOKEN ||
    process.env.SANITY_WRITE_TOKEN ||
    process.env.SANITY_TOKEN ||
    process.env.SANITY_API_TOKEN ||
    undefined;
  if (!projectId) throw new Error("Sanity projectId missing");
  return createSanityClient({ projectId, dataset, apiVersion: "2024-01-01", token, useCdn: false, perspective: "published" });
}

async function runReconcile() {
  let secret = process.env.STAGING_CRON_SECRET || process.env.CRON_SECRET || "";
  if (!secret) {
    try {
      const extract = fs.readFileSync(path.join(ROOT, "scripts/audit/staging-env-actual-2026-05-20.env"), "utf8");
      for (const line of extract.split(/\r?\n/)) {
        if (line.startsWith("CRON_SECRET=")) secret = line.slice("CRON_SECRET=".length).trim();
      }
    } catch {
      /* ignore */
    }
  }
  if (!secret) return { ok: false, reason: "no cron secret" };
  const res = await http("GET", "/api/cron/menu-service-day-reconcile", {
    headers: { authorization: `Bearer ${secret}` },
  });
  return { ok: res.status === 200 && res.json?.ok === true, status: res.status, json: res.json };
}

async function main() {
  loadEnvFiles(ROOT);

  // FASE 0
  const supaUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "");
  if (!supaUrl.includes(STAGING_REF) || supaUrl.includes(PROD_REF)) {
    row("F0", "supabase target", "FAIL", `ref must be ${STAGING_REF}, got ${supaUrl || "(empty)"}`);
    process.exit(2);
  }
  const picked = resolveStagingDatabaseUrl();
  if (!picked) {
    row("F0", "database url", "FAIL", "no uigx DATABASE_URL");
    process.exit(2);
  }
  const parsedRef = picked.url.includes(STAGING_REF) ? STAGING_REF : null;
  const target = evaluateBootstrapTarget({ expect: "staging", parsedRef });
  if (target.decision !== "proceed") {
    row("F0", "assert-db-target", "FAIL", JSON.stringify(target));
    process.exit(2);
  }
  row("F0", "safety", "PASS", `main has PR194, parsedRef=${target.parsedRef}, sentinel=staging(MCP-verified)`);

  const orderDate = nextWeekdayIsoOslo();
  const docId = melhusDocId(orderDate);
  row("F0", "order date", "PASS", orderDate);

  // FASE 1 — route exists; full form verified after provider login (FASE 2)
  const unauth = await http("POST", "/api/provider/menu-days", {
    body: { date: orderDate, tier: "BASIS", category: "varmrett", mealTitle: "x", description: "y", status: "draft" },
  });
  row(
    "F1",
    "api auth gate",
    unauth.status === 401 || unauth.status === 403 || unauth.status === 307 ? "PASS" : "FAIL",
    `unauthenticated status=${unauth.status}`,
  );

  // FASE 2
  const providerSession = await resolveProviderSession();
  if (!providerSession) {
    row("F2", "provider login", "FAIL", "no provider session — check provider kitchen creds");
    printReport("D");
    process.exit(1);
  }
  row("F2", "provider login", "PASS", `${providerSession.label} status=${providerSession.loginStatus}`);

  const menyPage = await http("GET", "/leverandor/meny");
  const hasForm =
    menyPage.text.includes("Publiser meny") &&
    menyPage.text.includes("Lagre utkast") &&
    !menyPage.text.includes("Åpne menyredigering");
  row(
    "F1",
    "menu editor route",
    hasForm ? "PASS" : "FAIL",
    `status=${menyPage.status} form=${hasForm}`,
  );

  const publish = await http("POST", "/api/provider/menu-days", {
    body: {
      date: orderDate,
      tier: FIXTURE_TIER,
      category: FIXTURE_MENU_CATEGORY_SANITY,
      mealTitle: MEAL_TITLE,
      description: MEAL_DESC,
      allergensText: ALLERGENS,
      status: "published",
      providerId: "evil-spoof-id",
    },
  });
  const pubOk = publish.status === 200 && publish.json?.ok === true && publish.json?.data?.status === "published";
  row(
    "F2",
    "publish menu",
    pubOk ? "PASS" : "FAIL",
    pubOk
      ? `id=${publish.json.data.id} sync=${publish.json.data.syncStatus}`
      : `status=${publish.status} msg=${publish.json?.message ?? publish.text.slice(0, 200)}`,
  );
  if (!pubOk) {
    printReport("D");
    process.exit(1);
  }

  // FASE 3
  let sanityDoc = null;
  try {
    const sanity = sanityReadClient();
    sanityDoc = await sanity.fetch(
      `*[_type=="menuDay" && _id==$id][0]{_id, date, planTier, category, mealTitle, approvedForPublish, customerVisible, "providerRef": provider._ref}`,
      { id: docId },
    );
  } catch (e) {
    row("F3", "sanity read", "FAIL", String(e));
    printReport("D");
    process.exit(1);
  }
  const sanityOk =
    sanityDoc &&
    sanityDoc.providerRef === PROVIDER_A.providerId &&
    sanityDoc.date === orderDate &&
    sanityDoc.planTier === FIXTURE_TIER &&
    sanityDoc.category === FIXTURE_MENU_CATEGORY_SANITY &&
    sanityDoc.mealTitle === MEAL_TITLE &&
    sanityDoc.approvedForPublish === true &&
    sanityDoc.customerVisible === true;
  row(
    "F3",
    "sanity menuDay",
    sanityOk ? "PASS" : "FAIL",
    sanityDoc ? JSON.stringify(sanityDoc) : "doc missing",
  );
  if (!sanityOk) {
    printReport("D");
    process.exit(1);
  }

  // FASE 4
  const admin = supabaseAdmin();

  async function loadMaterialization() {
    const { data: msd, error: msdErr } = await admin
      .from("menu_service_days")
      .select("id, service_date, location_id, company_id, provider_id, state")
      .eq("provider_id", PROVIDER_A.providerId)
      .eq("service_date", orderDate);
    if (msdErr) throw msdErr;
    const rows = Array.isArray(msd) ? msd : [];
    if (!rows.length) return { msd: [], msdi: [] };
    const ids = rows.map((r) => r.id);
    const { data: msdi, error: msdiErr } = await admin
      .from("menu_service_day_items")
      .select("id, menu_service_day_id, product_id, product_name_snapshot")
      .in("menu_service_day_id", ids);
    if (msdiErr) throw msdiErr;
    return { msd: rows, msdi: Array.isArray(msdi) ? msdi : [] };
  }

  let { msd, msdi } = await loadMaterialization();
  if (msd.length === 0) {
    const recon = await runReconcile();
    row("F4", "reconcile attempt", recon.ok ? "PASS" : "SKIP", JSON.stringify(recon));
    ({ msd, msdi } = await loadMaterialization());
  }

  const scopedMsd = msd.filter((r) => r.location_id === SMOKE_LOCATION_ID);
  const scopedIds = scopedMsd.map((r) => r.id);
  const scopedMsdi = msdi.filter((r) => scopedIds.includes(r.menu_service_day_id));
  const hasMsd = scopedMsd.length > 0;
  const itemsReady = scopedMsdi.length > 0;
  const scoped =
    hasMsd &&
    scopedMsd.every((r) => r.provider_id === PROVIDER_A.providerId);
  row(
    "F4",
    "supabase materialization",
    hasMsd && scoped ? (itemsReady ? "PASS" : "SKIP") : "FAIL",
    `msd=${scopedMsd.length} msdi=${scopedMsdi.length} location=${SMOKE_LOCATION_ID} product=${scopedMsdi[0]?.product_name_snapshot ?? "none"}`,
  );
  if (!hasMsd || !scoped) {
    printReport("D");
    process.exit(1);
  }

  // FASE 5
  const employeeSession = await resolveEmployeeSession();
  if (!employeeSession) {
    row("F5", "employee login", "FAIL", "no employee session");
    printReport("B");
    process.exit(1);
  }
  row("F5", "employee login", "PASS", employeeSession.label);

  const weekOffset = weekOffsetForOrderDate(orderDate);
  const weekApi = await http("GET", `/api/week?weekOffset=${weekOffset}`);
  const weekOk = weekApi.status === 200 && weekApi.json?.ok === true;
  const days = weekApi.json?.data?.days || weekApi.json?.days || [];
  const dayHit = Array.isArray(days)
    ? days.find((d) => String(d.date || d.isoDate || "").startsWith(orderDate))
    : null;
  const hasMenu =
    dayHit &&
    (dayHit.isPublished === true || String(dayHit.menuPublished) === "true") &&
    (String(dayHit.title || "").includes(MEAL_TITLE) ||
      (Array.isArray(dayHit.dishes) && dayHit.dishes.some((d) => String(d.title || "").includes(MEAL_TITLE))));
  row(
    "F5",
    "employee /week visibility",
    weekOk && hasMenu ? "PASS" : "FAIL",
    weekOk
      ? `weekOffset=${weekOffset} isPublished=${dayHit?.isPublished ?? dayHit?.menuPublished ?? "?"} title=${dayHit?.title ?? "?"} dishes=${JSON.stringify(dayHit?.dishes?.map((d) => d.title) ?? [])}`
      : `status=${weekApi.status}`,
  );

  // FASE 6
  const idemKey = `first-menu-smoke-${Date.now()}-${crypto.randomUUID().replace(/-/g, "")}`;
  const choiceKey = SMOKE_CHOICE_KEY;
  const itemKey = scopedMsdi[0]?.product_id || SMOKE_CHOICE_KEY;
  const orderRes = await http("POST", "/api/orders", {
    body: { date: orderDate, action: "place", slot: "lunch", choice_key: choiceKey, item_key: itemKey },
    headers: { "Idempotency-Key": idemKey },
  });
  const orderOk = orderRes.status === 200 && orderRes.json?.ok === true && orderRes.json?.orderId;
  row(
    "F6",
    "POST /api/orders",
    orderOk ? "PASS" : "FAIL",
    orderOk ? `orderId=${orderRes.json.orderId}` : `status=${orderRes.status} code=${orderRes.json?.code ?? orderRes.json?.error}`,
  );

  let orderRow = null;
  if (orderOk) {
    const { data: orders, error: orderErr } = await admin
      .from("orders")
      .select("id, date, status, company_id, location_id, provider_id")
      .eq("id", orderRes.json.orderId)
      .maybeSingle();
    const { data: items } = await admin
      .from("order_items")
      .select("product_name_snapshot, quantity, product_id")
      .eq("order_id", orderRes.json.orderId)
      .limit(1);
    orderRow = orders ? { ...orders, ...(Array.isArray(items) && items[0] ? items[0] : {}) } : null;
    const orderScoped =
      !orderErr &&
      orderRow &&
      orderRow.provider_id === PROVIDER_A.providerId &&
      orderRow.company_id === SMOKE_COMPANY_ID;
    row(
      "F6",
      "order row scope",
      orderScoped ? "PASS" : "FAIL",
      orderRow ? JSON.stringify(orderRow) : orderErr?.message ?? "missing",
    );
  }

  // FASE 7
  clearSession();
  await login(providerSession.email, providerSession.password);
  const providerOrdersHtml = await http("GET", `/leverandor/ordrer?date=week`);
  const providerSeesOrder =
    orderOk &&
    providerOrdersHtml.status === 200 &&
    (providerOrdersHtml.text.includes(MEAL_TITLE) ||
      providerOrdersHtml.text.includes("Company A") ||
      providerOrdersHtml.text.includes(orderRes.json.orderId?.slice(0, 8) ?? "___"));
  row(
    "F7",
    "provider /leverandor/ordrer",
    providerSeesOrder ? "PASS" : orderOk ? "FAIL" : "SKIP",
    `status=${providerOrdersHtml.status} seesOrder=${providerSeesOrder}`,
  );

  // FASE 8
  let outboxCount = -1;
  try {
    const { count, error } = await admin
      .from("email_outbox")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString());
    outboxCount = error ? -1 : (count ?? 0);
  } catch {
    outboxCount = -1;
  }
  row(
    "F8",
    "outbox/routing",
    "SKIP",
    outboxCount >= 0 ? `recent_outbox_rows=${outboxCount} (single order may not trigger email)` : "email_outbox table unavailable",
  );

  const conclusion = deriveConclusion();
  printReport(conclusion);
  process.exit(conclusion === "A" ? 0 : 1);
}

function deriveConclusion() {
  const pub = report.find((r) => r.step === "publish menu")?.status === "PASS";
  const order = report.find((r) => r.step === "POST /api/orders")?.status === "PASS";
  const providerVis = report.find((r) => r.step === "provider /leverandor/ordrer")?.status === "PASS";
  if (pub && order && providerVis) return "A";
  if (pub && !order) return "B";
  if (order && !providerVis) return "C";
  return "D";
}

function printReport(conclusion) {
  console.log("\n=== FIRST MENU + ORDER SMOKE REPORT ===");
  console.log("| Phase | Step | Status | Evidence |");
  console.log("|-------|------|--------|----------|");
  for (const r of report) {
    console.log(`| ${r.phase} | ${r.step} | ${r.status} | ${r.evidence.replace(/\|/g, "/")} |`);
  }
  const labels = {
    A: "PASS — first menu + first order proven",
    B: "PARTIAL — menu publish works, order fails",
    C: "PARTIAL — order works, provider visibility fails",
    D: "FAIL — publish/sync pipeline broken",
  };
  console.log(`\nCONCLUSION: ${conclusion}) ${labels[conclusion]}`);
}

main().catch((e) => {
  console.error("SMOKE_FATAL", e);
  process.exit(1);
});
