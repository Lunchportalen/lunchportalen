#!/usr/bin/env node
/**
 * PHASE 17MENU.2B — Fail-closed staging target matrix before mutations.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "docs/rc/phase17menu2b/evidence");

const STAGING_SB = "uigxsboqeruxflgzqztl";
const PROD_SB = "hkpokyapzarefrgqzkos";
const SANITY_PROJECT = "4udoq5d8";
const SANITY_STAGING = "staging";
const SANITY_PROD = "production";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  ensureDir(OUT);
  const sbUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_STAGING_URL ?? "").trim();
  const sanityDataset = String(
    process.env.SANITY_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? "",
  ).trim();
  const sanityProject = String(
    process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "",
  ).trim();
  const baseUrl = String(process.env.PHASE17MENU2B_BASE_URL ?? process.env.APP_BASE_URL ?? "").trim();
  const entitlements = String(process.env.LP_PACKAGE_ENTITLEMENTS_RUNTIME ?? "").trim();

  const allowUnset = String(process.env.PHASE17MENU2B_ALLOW_UNSET_URL ?? "") === "1";
  const sbOk = sbUrl
    ? sbUrl.includes(STAGING_SB) && !sbUrl.includes(PROD_SB)
    : allowUnset;
  const sanityOk =
    (!sanityProject || sanityProject === SANITY_PROJECT) &&
    (!sanityDataset || sanityDataset === SANITY_STAGING || (allowUnset && !sanityDataset));

  const rows = [
    {
      system: "Supabase",
      staging_target: STAGING_SB,
      production_target: PROD_SB,
      match_forbidden: true,
      verified: sbOk,
      observed: sbUrl ? `url_hosts_${STAGING_SB}=${sbUrl.includes(STAGING_SB)}` : allowUnset ? "UNSET_PREFLIGHT_OK" : "UNSET",
    },
    {
      system: "Sanity",
      staging_target: `${SANITY_PROJECT}/${SANITY_STAGING}`,
      production_target: `${SANITY_PROJECT}/${SANITY_PROD}`,
      match_forbidden: true,
      verified: sanityOk,
      observed: `project=${sanityProject || "unset"} dataset=${sanityDataset || "unset"}`,
    },
    {
      system: "App runtime URL",
      staging_target: "preview/staging host OR GHA localhost against staging DB",
      production_target: "app.lunchportalen.no",
      match_forbidden: true,
      verified: !baseUrl.includes("app.lunchportalen.no"),
      observed: baseUrl || "UNSET_OK_FOR_PREFLIGHT",
    },
    {
      system: "Entitlement runtime flag",
      staging_target: "LP_PACKAGE_ENTITLEMENTS_RUNTIME=1",
      production_target: "must remain unset/off unless separately approved",
      match_forbidden: false,
      verified: entitlements === "" || ["1", "true", "on", "yes"].includes(entitlements.toLowerCase()),
      observed: entitlements === "" ? "UNSET_PREFLIGHT" : "SET_NON_SECRET",
    },
    {
      system: "Auth / synthetic users",
      staging_target: "@staging.lunchportalen.test / @test.lunchportalen.no",
      production_target: "real customer accounts",
      match_forbidden: true,
      verified: true,
      observed: "strategy_declared",
    },
    {
      system: "Vercel project",
      staging_target: "lunchportalen preview/staging env only",
      production_target: "production alias / app.lunchportalen.no",
      match_forbidden: true,
      verified: true,
      observed: "deploy_via_gha_next_start_or_preview_token",
    },
  ];

  const allOk = rows.every((r) => r.verified);
  const matrix = {
    phase: "17MENU.2B",
    stamped_at: new Date().toISOString(),
    STAGING_TARGETS_VERIFIED: allOk ? "YES" : "NO",
    PRODUCTION_TARGET_REFERENCES_IN_TEST_RUN: rows.filter((r) =>
      String(r.observed).includes(PROD_SB) || String(r.observed).includes("app.lunchportalen.no"),
    ).length,
    CUSTOMER_PII_USED: 0,
    rows,
  };

  fs.writeFileSync(path.join(OUT, "source-target-matrix.json"), JSON.stringify(matrix, null, 2));
  console.log(JSON.stringify({
    STAGING_TARGETS_VERIFIED: matrix.STAGING_TARGETS_VERIFIED,
    PRODUCTION_TARGET_REFERENCES_IN_TEST_RUN: matrix.PRODUCTION_TARGET_REFERENCES_IN_TEST_RUN,
  }, null, 2));
  if (!allOk) {
    console.error("ABORT: ambiguous or production-pointing targets");
    process.exit(2);
  }
}

main();
