#!/usr/bin/env node
/**
 * Exact per-country legal/tax readiness matrix from production DB + frozen code facts.
 * Never forges TAX_APPROVED / LEGAL_APPROVED. Fail-closed missing items are explicit.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "docs/rc/launch-2026-08-01");
const PROD_REF = "hkpokyapzarefrgqzkos";

const WAVES = {
  1: ["NO", "SE", "DK", "FI"],
  2: ["GB", "IE", "DE", "AT", "CH", "NL", "BE", "FR"],
  3: ["ES", "IT", "PT", "PL", "CZ", "RO", "GR"],
  4: ["US", "CA"],
};

const MARKET_META = {
  NO: { locales: ["nb-NO"], currency: "NOK" },
  SE: { locales: ["sv-SE"], currency: "SEK" },
  DK: { locales: ["da-DK"], currency: "DKK" },
  FI: { locales: ["fi-FI"], currency: "EUR" },
  GB: { locales: ["en-GB"], currency: "GBP" },
  IE: { locales: ["en-IE"], currency: "EUR" },
  DE: { locales: ["de-DE"], currency: "EUR" },
  AT: { locales: ["de-AT"], currency: "EUR" },
  CH: { locales: ["de-CH", "fr-CH"], currency: "CHF" },
  NL: { locales: ["nl-NL"], currency: "EUR" },
  BE: { locales: ["nl-BE", "fr-BE"], currency: "EUR" },
  FR: { locales: ["fr-FR"], currency: "EUR" },
  ES: { locales: ["es-ES"], currency: "EUR" },
  IT: { locales: ["it-IT"], currency: "EUR" },
  PT: { locales: ["pt-PT"], currency: "EUR" },
  PL: { locales: ["pl-PL"], currency: "PLN" },
  CZ: { locales: ["cs-CZ"], currency: "CZK" },
  RO: { locales: ["ro-RO"], currency: "RON" },
  GR: { locales: ["el-GR"], currency: "EUR" },
  US: { locales: ["en-US"], currency: "USD" },
  CA: { locales: ["en-CA", "fr-CA"], currency: "CAD" },
};

function buildDatabaseUrl() {
  const direct = String(process.env.DATABASE_URL || "").trim();
  if (direct && direct.includes(PROD_REF)) return direct;
  const ref = String(process.env.SUPABASE_PROD_PROJECT_REF || "").trim();
  const pw = String(process.env.SUPABASE_PROD_DB_PASSWORD || "").trim();
  if (!ref || !pw) return null;
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
}

function waveFor(cc) {
  for (const [w, list] of Object.entries(WAVES)) {
    if (list.includes(cc)) return Number(w);
  }
  return null;
}

async function main() {
  const databaseUrl = buildDatabaseUrl();
  if (!databaseUrl) throw new Error("NO_DATABASE_URL");
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();

  let rows;
  let approvals;
  let kill;
  try {
    const act = await client.query(
      `select country_code, production_enabled, registration_enabled, ordering_enabled,
              invoice_only_enabled, platform_commission_enabled,
              owner_tax_model_confirmation,
              owner_accepts_tax_classification_responsibility,
              accountant_tax_confirmation,
              accountant_confirmation_waived_by_owner
       from public.country_production_activation
       order by country_code`,
    );
    rows = act.rows;
    const ap = await client.query(
      `select country_code, status, tax_approved_at, legal_approved_at, blocked_reason
       from public.market_approvals order by country_code`,
    );
    approvals = ap.rows;
    const ks = await client.query(
      `select global_cutover_allowed from public.global_activation_kill_switch where id=1`,
    );
    kill = ks.rows[0]?.global_cutover_allowed;
  } finally {
    await client.end().catch(() => {});
  }

  const byAct = new Map(rows.map((r) => [r.country_code, r]));
  const byAppr = new Map(approvals.map((r) => [r.country_code, r]));

  const matrix = [];
  for (const cc of Object.keys(MARKET_META)) {
    const a = byAct.get(cc);
    const m = byAppr.get(cc);
    const meta = MARKET_META[cc];
    const missing = [];

    // Code registry truth (frozen): tax packs are RESEARCHED scaffolding, never APPROVED in code.
    // Production market_approvals timestamps are the only activation-grade tax/legal stamps.
    if (!m?.tax_approved_at) missing.push("market_approvals.tax_approved_at=NULL");
    if (!m?.legal_approved_at) missing.push("market_approvals.legal_approved_at=NULL");
    if (m?.status !== "ACTIVE" && m?.status !== "LEGAL_APPROVED") {
      missing.push(`market_approvals.status=${m?.status || "MISSING"} (need ACTIVE or LEGAL_APPROVED with stamps)`);
    }
    if (a?.owner_tax_model_confirmation !== "CONFIRMED") {
      missing.push(`owner_tax_model_confirmation=${a?.owner_tax_model_confirmation || "MISSING"} (need CONFIRMED)`);
    }
    if (!a?.owner_accepts_tax_classification_responsibility) {
      missing.push("owner_accepts_tax_classification_responsibility=false");
    }
    if (cc !== "NO") {
      missing.push("DB_GUARD:NON_NO_COUNTRY_ACTIVATION_FORBIDDEN (trg_country_production_activation_guard)");
      missing.push("code_tax_pack.reviewStatus=RESEARCHED (not APPROVED)");
      missing.push("code_legal_docs:LEGAL_APPROVED=false");
    }
    if (cc === "US") {
      missing.push("US_JURISDICTION_TAX_APPROVALS incomplete for activation");
    }
    if (cc === "CA") {
      missing.push("CA_PROVINCE_TAX_APPROVALS incomplete for activation");
    }

    const alreadyActive = Boolean(
      a?.production_enabled &&
        a?.registration_enabled &&
        a?.ordering_enabled &&
        a?.invoice_only_enabled &&
        a?.platform_commission_enabled,
    );

    // NO is the sole owner-stamped ACTIVE market in production.
    const ready =
      cc === "NO" &&
      alreadyActive &&
      m?.status === "ACTIVE" &&
      Boolean(m?.tax_approved_at) &&
      Boolean(m?.legal_approved_at) &&
      a?.owner_tax_model_confirmation === "CONFIRMED";

    // Clear NO-only false positives from missing list when ready.
    const missingFinal = ready
      ? []
      : missing.filter((x) => !(cc === "NO" && x.includes("RESEARCHED")));

    matrix.push({
      country: cc,
      wave: waveFor(cc),
      locales: meta.locales,
      currency: meta.currency,
      market_approvals_status: m?.status || null,
      tax_approved_at: m?.tax_approved_at || null,
      legal_approved_at: m?.legal_approved_at || null,
      owner_tax_model_confirmation: a?.owner_tax_model_confirmation || null,
      production_enabled: Boolean(a?.production_enabled),
      registration_enabled: Boolean(a?.registration_enabled),
      ordering_enabled: Boolean(a?.ordering_enabled),
      invoice_only_enabled: Boolean(a?.invoice_only_enabled),
      platform_commission_enabled: Boolean(a?.platform_commission_enabled),
      activation_ready: ready,
      decision: ready
        ? alreadyActive
          ? "ALREADY_ACTIVE_PROCEED_OBSERVE"
          : "READY_FOR_ACTIVATION"
        : "FAIL_CLOSED",
      missing_exact: ready ? [] : missingFinal,
    });
  }

  const ready = matrix.filter((r) => r.activation_ready).map((r) => r.country);
  const blocked = matrix.filter((r) => !r.activation_ready);

  const report = {
    gate: "COUNTRY_LEGAL_TAX_READINESS_MATRIX",
    result: "COMPLETE",
    GLOBAL_CUTOVER_ALLOWED: kill,
    ready_countries: ready,
    fail_closed_countries: blocked.map((r) => r.country),
    counts: {
      ready: ready.length,
      fail_closed: blocked.length,
      total: matrix.length,
    },
    waves: WAVES,
    matrix,
    stamped_at: new Date().toISOString(),
    note: "Exact missing items per country. No generic WAITING_OWNER_LEGAL_TAX collapse.",
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "COUNTRY-LEGAL-TAX-READINESS-MATRIX.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e?.message || e).slice(0, 240) }));
  process.exit(2);
});
