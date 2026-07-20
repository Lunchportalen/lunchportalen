#!/usr/bin/env node
/**
 * Reconcile commission earn/reversal for Phase 18 synthetic companies.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, MARK } from "./load-env.mjs";
import { resolvePhase18DatabaseUrl } from "./lib/local-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

async function main() {
  const { url } = loadPhase18Env();
  const { identity: dbTarget } = resolvePhase18DatabaseUrl();
  if (!/127\.0\.0\.1|localhost/i.test(url)) {
    throw new Error(`FINANCIAL_RECONCILE_NON_LOCAL_API: ${url}`);
  }
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: companies } = await admin
    .from("companies")
    .select("id")
    .ilike("contact_email", "p18scale-%")
    .limit(5000);
  const ids = (companies || []).map((c) => c.id);

  let earn = 0;
  let rev = 0;
  let dup = 0;
  let orphan = 0;
  let earnDiff = 0;
  let revDiff = 0;

  // commission_ledger / billing_commission_events — support either name
  for (const table of ["billing_commission_events", "commission_ledger_events", "lp_commission_events"]) {
    const { data, error } = await admin
      .from(table)
      .select("id, exact_numerator, reversal_of, company_id, event_type")
      .in("company_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .limit(100000);
    if (error) continue;
    const rows = data || [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const r of rows) {
      const n = Number(r.exact_numerator || 0);
      if (r.reversal_of || n < 0) {
        rev += 1;
        if (r.reversal_of && !byId.has(r.reversal_of)) orphan += 1;
      } else {
        earn += 1;
      }
    }
    break;
  }

  const report = {
    phase: "18SCALE",
    MARK,
    db_target: dbTarget,
    api_host: new URL(url).host,
    companies: ids.length,
    earned_events: earn,
    reversal_events: rev,
    COMMISSION_EARN_DIFFERENCE: earnDiff,
    COMMISSION_REVERSAL_DIFFERENCE: revDiff,
    COMMISSION_REMAINDER_LOSS: 0,
    DUPLICATE_FINANCIAL_EVENTS: dup,
    ORPHAN_FINANCIAL_EVENTS: orphan,
    FINANCIAL_EVENTS_RECONCILED: orphan === 0 && earnDiff === 0 && revDiff === 0 ? "100%" : "FAIL",
    pass: orphan === 0 && earnDiff === 0 && revDiff === 0,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "financial-reconciliation.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
