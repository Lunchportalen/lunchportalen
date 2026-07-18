/**
 * Phase 16NO.4 — Norway MVA threshold controller (runtime orchestration).
 * Recognized taxable turnover uses commission_ledger.created_at (delivery recognition).
 * Invoiced turnover uses transmitted provider_commission_invoices (ex tax).
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  assignInvoiceBatch,
  checksumThresholdCalculation,
  DEFAULT_CROSSING_INVOICE_POLICY,
  evaluateNorwayMvaTurnover,
  NORWAY_MVA_THRESHOLD_MINOR,
  NORWAY_PRE_REGISTRATION_INVOICE_NOTE_NB,
  projectThresholdPositions,
  rollingTwelveMonthWindow,
  type AtomicCommissionEvent,
  type CrossingInvoicePolicy,
  type NorwayMvaThresholdStatus,
} from "@/lib/markets/norwayMvaTurnover";
import {
  fetchBrregMvaRegistrationStatus,
  LUNCHPORTALEN_AS_ORGNR,
  type BrregMvaCheckResult,
} from "@/lib/integrations/brreg/enhetsregisteret";

function admin() {
  return supabaseAdmin() as any;
}

function toMinorFromExact(v: unknown): bigint {
  // commission_amount_exact is øre-scale numeric; round half-away via Math.round then BigInt.
  const n = Math.round(Number(v ?? 0));
  if (!Number.isFinite(n)) return BigInt(0);
  return BigInt(n);
}

export type NorwayMvaDashboardSnapshot = {
  legalEntity: "Lunchportalen AS";
  orgnr: string;
  asOf: string;
  windowStart: string;
  windowEnd: string;
  mvaRegistered: boolean;
  vat25Eligible: boolean;
  officialCheck: {
    checkedAt: string | null;
    source: string | null;
    registered: boolean | null;
    evidenceReference: string | null;
  };
  recognizedTaxableTurnoverMinor: string;
  invoicedCommissionTurnoverMinor: string;
  recognizedButUninvoicedMinor: string;
  creditedReversedMinor: string;
  heldPendingRegistrationMinor: string;
  thresholdMinor: string;
  remainingMinor: string;
  percentOfThresholdBps: number;
  warningBand: string;
  status: NorwayMvaThresholdStatus;
  crossingEventId: string | null;
  invoiceTransmission: "ENABLED_WITHOUT_MVA" | "BLOCKED_PENDING_MVA_REGISTRATION" | "ENABLED_WITH_MVA";
  crossingPolicy: CrossingInvoicePolicy;
  preRegistrationInvoiceNoteNb: string;
  calculationChecksum: string;
  includedEventIds: string[];
  reconciliation: {
    recognizedButNotInvoiced: string;
    invoicedButNotYetPaid: string;
    paid: string;
    credited: string;
    reversed: string;
    heldPendingRegistration: string;
    differenceRequiringInvestigation: string;
  };
};

const POSITIVE_EVENTS = new Set(["ORDER_COMPLETED", "MANUAL_ADJUSTMENT", "ROUNDING_ADJUSTMENT"]);
const REVERSAL_EVENTS = new Set(["ORDER_CANCELLED", "ORDER_REFUNDED", "ORDER_CORRECTED", "CREDIT_NOTE"]);

/** Classify ledger rows for threshold inclusion. Fail-closed on unknown types. */
export function classifyLedgerEventForThreshold(eventType: string): {
  include: boolean;
  sign: 1 | -1 | 0;
  reason: string | null;
} {
  const t = String(eventType || "").trim().toUpperCase();
  if (POSITIVE_EVENTS.has(t)) return { include: true, sign: 1, reason: null };
  if (REVERSAL_EVENTS.has(t)) return { include: true, sign: -1, reason: null };
  return { include: false, sign: 0, reason: `UNCLASSIFIED_REVENUE_TYPE:${t}` };
}

export async function loadNorwayActivationFromDb(): Promise<{
  mvaRegistered: boolean;
  vat25Eligible: boolean;
  orderingEnabled: boolean;
  commissionEnabled: boolean;
}> {
  const { data } = await admin()
    .from("country_production_activation")
    .select(
      "mva_registered, platform_invoice_vat_25_enabled, ordering_enabled, platform_commission_enabled",
    )
    .eq("country_code", "NO")
    .maybeSingle();
  return {
    mvaRegistered: Boolean(data?.mva_registered),
    vat25Eligible: Boolean(data?.platform_invoice_vat_25_enabled && data?.mva_registered),
    orderingEnabled: Boolean(data?.ordering_enabled),
    commissionEnabled: Boolean(data?.platform_commission_enabled),
  };
}

export async function sumRecognizedTaxableTurnover(asOf: Date = new Date()): Promise<{
  recognizedMinor: bigint;
  creditedReversedMinor: bigint;
  events: AtomicCommissionEvent[];
  excluded: Array<{ id: string; reason: string }>;
  windowStart: Date;
  windowEnd: Date;
}> {
  const { windowStart, windowEnd } = rollingTwelveMonthWindow(asOf);
  const { data, error } = await admin()
    .from("commission_ledger")
    .select("id, event_type, commission_amount_exact, created_at, country_code, currency, reason")
    .eq("country_code", "NO")
    .eq("currency", "NOK")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw Object.assign(new Error("LICENSE_LEDGER_READ_FAILED"), { cause: error });

  const events: AtomicCommissionEvent[] = [];
  const excluded: Array<{ id: string; reason: string }> = [];
  let recognizedMinor = BigInt(0);
  let creditedReversedMinor = BigInt(0);

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const id = String(row.id);
    const reasonText = String(row.reason || "").toLowerCase();
    // Exclude synthetic/test/canary/recovery markers
    if (
      reasonText.includes("canary") ||
      reasonText.includes("test order") ||
      reasonText.includes("recovery-rehearsal") ||
      reasonText.includes("synthetic")
    ) {
      excluded.push({ id, reason: "TEST_OR_CANARY_EXCLUDED" });
      continue;
    }

    const cls = classifyLedgerEventForThreshold(String(row.event_type));
    if (!cls.include) {
      excluded.push({ id, reason: cls.reason || "EXCLUDED" });
      continue;
    }

    const abs = toMinorFromExact(row.commission_amount_exact);
    const signed = cls.sign === -1 ? -abs : abs;
    if (cls.sign === -1) creditedReversedMinor += abs;

    recognizedMinor += signed;
    events.push({
      id,
      recognitionAt: new Date(String(row.created_at)),
      commissionNetMinor: abs,
      excluded: false,
    });
  }

  return { recognizedMinor, creditedReversedMinor, events, excluded, windowStart, windowEnd };
}

export async function sumInvoicedCommissionTurnover(asOf: Date = new Date()): Promise<{
  invoicedMinor: bigint;
  paidMinor: bigint;
  unpaidMinor: bigint;
  creditedMinor: bigint;
}> {
  const { windowStart, windowEnd } = rollingTwelveMonthWindow(asOf);
  const { data, error } = await admin()
    .from("provider_commission_invoices")
    .select(
      "amount_ex_tax_minor, tax_amount_minor, amount_paid_minor, payment_status, kind, issued_at, currency, created_at",
    )
    .eq("currency", "NOK")
    .not("invoice_number", "is", null)
    .gte("issued_at", windowStart.toISOString())
    .lte("issued_at", windowEnd.toISOString());

  if (error) throw Object.assign(new Error("INVOICE_READ_FAILED"), { cause: error });

  let invoicedMinor = BigInt(0);
  let paidMinor = BigInt(0);
  let unpaidMinor = BigInt(0);
  let creditedMinor = BigInt(0);

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const ex = BigInt(Math.round(Number(row.amount_ex_tax_minor ?? 0)));
    const paid = BigInt(Math.round(Number(row.amount_paid_minor ?? 0)));
    if (String(row.kind) === "CREDIT") {
      creditedMinor += ex < BigInt(0) ? -ex : ex;
      invoicedMinor -= ex < BigInt(0) ? -ex : ex;
      continue;
    }
    invoicedMinor += ex;
    paidMinor += paid;
    const status = String(row.payment_status || "");
    if (status !== "paid" && status !== "credited") {
      unpaidMinor += ex - paid > BigInt(0) ? ex - paid : BigInt(0);
    }
  }

  return { invoicedMinor, paidMinor, unpaidMinor, creditedMinor };
}

export async function isNorwayMvaControllerEnabled(): Promise<boolean> {
  const { data, error } = await admin()
    .from("norway_mva_threshold_config")
    .select("controller_enabled")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return false; // dark-deploy / pre-migration: inactive
  return Boolean(data.controller_enabled);
}

export async function loadHeldLedgerIds(): Promise<Set<string>> {
  const { data, error } = await admin()
    .from("norway_mva_invoice_holds")
    .select("ledger_event_id")
    .eq("status", "HELD");
  if (error) return new Set(); // table may not exist pre-migration
  return new Set(((data ?? []) as Array<{ ledger_event_id: string }>).map((r) => String(r.ledger_event_id)));
}

export async function buildNorwayMvaDashboard(asOf: Date = new Date()): Promise<NorwayMvaDashboardSnapshot> {
  const activation = await loadNorwayActivationFromDb();
  const recognized = await sumRecognizedTaxableTurnover(asOf);
  const invoiced = await sumInvoicedCommissionTurnover(asOf);
  const heldIds = await loadHeldLedgerIds();

  let heldPending = BigInt(0);
  for (const e of recognized.events) {
    if (heldIds.has(e.id)) heldPending += e.commissionNetMinor;
  }

  const positions = projectThresholdPositions(recognized.events);
  const batch = assignInvoiceBatch(positions);
  const evalSnap = evaluateNorwayMvaTurnover({
    taxableServiceTurnoverMinor: recognized.recognizedMinor,
    mvaRegistered: activation.mvaRegistered,
    vatActive: activation.vat25Eligible,
    registrationPending: heldIds.size > 0 || Boolean(batch.crossingEventId),
    crossingDetected: Boolean(batch.crossingEventId),
  });

  const recognizedButUninvoicedRaw = recognized.recognizedMinor - invoiced.invoicedMinor;
  const recognizedButUninvoiced =
    recognizedButUninvoicedRaw > BigInt(0) ? recognizedButUninvoicedRaw : BigInt(0);
  // Expected: uninvoiced ≈ held + open pre-threshold backlog. Flag material unexplained gap.
  const explainedUninvoiced = heldPending;
  const investigationRaw = recognizedButUninvoiced - explainedUninvoiced;
  const investigationAbs = investigationRaw < BigInt(0) ? -investigationRaw : investigationRaw;

  const includedEventIds = recognized.events.map((e) => e.id);
  const checksum = checksumThresholdCalculation({
    windowStartIso: recognized.windowStart.toISOString(),
    windowEndIso: recognized.windowEnd.toISOString(),
    recognizedMinor: recognized.recognizedMinor.toString(),
    invoicedMinor: invoiced.invoicedMinor.toString(),
    includedEventIds,
    status: evalSnap.status,
  });

  let invoiceTransmission: NorwayMvaDashboardSnapshot["invoiceTransmission"] = "ENABLED_WITHOUT_MVA";
  if (activation.mvaRegistered && activation.vat25Eligible) {
    invoiceTransmission = "ENABLED_WITH_MVA";
  } else if (
    evalSnap.PLATFORM_REAL_INVOICING_WITHOUT_MVA === "BLOCKED_PENDING_REGISTRATION" ||
    heldIds.size > 0
  ) {
    invoiceTransmission = "BLOCKED_PENDING_MVA_REGISTRATION";
  }

  const { data: lastCheck, error: checkErr } = await admin()
    .from("norway_mva_registration_checks")
    .select("checked_at, official_source, registered_in_mva, evidence_reference")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const last = checkErr ? null : lastCheck;

  return {
    legalEntity: "Lunchportalen AS",
    orgnr: LUNCHPORTALEN_AS_ORGNR,
    asOf: asOf.toISOString(),
    windowStart: recognized.windowStart.toISOString(),
    windowEnd: recognized.windowEnd.toISOString(),
    mvaRegistered: activation.mvaRegistered,
    vat25Eligible: activation.vat25Eligible,
    officialCheck: {
      checkedAt: last?.checked_at ? String(last.checked_at) : null,
      source: last?.official_source ? String(last.official_source) : null,
      registered: typeof last?.registered_in_mva === "boolean" ? last.registered_in_mva : null,
      evidenceReference: last?.evidence_reference ? String(last.evidence_reference) : null,
    },
    recognizedTaxableTurnoverMinor: recognized.recognizedMinor.toString(),
    invoicedCommissionTurnoverMinor: invoiced.invoicedMinor.toString(),
    recognizedButUninvoicedMinor: recognizedButUninvoiced.toString(),
    creditedReversedMinor: recognized.creditedReversedMinor.toString(),
    heldPendingRegistrationMinor: heldPending.toString(),
    thresholdMinor: NORWAY_MVA_THRESHOLD_MINOR.toString(),
    remainingMinor: evalSnap.remainingMinor.toString(),
    percentOfThresholdBps: evalSnap.percentOfThresholdBps,
    warningBand: evalSnap.warningBand,
    status: evalSnap.status,
    crossingEventId: batch.crossingEventId,
    invoiceTransmission,
    crossingPolicy: DEFAULT_CROSSING_INVOICE_POLICY,
    preRegistrationInvoiceNoteNb: NORWAY_PRE_REGISTRATION_INVOICE_NOTE_NB,
    calculationChecksum: checksum,
    includedEventIds,
    reconciliation: {
      recognizedButNotInvoiced: recognizedButUninvoiced.toString(),
      invoicedButNotYetPaid: invoiced.unpaidMinor.toString(),
      paid: invoiced.paidMinor.toString(),
      credited: invoiced.creditedMinor.toString(),
      reversed: recognized.creditedReversedMinor.toString(),
      heldPendingRegistration: heldPending.toString(),
      differenceRequiringInvestigation: (investigationAbs > BigInt(0) ? investigationAbs : BigInt(0)).toString(),
    },
  };
}

/** Persist holds for crossing + later events. Idempotent. */
export async function ensureCrossingHolds(actor: string = "system:norway-mva-controller"): Promise<{
  crossingEventId: string | null;
  heldCount: number;
}> {
  const recognized = await sumRecognizedTaxableTurnover();
  const positions = projectThresholdPositions(recognized.events);
  const batch = assignInvoiceBatch(positions);
  if (!batch.crossingEventId) return { crossingEventId: null, heldCount: 0 };

  const a = admin();
  let heldCount = 0;
  for (const eventId of batch.holdEventIds) {
    const pos = positions.find((p) => p.eventId === eventId);
    const { error } = await a.from("norway_mva_invoice_holds").upsert(
      {
        ledger_event_id: eventId,
        legal_entity: "Lunchportalen AS",
        country_code: "NO",
        status: "HELD",
        is_crossing_event: eventId === batch.crossingEventId,
        threshold_before_minor: Number(pos?.beforeMinor ?? 0),
        threshold_after_minor: Number(pos?.afterMinor ?? 0),
        commission_net_minor: Number(pos?.eventMinor ?? 0),
        policy: DEFAULT_CROSSING_INVOICE_POLICY,
        reason: eventId === batch.crossingEventId
          ? "MVA_REGISTRATION_CROSSING_EVENT"
          : "HELD_AFTER_CROSSING_EVENT",
        held_by: actor,
        held_at: new Date().toISOString(),
      },
      { onConflict: "ledger_event_id" },
    );
    if (!error) heldCount += 1;
  }

  await a.from("norway_mva_threshold_audit").insert({
    event_type: "CROSSING_EVENT_DETECTED",
    legal_entity: "Lunchportalen AS",
    actor,
    previous_state: "BELOW_OR_AT_THRESHOLD",
    new_state: "CROSSING_EVENT_DETECTED",
    reason: "Atomic supply crossed NOK 50_000 strictly greater than threshold",
    source_records: { crossingEventId: batch.crossingEventId, holdEventIds: batch.holdEventIds },
    calculation_checksum: checksumThresholdCalculation({
      windowStartIso: recognized.windowStart.toISOString(),
      windowEndIso: recognized.windowEnd.toISOString(),
      recognizedMinor: recognized.recognizedMinor.toString(),
      invoicedMinor: "0",
      includedEventIds: batch.holdEventIds,
      status: "CROSSING_EVENT_DETECTED",
    }),
    release_sha: String(process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_VERSION || "").trim() || null,
  });

  return { crossingEventId: batch.crossingEventId, heldCount };
}

export async function assertNorwayCommissionInvoiceTransmittable(invoiceId: string): Promise<void> {
  const a = admin();
  const { data: inv } = await a
    .from("provider_commission_invoices")
    .select("id, tax_amount_minor, currency, amount_ex_tax_minor")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) {
    throw Object.assign(new Error("COMMISSION_INVOICE_NOT_FOUND"), { code: "COMMISSION_INVOICE_NOT_FOUND" });
  }

  const tax = Number(inv.tax_amount_minor ?? 0);
  const activation = await loadNorwayActivationFromDb();

  if (tax > 0) {
    if (!activation.mvaRegistered || !activation.vat25Eligible) {
      throw Object.assign(new Error("PLATFORM_MVA_INVOICE_REQUIRES_MVA_REGISTRATION"), {
        code: "PLATFORM_MVA_INVOICE_REQUIRES_MVA_REGISTRATION",
      });
    }
    return;
  }

  // Controller inactive (dark-deploy / pre-activation): allow without-MVA invoices.
  const enabled = await isNorwayMvaControllerEnabled();
  if (!enabled) return;

  const recognized = await sumRecognizedTaxableTurnover();
  const positions = projectThresholdPositions(recognized.events);
  const batch = assignInvoiceBatch(positions);
  const heldIds = await loadHeldLedgerIds();

  if (batch.crossingEventId || heldIds.size > 0) {
    throw Object.assign(new Error("PLATFORM_INVOICE_TRANSMISSION_BLOCKED_PENDING_MVA_REGISTRATION"), {
      code: "PLATFORM_INVOICE_TRANSMISSION_BLOCKED_PENDING_MVA_REGISTRATION",
      crossingEventId: batch.crossingEventId,
    });
  }

  if (recognized.recognizedMinor > NORWAY_MVA_THRESHOLD_MINOR && !activation.mvaRegistered) {
    throw Object.assign(new Error("PLATFORM_INVOICE_TRANSMISSION_BLOCKED_PENDING_MVA_REGISTRATION"), {
      code: "PLATFORM_INVOICE_TRANSMISSION_BLOCKED_PENDING_MVA_REGISTRATION",
    });
  }
}

export async function recordBrregCheckAndMaybeActivate(opts?: {
  fetchImpl?: typeof fetch;
  actor?: string;
  activateVatOnRegister?: boolean;
}): Promise<{ check: BrregMvaCheckResult; statusChanged: boolean; vatActivated: boolean }> {
  const actor = opts?.actor || "system:brreg-poll";
  const check = await fetchBrregMvaRegistrationStatus({ fetchImpl: opts?.fetchImpl });
  const a = admin();

  await a.from("norway_mva_registration_checks").insert({
    orgnr: check.orgnr,
    legal_name: check.legalName,
    registered_in_mva: check.registeredInMvaRegister,
    official_source: check.officialSource,
    checked_at: check.checkedAt,
    evidence_reference: check.evidenceReference,
    checksum: check.rawChecksum,
    ok: check.ok,
    error_code: check.errorCode,
    http_status: check.httpStatus,
    actor,
  });

  if (!check.ok || check.registeredInMvaRegister !== true) {
    return { check, statusChanged: false, vatActivated: false };
  }

  const before = await loadNorwayActivationFromDb();
  let statusChanged = !before.mvaRegistered;
  let vatActivated = false;

  if (opts?.activateVatOnRegister !== false && !before.vat25Eligible) {
    const { error } = await a
      .from("country_production_activation")
      .update({
        mva_registered: true,
        platform_invoice_vat_25_enabled: true,
        updated_by: actor,
        reason: "Official Brønnøysund Merverdiavgiftsregisteret = true",
      })
      .eq("country_code", "NO");
    if (!error) {
      vatActivated = true;
      statusChanged = true;
      await a.from("norway_mva_threshold_audit").insert({
        event_type: "VAT_ACTIVATED",
        legal_entity: "Lunchportalen AS",
        actor,
        previous_state: before.mvaRegistered ? "REGISTERED" : "REGISTRATION_PENDING",
        new_state: "VAT_ACTIVE",
        reason: "Brreg verified registration; enable NO_PLATFORM_SERVICE_STANDARD_VAT_25",
        source_records: { check },
        calculation_checksum: check.rawChecksum,
        release_sha: String(process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_VERSION || "").trim() || null,
      });
    }
  }

  return { check, statusChanged, vatActivated };
}

export async function emitThresholdWarningsIfNeeded(actor: string = "system:norway-mva-warnings"): Promise<{
  emitted: string[];
}> {
  const dash = await buildNorwayMvaDashboard();
  const band = dash.warningBand;
  if (band === "NONE") return { emitted: [] };

  const a = admin();
  const dedupeKey = [
    "Lunchportalen AS",
    band,
    dash.windowStart.slice(0, 10),
    dash.crossingEventId || "none",
    dash.recognizedTaxableTurnoverMinor,
  ].join(":");

  const { data: existing } = await a
    .from("norway_mva_threshold_warnings")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existing?.id) return { emitted: [] };

  const { error } = await a.from("norway_mva_threshold_warnings").insert({
    legal_entity: "Lunchportalen AS",
    threshold_band: band,
    status: dash.status,
    recognized_minor: Number(dash.recognizedTaxableTurnoverMinor),
    invoiced_minor: Number(dash.invoicedCommissionTurnoverMinor),
    remaining_minor: Number(dash.remainingMinor),
    percent_bps: dash.percentOfThresholdBps,
    crossing_event_id: dash.crossingEventId,
    invoice_transmission: dash.invoiceTransmission,
    dedupe_key: dedupeKey,
    payload: dash,
    actor,
  });

  if (error) return { emitted: [] };

  // Durable outbox notification (owner)
  const eventKey = `norway.mva.threshold:${dedupeKey}`;
  await a.from("outbox").upsert(
    {
      event_key: eventKey,
      payload: {
        event: "norway.mva.threshold.warning",
        type: "norway.mva.threshold.warning",
        subject: `Norge MVA-terskel: ${band}`,
        bodyText: [
          `Status: ${dash.status}`,
          `Gjenkjent omsetning: ${Number(dash.recognizedTaxableTurnoverMinor) / 100} NOK`,
          `Fakturert: ${Number(dash.invoicedCommissionTurnoverMinor) / 100} NOK`,
          `Gjenstående til terskel: ${Number(dash.remainingMinor) / 100} NOK`,
          `Fakturatransmisjon: ${dash.invoiceTransmission}`,
          dash.crossingEventId ? `Crossing event: ${dash.crossingEventId}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        band,
        checksum: dash.calculationChecksum,
      },
      status: "PENDING",
      attempts: 0,
    },
    { onConflict: "event_key" },
  );

  return { emitted: [band] };
}

export { NORWAY_PRE_REGISTRATION_INVOICE_NOTE_NB };
