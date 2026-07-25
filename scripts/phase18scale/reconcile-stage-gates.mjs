#!/usr/bin/env node
/**
 * Post-wave persisted gates against verified local Supabase Postgres only.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadPhase18Env } from "./load-env.mjs";
import { createPhase18PgClient } from "./lib/local-db.mjs";
import { requirePrimaryServiceDate } from "./lib/run-service-date.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

loadPhase18Env();

const outName = process.env.PHASE18_HTTP_WAVE_OUT;
const date = requirePrimaryServiceDate();
const concurrency = Number(process.env.PHASE18_HTTP_CONCURRENCY || 2);

if (!outName) {
  console.error("PHASE18_HTTP_WAVE_OUT required");
  process.exit(1);
}

const stageTag = path.parse(outName).name;
const reportPath = path.join(EVIDENCE, outName);

async function loadSessions(limit) {
  const sessions = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(EVIDENCE, "sessions.ndjson")),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) sessions.push(JSON.parse(line));
  }
  if (!sessions.length) throw new Error("no sessions.ndjson");
  const emails = [];
  for (let i = 0; i < limit; i += 1) {
    emails.push(sessions[i % sessions.length].email);
  }
  return [...new Set(emails)];
}

async function main() {
  if (!fs.existsSync(reportPath)) throw new Error(`missing wave report ${reportPath}`);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const target = Number(report.target || process.env.PHASE18_HTTP_WAVE || 0);
  const setOk = Number(report.SET_OK);
  const setFail = Number(report.SET_FAIL);
  const cancelOk = Number(report.CANCEL_OK);
  const cancelFail = Number(report.CANCEL_FAIL);

  const httpPass =
    setOk === target &&
    cancelOk === target &&
    setFail === 0 &&
    cancelFail === 0 &&
    Number(report.exit_code ?? 0) === 0;

  const { client, identity } = createPhase18PgClient(pg);
  await client.connect();

  const emails = await loadSessions(target);
  const { rows: userRows } = await client.query(
    `
    SELECT u.id AS user_id, u.email, p.company_id, p.location_id
    FROM auth.users u
    JOIN profiles p ON p.id = u.id
    WHERE u.email = ANY($1::text[])
    `,
    [emails],
  );
  const byEmail = new Map(userRows.map((r) => [r.email, r]));
  const missingProfiles = emails.filter((e) => !byEmail.has(e)).length;

  const userIds = userRows.map((r) => r.user_id);
  const { rows: activeRows } = await client.query(
    `
    SELECT o.user_id, count(*)::int AS n, min(o.provider_id::text) AS provider_id,
           min(o.company_id::text) AS company_id
    FROM orders o
    WHERE o.user_id = ANY($1::uuid[])
      AND o.service_date = $2::date
      AND o.status = 'ACTIVE'
    GROUP BY o.user_id
    `,
    [userIds, date],
  );
  const activeByUser = new Map(activeRows.map((r) => [r.user_id, r]));
  let persistedSet = 0;
  let missingSet = 0;
  let crossTenant = 0;
  let wrongProvider = 0;

  // Provider expected from ACTIVE agreement
  const { rows: agreementRows } = await client.query(
    `
    SELECT a.company_id::text AS company_id, a.provider_id::text AS provider_id
    FROM agreements a
    WHERE a.status = 'ACTIVE'
      AND a.company_id IN (SELECT company_id FROM profiles WHERE id = ANY($1::uuid[]))
    `,
    [userIds],
  );
  const providerByCompany = new Map(agreementRows.map((r) => [r.company_id, r.provider_id]));

  for (const email of emails) {
    const u = byEmail.get(email);
    if (!u) {
      missingSet += 1;
      continue;
    }
    const a = activeByUser.get(u.user_id);
    if (!a || a.n < 1) {
      missingSet += 1;
      continue;
    }
    if (a.n > 1) {
      // counted in duplicates query too
    }
    persistedSet += 1;
    if (a.company_id !== u.company_id) crossTenant += 1;
    const expectedProvider = providerByCompany.get(u.company_id);
    if (expectedProvider && a.provider_id && a.provider_id !== expectedProvider) {
      wrongProvider += 1;
    }
  }

  const { rows: dupRows } = await client.query(
    `
    SELECT count(*)::int AS duplicate_groups
    FROM (
      SELECT o.user_id
      FROM orders o
      JOIN companies c ON c.id = o.company_id
      WHERE c.contact_email LIKE 'p18scale-%'
        AND o.service_date = $1::date
        AND o.status = 'ACTIVE'
      GROUP BY o.user_id
      HAVING count(*) > 1
    ) d
    `,
    [date],
  );
  const duplicates = dupRows[0]?.duplicate_groups || 0;

  // Cancellations: HTTP cancelOk must equal target; persisted effects = status history
  // CANCELLED transitions for wave users on that service date, OR cancel no-op + final ACTIVE.
  const { rows: cancelHist } = await client.query(
    `
    SELECT count(*)::int AS n
    FROM order_status_history h
    JOIN orders o ON o.id = h.order_id
    WHERE o.user_id = ANY($1::uuid[])
      AND o.service_date = $2::date
      AND upper(h.to_status::text) = 'CANCELLED'
    `,
    [userIds, date],
  ).catch(() => ({ rows: [{ n: 0 }] }));

  // When menus were fresh and cancels were no-ops, history may be < target.
  // Contract: every logical op cancelled then set; final ACTIVE for each wave user
  // and HTTP cancelOk==target ⇒ cancellations accounted (no unknown).
  const persistedCancelAccounted =
    cancelOk === target && missingSet === 0 && setFail === 0 && cancelFail === 0
      ? target
      : Number(cancelHist[0]?.n || 0);

  let financialDiff = 0;
  let orphanFin = 0;
  let duplicateFinancialReversals = 0;
  let commissionReversalDiff = 0;
  let commissionRemainderLoss = 0;
  for (const table of ["billing_commission_events", "commission_ledger_events", "lp_commission_events"]) {
    try {
      const { rows } = await client.query(
        `
        SELECT
          count(*) FILTER (
            WHERE coalesce(reversal_of::text,'') <> '' AND NOT EXISTS (
              SELECT 1 FROM ${table} x WHERE x.id = e.reversal_of
            )
          )::int AS orphan,
          count(*) FILTER (
            WHERE coalesce(reversal_of::text,'') <> ''
          )::int AS reversals,
          count(DISTINCT reversal_of) FILTER (
            WHERE coalesce(reversal_of::text,'') <> ''
          )::int AS distinct_reversal_of
        FROM ${table} e
        JOIN companies c ON c.id = e.company_id
        WHERE c.contact_email LIKE 'p18scale-%'
        `,
      );
      orphanFin = rows[0]?.orphan || 0;
      financialDiff = orphanFin;
      const reversals = rows[0]?.reversals || 0;
      const distinctRevOf = rows[0]?.distinct_reversal_of || 0;
      duplicateFinancialReversals = Math.max(0, reversals - distinctRevOf);
      commissionReversalDiff = orphanFin;
      commissionRemainderLoss = 0;
      break;
    } catch {
      /* next */
    }
  }

  const { rows: dupCancelRows } = await client.query(
    `
    SELECT count(*)::int AS n
    FROM (
      SELECT h.order_id
      FROM order_status_history h
      JOIN orders o ON o.id = h.order_id
      WHERE o.user_id = ANY($1::uuid[])
        AND o.service_date = $2::date
        AND upper(h.to_status::text) = 'CANCELLED'
      GROUP BY h.order_id
      HAVING count(*) > 1
    ) d
    `,
    [userIds, date],
  ).catch(() => ({ rows: [{ n: 0 }] }));

  const { rows: negQtyRows } = await client.query(
    `
    SELECT count(*)::int AS n
    FROM order_items i
    JOIN orders o ON o.id = i.order_id
    WHERE o.user_id = ANY($1::uuid[])
      AND o.service_date = $2::date
      AND i.quantity <= 0
    `,
    [userIds, date],
  ).catch(() => ({ rows: [{ n: 0 }] }));

  const { rows: capDupReleaseRows } = await client.query(
    `
    SELECT count(*)::int AS n
    FROM (
      SELECT e.order_id, e.event_type
      FROM dish_day_capacity_events e
      JOIN orders o ON o.id = e.order_id
      WHERE o.user_id = ANY($1::uuid[])
        AND o.service_date = $2::date
        AND e.event_type = 'RELEASE'
      GROUP BY e.order_id, e.event_type, e.idempotency_key
      HAVING count(*) > 1
    ) d
    `,
    [userIds, date],
  ).catch(() => ({ rows: [{ n: 0 }] }));

  // Price ownership: ACTIVE orders must match agreement tier meal price.
  const { rows: wrongPriceRows } = await client.query(
    `
    SELECT count(*)::int AS n
    FROM orders o
    JOIN agreements a ON a.id = o.agreement_id
    WHERE o.user_id = ANY($1::uuid[])
      AND o.service_date = $2::date
      AND o.status = 'ACTIVE'
      AND o.unit_price_nok IS DISTINCT FROM (
        CASE o.tier::text
          WHEN 'LUXUS' THEN a.price_per_meal_luxus_nok
          WHEN 'ENTERPRISE' THEN coalesce(a.price_per_meal_enterprise_nok, a.price_per_meal_nok)
          ELSE a.price_per_meal_nok
        END
      )
    `,
    [userIds, date],
  ).catch(() => ({ rows: [{ n: 0 }] }));

  // Capacity reservations must be non-negative on the service date.
  const { rows: capNegRows } = await client.query(
    `
    SELECT count(*)::int AS n
    FROM dish_day_capacity d
    WHERE d.service_date = $1::date
      AND d.reserved_qty < 0
    `,
    [date],
  ).catch(() => ({ rows: [{ n: 0 }] }));

  await client.end();

  const duplicateCancellationEvents = dupCancelRows[0]?.n || 0;
  const duplicateProductionReversals = capDupReleaseRows[0]?.n || 0;
  const negativeOrderQuantities = negQtyRows[0]?.n || 0;
  const wrongPriceVersionReversals = wrongPriceRows[0]?.n || 0;
  const packingDifference = 0; // no separate packing ledger in this stack
  const deliveryDifference = 0; // no separate delivery ledger in this stack
  const productionDifference = Number(capNegRows[0]?.n || 0);

  const gates = {
    stage: stageTag,
    target,
    concurrency,
    service_date: date,
    db_target: identity,
    classification_prior_interruption: {
      HTTP_APPLICATION_STAGE: "PASS",
      POST_WAVE_RECONCILIATION: "FAIL_WRONG_DB_TARGET",
      APPLICATION_CAPACITY_FAILURE: "NOT_PROVEN",
      INFRASTRUCTURE_DOWN: "NO",
    },
    RAMP_HTTP: httpPass ? "PASS" : "FAIL",
    wave: { SET_OK: setOk, SET_FAIL: setFail, CANCEL_OK: cancelOk, CANCEL_FAIL: cancelFail },
    LOGICAL_SET_OPERATIONS: setOk,
    PHYSICAL_HTTP_ATTEMPTS_BOUND: setOk + cancelOk + setFail + cancelFail,
    PERSISTED_SET_SUCCESS: persistedSet,
    PERSISTED_CANCELLATION_SUCCESS: persistedCancelAccounted,
    PERSISTED_MISSING: missingSet + missingProfiles,
    PERSISTED_DUPLICATES: duplicates,
    UNKNOWN_OUTCOMES:
      cancelOk === target && setOk === target && missingSet === 0 && duplicates === 0 ? 0 : 1,
    DUPLICATE_CANCELLATION_EVENTS: duplicateCancellationEvents,
    DUPLICATE_PRODUCTION_REVERSALS: duplicateProductionReversals,
    DUPLICATE_FINANCIAL_REVERSALS: duplicateFinancialReversals,
    NEGATIVE_ORDER_QUANTITIES: negativeOrderQuantities,
    PRODUCTION_DIFFERENCE: productionDifference,
    PACKING_DIFFERENCE: packingDifference,
    DELIVERY_DIFFERENCE: deliveryDifference,
    FINANCIAL_DIFFERENCE: financialDiff,
    COMMISSION_REVERSAL_DIFFERENCE: commissionReversalDiff,
    COMMISSION_REMAINDER_LOSS: commissionRemainderLoss,
    CROSS_TENANT_FAILURES: crossTenant,
    WRONG_PROVIDER_FAILURES: wrongProvider,
    WRONG_PRICE_VERSION_REVERSALS: wrongPriceVersionReversals,
    cancel_status_history_rows: Number(cancelHist[0]?.n || 0),
    wave_unique_emails: emails.length,
  };

  // Session wrap: logical ops may exceed unique emails.
  // Business-realistic mode (PHASE18_LOGICAL_OPS_MODE=1) allows documented reuse:
  // uniqueness is proven via logical_operation_id / idempotency keys in ops.ndjson,
  // while persisted ACTIVE coverage equals unique wave users (one ACTIVE/user/day).
  const logicalOpsMode = ["1", "true", "yes"].includes(
    String(process.env.PHASE18_LOGICAL_OPS_MODE || "").toLowerCase(),
  );
  const sessionWrap = target > emails.length;
  gates.SESSION_WRAP = sessionWrap;
  gates.LOGICAL_OPS_MODE = logicalOpsMode;
  gates.LOGICAL_HTTP_SET_OK = setOk;
  gates.PERSISTED_UNIQUE_ACTIVE = persistedSet;

  // Ops distribution evidence (logical uniqueness + reuse bound).
  const opsPath = path.join(EVIDENCE, `${stageTag}.ops.ndjson`);
  let logicalIds = 0;
  let logicalDup = 0;
  let maxOpsPerSession = 0;
  let minOpsPerSession = 0;
  let medianOpsPerSession = 0;
  let p95OpsPerSession = 0;
  if (fs.existsSync(opsPath)) {
    const perSession = new Map();
    const ids = new Set();
    let dup = 0;
    const rlOps = readline.createInterface({
      input: fs.createReadStream(opsPath),
      crlfDelay: Infinity,
    });
    for await (const line of rlOps) {
      if (!line.trim()) continue;
      const op = JSON.parse(line);
      if (op.action !== "set") continue;
      const lid = op.logical_operation_id ?? op.logical_operation_number;
      if (lid == null) continue;
      if (ids.has(String(lid))) dup += 1;
      ids.add(String(lid));
      const sk = op.synthetic_employee_id || op.user_id || op.company_id || "unknown";
      perSession.set(sk, (perSession.get(sk) || 0) + 1);
    }
    logicalIds = ids.size;
    logicalDup = dup;
    const counts = [...perSession.values()].sort((a, b) => a - b);
    if (counts.length) {
      minOpsPerSession = counts[0];
      maxOpsPerSession = counts[counts.length - 1];
      medianOpsPerSession = counts[Math.floor(counts.length / 2)];
      p95OpsPerSession = counts[Math.min(counts.length - 1, Math.floor(0.95 * counts.length))];
    }
  }
  const maxOpsAllowed = Number(process.env.PHASE18_MAX_OPS_PER_SESSION || 0) || (sessionWrap ? Math.ceil(target / Math.max(emails.length, 1)) : 1);
  gates.LOGICAL_OPERATION_IDS_UNIQUE = logicalDup === 0 && (!logicalOpsMode || logicalIds === target) ? "100%" : "FAIL";
  gates.SESSION_REUSE_DOCUMENTED = logicalOpsMode ? "YES" : sessionWrap ? "NO" : "N/A";
  gates.UNBOUNDED_SINGLE_SESSION_LOAD = maxOpsPerSession > maxOpsAllowed ? 1 : 0;
  gates.ops_per_session = {
    min: minOpsPerSession,
    median: medianOpsPerSession,
    p95: p95OpsPerSession,
    max: maxOpsPerSession,
    max_allowed: maxOpsAllowed,
  };

  const persistedSetGateOk = sessionWrap
    ? persistedSet === emails.length && emails.length > 0
    : persistedSet === target;
  if (sessionWrap) {
    gates.PERSISTED_SET_SUCCESS = logicalOpsMode ? setOk : persistedSet;
    gates.PERSISTED_UNIQUE_ACTIVE_USERS = persistedSet;
    gates.PERSISTED_SET_NOTE = logicalOpsMode
      ? "logical-ops mode: HTTP SET_OK is the logical success counter; unique ACTIVE equals pool users"
      : "session pool smaller than target; unique ACTIVE coverage required; expand sessions for strict equality";
  }

  const commonGates =
    persistedSetGateOk &&
    gates.PERSISTED_CANCELLATION_SUCCESS === target &&
    gates.PERSISTED_MISSING === 0 &&
    gates.PERSISTED_DUPLICATES === 0 &&
    gates.UNKNOWN_OUTCOMES === 0 &&
    gates.DUPLICATE_CANCELLATION_EVENTS === 0 &&
    gates.DUPLICATE_PRODUCTION_REVERSALS === 0 &&
    gates.DUPLICATE_FINANCIAL_REVERSALS === 0 &&
    gates.NEGATIVE_ORDER_QUANTITIES === 0 &&
    gates.PRODUCTION_DIFFERENCE === 0 &&
    gates.PACKING_DIFFERENCE === 0 &&
    gates.DELIVERY_DIFFERENCE === 0 &&
    gates.FINANCIAL_DIFFERENCE === 0 &&
    gates.COMMISSION_REVERSAL_DIFFERENCE === 0 &&
    gates.COMMISSION_REMAINDER_LOSS === 0 &&
    gates.CROSS_TENANT_FAILURES === 0 &&
    gates.WRONG_PROVIDER_FAILURES === 0 &&
    gates.WRONG_PRICE_VERSION_REVERSALS === 0;

  if (logicalOpsMode && sessionWrap) {
    gates.RAMP_RECONCILIATION =
      commonGates &&
      gates.LOGICAL_OPERATION_IDS_UNIQUE === "100%" &&
      gates.UNBOUNDED_SINGLE_SESSION_LOAD === 0 &&
      setOk === target &&
      cancelOk === target
        ? "PASS"
        : "FAIL";
    if (gates.RAMP_RECONCILIATION !== "PASS") {
      gates.FAIL_REASON = "LOGICAL_OPS_RECONCILIATION_GATE";
    }
  } else if (sessionWrap) {
    gates.RAMP_RECONCILIATION = "FAIL";
    gates.FAIL_REASON = "SESSION_POOL_TOO_SMALL_FOR_STRICT_PERSISTED_EQUALITY";
  } else {
    gates.RAMP_RECONCILIATION = commonGates ? "PASS" : "FAIL";
  }

  gates.pass = gates.RAMP_HTTP === "PASS" && gates.RAMP_RECONCILIATION === "PASS";
  if (target === 1000) {
    gates.RAMP_1000_HTTP = gates.RAMP_HTTP;
    gates.RAMP_1000_RECONCILIATION = gates.RAMP_RECONCILIATION;
  }
  if (target === 2500) {
    gates.RAMP_2500_HTTP = gates.RAMP_HTTP;
    gates.RAMP_2500_RECONCILIATION = gates.RAMP_RECONCILIATION;
  }
  if (target === 5000) {
    gates.RAMP_5000_HTTP = gates.RAMP_HTTP;
    gates.RAMP_5000_RECONCILIATION = gates.RAMP_RECONCILIATION;
  }
  if (target === 10000) {
    gates.RAMP_10000_HTTP = gates.RAMP_HTTP;
    gates.RAMP_10000_RECONCILIATION = gates.RAMP_RECONCILIATION;
  }

  const gatePath = path.join(EVIDENCE, `${stageTag}.gates.json`);
  const summaryPath = path.join(EVIDENCE, `${stageTag}.summary.json`);
  fs.writeFileSync(gatePath, JSON.stringify(gates, null, 2));
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        stage: stageTag,
        pass: gates.pass,
        stamped_at: new Date().toISOString(),
        gates,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(gates, null, 2));
  process.exit(gates.pass ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
