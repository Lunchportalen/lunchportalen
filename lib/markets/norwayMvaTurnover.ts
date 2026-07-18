/**
 * Phase 16NO.4 — Automatic Norway MVA threshold controller (pure calculation).
 *
 * Threshold: NOK 50_000.00 = 5_000_000 minor units.
 * Comparison: STRICTLY_GREATER_THAN (exactly 50_000 does NOT exceed).
 * Period: rolling calendar twelve months.
 * Money: BigInt minor units only — no floats.
 */

export const NORWAY_MVA_THRESHOLD_MINOR = BigInt(5_000_000);
/** @deprecated use NORWAY_MVA_THRESHOLD_MINOR */
export const NORWAY_MVA_REGISTRATION_THRESHOLD_MINOR = NORWAY_MVA_THRESHOLD_MINOR;

export const NORWAY_MVA_CURRENCY = "NOK" as const;
export const NORWAY_MVA_COMMISSION_BPS = 500 as const;
export const NORWAY_MVA_THRESHOLD_COMPARISON = "STRICTLY_GREATER_THAN" as const;
export const NORWAY_MVA_THRESHOLD_PERIOD = "ROLLING_12_MONTHS" as const;

/** Warning bands (minor units). */
export const NORWAY_MVA_WARN_EARLY_MINOR = BigInt(3_500_000); // 35_000
export const NORWAY_MVA_WARN_80_MINOR = BigInt(4_000_000); // 40_000
export const NORWAY_MVA_WARN_90_MINOR = BigInt(4_500_000); // 45_000
export const NORWAY_MVA_WARN_98_MINOR = BigInt(4_900_000); // 49_000

/** @deprecated 80% alert constant — prefer band statuses */
export const NORWAY_MVA_OWNER_ALERT_RATIO_BPS = 8000;

export const NO_PLATFORM_SERVICE_NOT_REGISTERED_NO_VAT =
  "NO_PLATFORM_SERVICE_NOT_REGISTERED_NO_VAT" as const;
export const NO_PLATFORM_SERVICE_STANDARD_VAT_25 = "NO_PLATFORM_SERVICE_STANDARD_VAT_25" as const;

export type NorwayMvaThresholdStatus =
  | "BELOW_THRESHOLD"
  | "WARNING_80"
  | "WARNING_90"
  | "WARNING_98"
  | "AT_THRESHOLD"
  | "CROSSING_EVENT_DETECTED"
  | "REGISTRATION_REQUIRED"
  | "REGISTRATION_PENDING"
  | "REGISTERED"
  | "VAT_ACTIVE";

export type CrossingInvoicePolicy = "HOLD_UNTIL_REGISTERED" | "INVOICE_WITH_MVA_RESERVATION_AND_REISSUE";

export const DEFAULT_CROSSING_INVOICE_POLICY: CrossingInvoicePolicy = "HOLD_UNTIL_REGISTERED";

export type NorwayMvaTurnoverSnapshot = {
  taxableServiceTurnoverMinor: bigint;
  thresholdMinor: bigint;
  alertAtMinor: bigint;
  remainingMinor: bigint;
  percentOfThresholdBps: number;
  alert: boolean;
  /** True only when turnover STRICTLY exceeds threshold and not registered. */
  crossed: boolean;
  atExactThreshold: boolean;
  status: NorwayMvaThresholdStatus;
  warningBand: "NONE" | "EARLY_35" | "WARNING_80" | "WARNING_90" | "WARNING_98" | "AT_THRESHOLD" | "CROSSED";
  LUNCHPORTALEN_MVA_REGISTERED: boolean;
  PLATFORM_REAL_MVA_INVOICING: "BLOCKED" | "ELIGIBLE";
  PLATFORM_REAL_INVOICING_WITHOUT_MVA: "ENABLED" | "BLOCKED_PENDING_REGISTRATION";
  taxTreatmentCode: typeof NO_PLATFORM_SERVICE_NOT_REGISTERED_NO_VAT | typeof NO_PLATFORM_SERVICE_STANDARD_VAT_25;
  ownerActionPath: string;
};

function toBigInt(v: bigint | number | string): bigint {
  return typeof v === "bigint" ? v : BigInt(v);
}

export function norwayMvaWarningBand(turnoverMinor: bigint): NorwayMvaTurnoverSnapshot["warningBand"] {
  if (turnoverMinor > NORWAY_MVA_THRESHOLD_MINOR) return "CROSSED";
  if (turnoverMinor === NORWAY_MVA_THRESHOLD_MINOR) return "AT_THRESHOLD";
  if (turnoverMinor >= NORWAY_MVA_WARN_98_MINOR) return "WARNING_98";
  if (turnoverMinor >= NORWAY_MVA_WARN_90_MINOR) return "WARNING_90";
  if (turnoverMinor >= NORWAY_MVA_WARN_80_MINOR) return "WARNING_80";
  if (turnoverMinor >= NORWAY_MVA_WARN_EARLY_MINOR) return "EARLY_35";
  return "NONE";
}

export function deriveNorwayMvaThresholdStatus(input: {
  turnoverMinor: bigint;
  mvaRegistered: boolean;
  vatActive?: boolean;
  registrationPending?: boolean;
  crossingDetected?: boolean;
}): NorwayMvaThresholdStatus {
  if (input.mvaRegistered && input.vatActive) return "VAT_ACTIVE";
  if (input.mvaRegistered) return "REGISTERED";
  if (input.registrationPending) return "REGISTRATION_PENDING";
  if (input.crossingDetected || input.turnoverMinor > NORWAY_MVA_THRESHOLD_MINOR) {
    return input.crossingDetected ? "CROSSING_EVENT_DETECTED" : "REGISTRATION_REQUIRED";
  }
  if (input.turnoverMinor === NORWAY_MVA_THRESHOLD_MINOR) return "AT_THRESHOLD";
  if (input.turnoverMinor >= NORWAY_MVA_WARN_98_MINOR) return "WARNING_98";
  if (input.turnoverMinor >= NORWAY_MVA_WARN_90_MINOR) return "WARNING_90";
  if (input.turnoverMinor >= NORWAY_MVA_WARN_80_MINOR) return "WARNING_80";
  return "BELOW_THRESHOLD";
}

export function evaluateNorwayMvaTurnover(input: {
  taxableServiceTurnoverMinor: bigint | number | string;
  mvaRegistered?: boolean;
  vatActive?: boolean;
  registrationPending?: boolean;
  crossingDetected?: boolean;
}): NorwayMvaTurnoverSnapshot {
  const turnover = toBigInt(input.taxableServiceTurnoverMinor);
  const threshold = NORWAY_MVA_THRESHOLD_MINOR;
  const alertAt = NORWAY_MVA_WARN_80_MINOR;
  const mvaRegistered = input.mvaRegistered === true;
  const atExactThreshold = turnover === threshold;
  const crossed = turnover > threshold && !mvaRegistered;
  const remaining = turnover >= threshold ? BigInt(0) : threshold - turnover;
  const percentOfThresholdBps =
    threshold === BigInt(0) ? 0 : Number((turnover * BigInt(10000)) / threshold);
  const status = deriveNorwayMvaThresholdStatus({
    turnoverMinor: turnover,
    mvaRegistered,
    vatActive: input.vatActive === true,
    registrationPending: input.registrationPending === true,
    crossingDetected: input.crossingDetected === true || crossed,
  });
  const holdTransmission =
    !mvaRegistered &&
    (crossed || input.crossingDetected === true || input.registrationPending === true);

  return {
    taxableServiceTurnoverMinor: turnover,
    thresholdMinor: threshold,
    alertAtMinor: alertAt,
    remainingMinor: remaining,
    percentOfThresholdBps,
    alert: turnover >= alertAt && !mvaRegistered,
    crossed,
    atExactThreshold,
    status,
    warningBand: norwayMvaWarningBand(turnover),
    LUNCHPORTALEN_MVA_REGISTERED: mvaRegistered,
    PLATFORM_REAL_MVA_INVOICING: mvaRegistered ? "ELIGIBLE" : "BLOCKED",
    PLATFORM_REAL_INVOICING_WITHOUT_MVA: holdTransmission
      ? "BLOCKED_PENDING_REGISTRATION"
      : "ENABLED",
    taxTreatmentCode: mvaRegistered
      ? NO_PLATFORM_SERVICE_STANDARD_VAT_25
      : NO_PLATFORM_SERVICE_NOT_REGISTERED_NO_VAT,
    ownerActionPath: "docs/rc/phase16no/evidence/mva/OWNER_MVA_REGISTRATION_ACTION.md",
  };
}

/** Rolling calendar 12-month window ending at `asOf` (UTC date semantics via Date). */
export function rollingTwelveMonthWindow(asOf: Date): { windowStart: Date; windowEnd: Date } {
  const windowEnd = new Date(asOf.getTime());
  const windowStart = new Date(asOf.getTime());
  windowStart.setUTCFullYear(windowStart.getUTCFullYear() - 1);
  return { windowStart, windowEnd };
}

export type AtomicCommissionEvent = {
  id: string;
  recognitionAt: Date;
  commissionNetMinor: bigint;
  excluded?: boolean;
  excludeReason?: string;
};

export type ThresholdPosition = {
  eventId: string;
  beforeMinor: bigint;
  eventMinor: bigint;
  afterMinor: bigint;
  isCrossing: boolean;
  isAtExactThresholdAfter: boolean;
};

/**
 * Walk events in recognition order. An event is a crossing supply iff
 * before <= threshold AND after > threshold (strictly greater after).
 */
export function projectThresholdPositions(
  events: readonly AtomicCommissionEvent[],
  startingTurnoverMinor: bigint = BigInt(0),
): ThresholdPosition[] {
  let running = startingTurnoverMinor;
  const out: ThresholdPosition[] = [];
  const ordered = [...events]
    .filter((e) => !e.excluded)
    .sort((a, b) => a.recognitionAt.getTime() - b.recognitionAt.getTime() || a.id.localeCompare(b.id));

  for (const e of ordered) {
    const before = running;
    const after = before + e.commissionNetMinor;
    const isCrossing = before <= NORWAY_MVA_THRESHOLD_MINOR && after > NORWAY_MVA_THRESHOLD_MINOR;
    out.push({
      eventId: e.id,
      beforeMinor: before,
      eventMinor: e.commissionNetMinor,
      afterMinor: after,
      isCrossing,
      isAtExactThresholdAfter: after === NORWAY_MVA_THRESHOLD_MINOR,
    });
    running = after;
  }
  return out;
}

/**
 * Batch assignment: invoice non-crossing events without MVA; hold crossing + later.
 * Never splits an atomic event.
 */
export function assignInvoiceBatch(positions: readonly ThresholdPosition[]): {
  invoiceWithoutMvaEventIds: string[];
  holdEventIds: string[];
  crossingEventId: string | null;
} {
  const invoiceWithoutMvaEventIds: string[] = [];
  const holdEventIds: string[] = [];
  let crossingEventId: string | null = null;
  let holding = false;

  for (const p of positions) {
    if (holding || p.isCrossing) {
      if (p.isCrossing && !crossingEventId) crossingEventId = p.eventId;
      holding = true;
      holdEventIds.push(p.eventId);
      continue;
    }
    invoiceWithoutMvaEventIds.push(p.eventId);
  }
  return { invoiceWithoutMvaEventIds, holdEventIds, crossingEventId };
}

export function platformMvaMinor(commissionNetMinor: bigint): bigint {
  return (commissionNetMinor * BigInt(2500)) / BigInt(10_000);
}

export function checksumThresholdCalculation(parts: {
  windowStartIso: string;
  windowEndIso: string;
  recognizedMinor: string;
  invoicedMinor: string;
  includedEventIds: string[];
  status: string;
}): string {
  const payload = [
    parts.windowStartIso,
    parts.windowEndIso,
    parts.recognizedMinor,
    parts.invoicedMinor,
    parts.includedEventIds.join(","),
    parts.status,
  ].join("|");
  // FNV-1a 32-bit hex for durable, non-crypto fingerprint (no secret dependency).
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export const NORWAY_PRE_REGISTRATION_INVOICE_NOTE_NB =
  "Lunchportalen AS er ikke registrert i Merverdiavgiftsregisteret. Merverdiavgift er derfor ikke beregnet på denne fakturaen.";
