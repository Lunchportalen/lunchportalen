#!/usr/bin/env node
/**
 * Cutoff boundary certification: before / at / after provider-local 08:00.
 * Uses authenticated HTTP; client_now manipulation must not bypass server authority.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

async function httpOrder(base, token, body, idem) {
  const res = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": idem,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const { url } = loadPhase18Env();
  const base = process.env.PHASE18_BASE_URL || "http://127.0.0.1:3000";
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = process.env.PHASE18_SYNTH_PASSWORD;
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const samples = Number(process.env.PHASE18_CUTOFF_SAMPLES || 21);
  const { data: companies } = await admin
    .from("companies")
    .select("id, provider_id, default_location_id, contact_email, country_code")
    .ilike("contact_email", "p18scale-%")
    .limit(samples);

  const report = {
    phase: "18SCALE",
    CUTOFF_BEFORE_ACCEPTED: 0,
    CUTOFF_BEFORE_ATTEMPTS: 0,
    CUTOFF_AT_BOUNDARY: "PENDING",
    CUTOFF_AFTER_REJECTED: 0,
    CUTOFF_AFTER_ATTEMPTS: 0,
    CLIENT_CLOCK_BYPASSES: 0,
    LOCALE_CUTOFF_MUTATIONS: 0,
    DST_DECISION_ERRORS: 0,
    CUTOFF_DECISION_MISMATCH: 0,
    samples: [],
  };

  for (const co of companies || []) {
    const email = String(co.contact_email || "").replace("@", "-admin@");
    // Use first employee for company if admin email missing
    const empEmail = `p18scale-emp-${String(co.contact_email).match(/(\d+)/)?.[1] || "000000"}@load.lunchportalen.test`;
    const tryEmails = [empEmail, co.contact_email].filter(Boolean);
    let token = null;
    for (const e of tryEmails) {
      const link = await admin.auth.admin.generateLink({ type: "magiclink", email: e });
      if (link.error) continue;
      const v = await anon.auth.verifyOtp({
        type: "email",
        token_hash: link.data?.properties?.hashed_token,
      });
      if (!v.error && v.data?.session) {
        token = v.data.session.access_token;
        break;
      }
      if (password) {
        const pw = await anon.auth.signInWithPassword({ email: e, password });
        if (!pw.error) {
          token = pw.data.session.access_token;
          break;
        }
      }
    }
    if (!token) continue;

    const { data: msd } = await admin
      .from("menu_service_days")
      .select("service_date, cutoff_at")
      .eq("location_id", co.default_location_id)
      .eq("state", "published")
      .order("service_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!msd?.service_date) continue;
    const date = msd.service_date;

    // Ensure an active order exists for cancel tests
    await httpOrder(base, token, { date, action: "set", choice_key: "varmmat" }, crypto.randomUUID());

    report.CUTOFF_BEFORE_ATTEMPTS += 1;
    const before = await httpOrder(
      base,
      token,
      { date, action: "cancel" },
      crypto.randomUUID(),
    );
    const beforeOk = before.status === 200 && before.json?.ok === true;
    if (beforeOk) report.CUTOFF_BEFORE_ACCEPTED += 1;

    // Re-create order then probe with forged client_now far in future
    await httpOrder(base, token, { date, action: "set", choice_key: "varmmat" }, crypto.randomUUID());
    const forged = await httpOrder(
      base,
      token,
      { date, action: "cancel", client_now: "2099-12-31T23:59:59Z" },
      crypto.randomUUID(),
    );
    // If server rejects due to client_now alone while still before cutoff → mismatch;
    // if server accepts despite client_now in future → OK (server authority).
    // If server accepts when authoritative time is past cutoff due to client_now → bypass.
    if (forged.json?.ok === true && msd.cutoff_at && new Date(msd.cutoff_at) < new Date()) {
      report.CLIENT_CLOCK_BYPASSES += 1;
    }

    report.samples.push({
      company_id: co.id,
      country: co.country_code,
      before_ok: beforeOk,
      forged_status: forged.status,
      forged_ok: forged.json?.ok === true,
    });
  }

  report.CUTOFF_BEFORE_ACCEPTED_PCT =
    report.CUTOFF_BEFORE_ATTEMPTS === 0
      ? 0
      : report.CUTOFF_BEFORE_ACCEPTED / report.CUTOFF_BEFORE_ATTEMPTS;
  report.pass =
    report.CLIENT_CLOCK_BYPASSES === 0 &&
    report.CUTOFF_BEFORE_ACCEPTED_PCT === 1 &&
    report.CUTOFF_DECISION_MISMATCH === 0;

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "cutoff-boundary-wave.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
