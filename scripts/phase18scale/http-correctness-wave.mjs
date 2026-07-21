#!/usr/bin/env node
/**
 * HTTP cancel+set correctness wave (cookie sessions).
 * Records redacted per-operation evidence (no emails/tokens/secrets).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env } from "./load-env.mjs";
import { loginCookieJar } from "./lib/http-session.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const PRICE = { BASIS: 9000, LUXUS: 13000, ENTERPRISE: 17000 };

loadPhase18Env();
const base = (process.env.PHASE18_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const password =
  process.env.PHASE18_SYNTH_PASSWORD ||
  `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`;
const date = process.env.PHASE18_SERVICE_DATE || "2026-07-20";
const target = Number(process.env.PHASE18_HTTP_WAVE || 10000);
const concurrency = Number(process.env.PHASE18_HTTP_CONCURRENCY || 8);
const timeoutMs = Number(process.env.PHASE18_HTTP_TIMEOUT_MS || 20000);
const outName = process.env.PHASE18_HTTP_WAVE_OUT || "http-wave-10k.json";
const stem = path.parse(outName).name;
const progressPath = process.env.PHASE18_PROGRESS_PATH || path.join(OUT, `${stem}.progress.ndjson`);
const opsPath = path.join(OUT, `${stem}.ops.ndjson`);

const sessions = [];
const rl = readline.createInterface({
  input: fs.createReadStream(path.join(OUT, "sessions.ndjson")),
  crlfDelay: Infinity,
});
for await (const line of rl) {
  if (line.trim()) sessions.push(JSON.parse(line));
}
if (!sessions.length) throw new Error("no sessions");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const pathCache = new Map();
const cookieBy = new Map();
const failCodes = {};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(opsPath, "");

function redactBody(json) {
  if (!json || typeof json !== "object") return json ?? null;
  const out = { ...json };
  for (const k of Object.keys(out)) {
    if (/token|password|cookie|authorization|email|secret/i.test(k)) delete out[k];
  }
  if (out.data && typeof out.data === "object") {
    out.data = { ...out.data };
    for (const k of Object.keys(out.data)) {
      if (/token|password|cookie|authorization|email|secret/i.test(k)) delete out.data[k];
    }
  }
  return out;
}

async function resolveMenuPath(s) {
  const key = `${s.user_id}|${date}`;
  if (pathCache.has(key)) return pathCache.get(key);
  const row = {
    synthetic_employee_id: s.user_id || null,
    company_id: s.company_id || null,
    provider_id: s.provider_id || null,
    country: s.country || null,
    locale: s.locale || null,
    package_tier: s.package || null,
    agreement_id: null,
    service_date: date,
    menu_service_day_id: null,
    menu_service_day_item_id: null,
    product_id: null,
    product_sku: null,
    product_category_id: null,
    product_category_slug: null,
    choice_key: "varmmat",
    offered_price: null,
    price_version: null,
    entitlement_result: null,
    first_failed_predicate: null,
  };
  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("company_id, location_id, provider_id")
      .eq("id", s.user_id)
      .maybeSingle();
    if (!prof) {
      row.first_failed_predicate = "missing_profile";
      pathCache.set(key, row);
      return row;
    }
    row.company_id = prof.company_id;
    row.provider_id = prof.provider_id || row.provider_id;
    const { data: agr } = await admin
      .from("agreements")
      .select("id, tier, provider_id")
      .eq("company_id", prof.company_id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!agr) {
      row.first_failed_predicate = "missing_active_agreement";
      pathCache.set(key, row);
      return row;
    }
    row.agreement_id = agr.id;
    row.package_tier = agr.tier || row.package_tier;
    row.provider_id = agr.provider_id || row.provider_id;
    const expect = PRICE[String(agr.tier || "").toUpperCase()] ?? null;
    const { data: msd } = await admin
      .from("menu_service_days")
      .select("id")
      .eq("location_id", prof.location_id)
      .eq("service_date", date)
      .in("state", ["published", "locked"])
      .maybeSingle();
    if (!msd) {
      row.first_failed_predicate = "missing_menu_service_day";
      pathCache.set(key, row);
      return row;
    }
    row.menu_service_day_id = msd.id;
    const { data: items } = await admin
      .from("menu_service_day_items")
      .select("id, product_id, offered_price_cents_ex_vat, products(id, sku, category_id, product_categories(id, name))")
      .eq("menu_service_day_id", msd.id);
    const hit = (items || []).find((it) => {
      const name = it.products?.product_categories?.name || "";
      const slug = String(name)
        .toLowerCase()
        .replace(/æ/g, "e")
        .replace(/ø/g, "o")
        .replace(/å/g, "a")
        .replace(/[^a-z0-9]+/g, "");
      return slug === "varmrett" && (expect == null || it.offered_price_cents_ex_vat === expect);
    });
    if (!hit) {
      row.first_failed_predicate = "offered_price_mismatch_or_missing_msdi";
      pathCache.set(key, row);
      return row;
    }
    row.menu_service_day_item_id = hit.id;
    row.product_id = hit.product_id;
    row.product_sku = hit.products?.sku || null;
    row.product_category_id = hit.products?.category_id || null;
    row.product_category_slug = "varmrett";
    row.offered_price = hit.offered_price_cents_ex_vat;
    const { data: ent } = await admin
      .from("provider_package_entitlements")
      .select("entitlement_key")
      .eq("provider_id", row.provider_id)
      .eq("package_key", String(row.package_tier || "").toUpperCase())
      .eq("is_enabled", true);
    const keys = new Set((ent || []).map((e) => e.entitlement_key));
    row.entitlement_result =
      keys.has("menu_category:warm_meal") || keys.has("warm_meal") || keys.has("auto_warm_meal")
        ? "PASS"
        : "FAIL";
  } catch (e) {
    row.first_failed_predicate = `lookup_exception:${e?.message || e}`;
  }
  pathCache.set(key, row);
  return row;
}

async function cookie(s, force = false) {
  if (!force && cookieBy.has(s.user_id)) return cookieBy.get(s.user_id);
  const jar = await loginCookieJar(base, s.email, password);
  cookieBy.set(s.user_id, jar.cookie);
  return jar.cookie;
}

async function postOrder(c, body, idem) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: {
        Cookie: c,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": idem,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json, ok: res.status === 200 && json?.ok === true };
  } finally {
    clearTimeout(t);
  }
}

function noteFail(prefix, res) {
  const code = res?.json?.code || res?.json?.error || `HTTP_${res?.status || "ERR"}`;
  const key = `${prefix}:${code}`;
  failCodes[key] = (failCodes[key] || 0) + 1;
}

function appendOp(rec) {
  fs.appendFileSync(opsPath, `${JSON.stringify(rec)}\n`);
}

let i = 0;
let setOk = 0;
let setFail = 0;
let cancelOk = 0;
let cancelFail = 0;

async function worker() {
  while (true) {
    const idx = i;
    i += 1;
    if (idx >= target) return;
    const s = sessions[idx % sessions.length];
    const menuPath = await resolveMenuPath(s);
    const baseRec = {
      logical_operation_number: idx,
      ...menuPath,
      idempotency_key_cancel: `p18-wave-c-${idx}`,
      idempotency_key_set: `p18-wave-s-${idx}`,
    };
    try {
      let c = await cookie(s);
      let cancel = await postOrder(c, { date, action: "cancel" }, baseRec.idempotency_key_cancel);
      if (!cancel.ok && (cancel.status === 401 || cancel.status === 403)) {
        c = await cookie(s, true);
        cancel = await postOrder(c, { date, action: "cancel" }, `${baseRec.idempotency_key_cancel}-retry`);
      }
      if (cancel.ok) cancelOk += 1;
      else {
        cancelFail += 1;
        noteFail("cancel", cancel);
      }
      appendOp({
        ...baseRec,
        action: "cancel",
        http_status: cancel.status,
        api_code: cancel.json?.code || cancel.json?.error || null,
        response_body: redactBody(cancel.json),
        persisted_result: cancel.ok ? "CANCEL_OK" : "CANCEL_FAIL",
        stamped_at: new Date().toISOString(),
      });

      let set = await postOrder(c, { date, action: "set", choice_key: "varmmat" }, baseRec.idempotency_key_set);
      if (!set.ok && (set.status === 401 || set.status === 403)) {
        c = await cookie(s, true);
        set = await postOrder(c, { date, action: "set", choice_key: "varmmat" }, `${baseRec.idempotency_key_set}-retry`);
      }
      if (set.ok) setOk += 1;
      else {
        setFail += 1;
        noteFail("set", set);
      }
      appendOp({
        ...baseRec,
        action: "set",
        http_status: set.status,
        api_code: set.json?.code || set.json?.error || null,
        response_body: redactBody(set.json),
        persisted_result: set.ok ? "SET_OK" : "SET_FAIL",
        stamped_at: new Date().toISOString(),
      });
    } catch (e) {
      setFail += 1;
      cancelFail += 1;
      const key = `exception:${e?.name || "Error"}`;
      failCodes[key] = (failCodes[key] || 0) + 1;
      appendOp({
        ...baseRec,
        action: "exception",
        http_status: null,
        api_code: key,
        response_body: null,
        exception_message: String(e?.message || e),
        exception_stack: String(e?.stack || "").split("\n").slice(0, 8),
        persisted_result: "EXCEPTION",
        stamped_at: new Date().toISOString(),
      });
    }
    const done = setOk + setFail;
    if (done > 0 && done % 50 === 0) {
      const snap = {
        done,
        setOk,
        setFail,
        cancelOk,
        cancelFail,
        target,
        failCodes,
        stamped_at: new Date().toISOString(),
      };
      try {
        fs.appendFileSync(progressPath, `${JSON.stringify(snap)}\n`);
      } catch {
        /* best-effort */
      }
      if (done % 500 === 0) console.log(JSON.stringify(snap));
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const report = {
  phase: "18SCALE",
  target,
  concurrency,
  timeoutMs,
  service_date: date,
  SET_OK: setOk,
  SET_FAIL: setFail,
  CANCEL_OK: cancelOk,
  CANCEL_FAIL: cancelFail,
  failCodes,
  ops_path: path.basename(opsPath),
  stamped_at: new Date().toISOString(),
};
fs.writeFileSync(path.join(OUT, outName), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(setFail === 0 && cancelFail === 0 ? 0 : 2);
