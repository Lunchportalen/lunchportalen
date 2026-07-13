#!/usr/bin/env node
/**
 * STAGING-ONLY: backoffice content workspace E2E fixture.
 *
 * The content editor loads the `preview`-environment variant (CMS_DRAFT_ENVIRONMENT).
 * The staging `home` page historically only had a `prod` variant, so the editor
 * showed the fail-closed "Siden finnes ikke" state and the authenticated backoffice
 * E2E scenarios failed. This seeds the missing nb/preview variant (copy of prod body).
 *
 * Idempotent; refuses to run against prod.
 */
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "uigxsboqeruxflgzqztl";
const PROD_REF = "hkpokyapzarefrgqzkos";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnvFile(path.join(process.cwd(), ".env.local")), ...process.env };
const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url.includes(STAGING_REF) || url.includes(PROD_REF)) {
  console.error("ABORT: staging-only Supabase URL required (never prod)");
  process.exit(2);
}
if (!serviceKey) {
  console.error("ABORT: SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(2);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: page, error: pErr } = await admin
  .from("content_pages")
  .select("id, slug, title")
  .eq("slug", "home")
  .maybeSingle();
if (pErr || !page) {
  console.error(`ABORT: home page not found in staging (${pErr?.message ?? "missing"})`);
  process.exit(2);
}

const { data: variants, error: vErr } = await admin
  .from("content_page_variants")
  .select("id, locale, environment, body")
  .eq("page_id", page.id);
if (vErr) {
  console.error(`ABORT: variants read failed: ${vErr.message}`);
  process.exit(2);
}

const hasPreviewNb = (variants ?? []).some((v) => v.locale === "nb" && v.environment === "preview");
if (hasPreviewNb) {
  console.log("OK: home nb/preview variant already present — nothing to do");
  process.exit(0);
}

const source =
  (variants ?? []).find((v) => v.locale === "nb" && v.environment === "prod") ?? (variants ?? [])[0] ?? null;
const body = source?.body ?? { blocks: [] };

const { error: upErr } = await admin.from("content_page_variants").upsert(
  {
    page_id: page.id,
    locale: "nb",
    environment: "preview",
    body,
    updated_at: new Date().toISOString(),
  },
  { onConflict: "page_id,locale,environment" },
);
if (upErr) {
  console.error(`FAIL: variant upsert: ${upErr.message}`);
  process.exit(1);
}

console.log(`OK: seeded nb/preview variant for '${page.slug}' (${page.id}) from ${source ? `${source.locale}/${source.environment}` : "empty body"}`);
