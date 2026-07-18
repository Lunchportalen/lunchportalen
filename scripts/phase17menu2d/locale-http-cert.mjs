#!/usr/bin/env node
/** Quick 24-locale HTTP re-cert (varmmat) against staging runtime. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadStagingEnv, STAGING_REF } from "./load-staging-env.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../docs/rc/phase17menu2d/evidence");
const LOCALES = [
  "nb-NO","sv-SE","da-DK","fi-FI","en-GB","de-DE","fr-FR","es-ES","it-IT","nl-NL",
  "nl-BE","fr-BE","de-CH","fr-CH","de-AT","en-IE","pl-PL","ro-RO","cs-CZ","pt-PT",
  "el-GR","en-US","en-CA","fr-CA",
];

function mergeSetCookie(existing, setCookieHeaders) {
  const jar = new Map();
  for (const part of String(existing || "").split(";").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const raw of Array.isArray(setCookieHeaders) ? setCookieHeaders : setCookieHeaders ? [setCookieHeaders] : []) {
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
    ...(opts.locale ? { "Accept-Language": opts.locale } : {}),
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
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  const setCookie = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : [];
  return { status: res.status, json, ok: res.ok, setCookie };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { url } = loadStagingEnv();
  const base = String(process.env.PHASE17MENU2D_BASE_URL || process.env.PHASE17MENU2B_BASE_URL || "").replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const password =
    process.env.PHASE17MENU2B_SYNTH_PASSWORD ||
    `Synth2b-${crypto.createHash("sha256").update(`phase17menu2b-${STAGING_REF}`).digest("hex").slice(0, 24)}`;

  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: login, error } = await client.auth.signInWithPassword({
    email: "no-basis-emp@staging.lunchportalen.test",
    password,
  });
  if (error) throw error;
  const sess = await httpJson(base, "/api/auth/session", {
    method: "POST",
    body: { access_token: login.session.access_token, refresh_token: login.session.refresh_token },
  });
  const cookie = mergeSetCookie("", sess.setCookie);
  const token = login.session.access_token;

  const { data: profile } = await admin
    .from("profiles")
    .select("company_id, location_id")
    .eq("email", "no-basis-emp@staging.lunchportalen.test")
    .maybeSingle();
  const { data: company } = await admin
    .from("companies")
    .select("default_location_id, provider_id")
    .eq("id", profile?.company_id || "")
    .maybeSingle();
  const locationId = company?.default_location_id || profile?.location_id;
  const { data: msd } = await admin
    .from("menu_service_days")
    .select("service_date")
    .eq("location_id", locationId)
    .eq("state", "published")
    .gte("service_date", new Date().toISOString().slice(0, 10))
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!msd?.service_date) throw new Error(`no published MSD for location ${locationId}`);
  const date = String(msd.service_date);
  if (company?.provider_id) {
    await admin.from("dish_day_capacity_events").delete().eq("provider_id", company.provider_id).eq("service_date", date);
    await admin.from("dish_day_capacity").delete().eq("provider_id", company.provider_id).eq("service_date", date);
  }
  const flows = [];
  for (const locale of LOCALES) {
    await httpJson(base, "/api/orders", {
      method: "POST", token, cookie, locale,
      body: { date, action: "cancel" },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    const week = await httpJson(base, "/api/week?weekOffset=1", { token, cookie, locale });
    const order = await httpJson(base, "/api/orders", {
      method: "POST", token, cookie, locale,
      body: { date, action: "set", choice_key: "varmmat" },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    flows.push({
      locale,
      ok: week.status === 200 && (order.status === 200 || order.json?.ok === true),
      week_status: week.status,
      order_status: order.status,
      order_error: order.json?.error || order.json?.code || null,
    });
  }
  const ok = flows.filter((f) => f.ok).length;
  const summary = { LIVE_LOCALE_HTTP_E2E: `${ok}/24`, flows };
  fs.writeFileSync(path.join(OUT, "locale-http-24.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ LIVE_LOCALE_HTTP_E2E: summary.LIVE_LOCALE_HTTP_E2E, fails: flows.filter((f) => !f.ok).slice(0, 5) }, null, 2));
  if (ok < 24) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
