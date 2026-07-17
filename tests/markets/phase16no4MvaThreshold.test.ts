import { describe, expect, it } from "vitest";
import {
  assignInvoiceBatch,
  checksumThresholdCalculation,
  evaluateNorwayMvaTurnover,
  NORWAY_MVA_THRESHOLD_MINOR,
  NORWAY_PRE_REGISTRATION_INVOICE_NOTE_NB,
  platformMvaMinor,
  projectThresholdPositions,
  rollingTwelveMonthWindow,
  type AtomicCommissionEvent,
} from "@/lib/markets/norwayMvaTurnover";

function ev(id: string, minor: number, dayOffset = 0): AtomicCommissionEvent {
  const recognitionAt = new Date(Date.UTC(2026, 6, 1 + dayOffset, 12, 0, 0));
  return { id, recognitionAt, commissionNetMinor: BigInt(minor) };
}

describe("Phase 16NO.4 — Norway MVA threshold automation", () => {
  it("1–2: NOK 0 and early 35k warning band", () => {
    const zero = evaluateNorwayMvaTurnover({ taxableServiceTurnoverMinor: 0, mvaRegistered: false });
    expect(zero.crossed).toBe(false);
    expect(zero.PLATFORM_REAL_INVOICING_WITHOUT_MVA).toBe("ENABLED");
    expect(zero.PLATFORM_REAL_MVA_INVOICING).toBe("BLOCKED");
    expect(zero.warningBand).toBe("NONE");

    const early = evaluateNorwayMvaTurnover({
      taxableServiceTurnoverMinor: BigInt(3_500_000),
      mvaRegistered: false,
    });
    expect(early.warningBand).toBe("EARLY_35");
    expect(early.crossed).toBe(false);
  });

  it("3–5: 80/90/98% warning bands", () => {
    expect(
      evaluateNorwayMvaTurnover({ taxableServiceTurnoverMinor: BigInt(4_000_000) }).warningBand,
    ).toBe("WARNING_80");
    expect(
      evaluateNorwayMvaTurnover({ taxableServiceTurnoverMinor: BigInt(4_500_000) }).warningBand,
    ).toBe("WARNING_90");
    expect(
      evaluateNorwayMvaTurnover({ taxableServiceTurnoverMinor: BigInt(4_900_000) }).warningBand,
    ).toBe("WARNING_98");
  });

  it("6–7: exactly NOK 50_000 is NOT exceeded", () => {
    const exact = evaluateNorwayMvaTurnover({
      taxableServiceTurnoverMinor: NORWAY_MVA_THRESHOLD_MINOR,
      mvaRegistered: false,
    });
    expect(exact.crossed).toBe(false);
    expect(exact.atExactThreshold).toBe(true);
    expect(exact.status).toBe("AT_THRESHOLD");
    expect(exact.PLATFORM_REAL_INVOICING_WITHOUT_MVA).toBe("ENABLED");

    const positions = projectThresholdPositions([ev("a", 4_950_000), ev("b", 50_000, 1)]);
    expect(positions[1]?.afterMinor).toBe(NORWAY_MVA_THRESHOLD_MINOR);
    expect(positions[1]?.isCrossing).toBe(false);
  });

  it("8–9: atomic NOK 1_000 crossing supply is not split", () => {
    const positions = projectThresholdPositions([ev("a", 4_950_000), ev("b", 100_000, 1)]);
    expect(positions[1]?.isCrossing).toBe(true);
    expect(positions[1]?.eventMinor).toBe(BigInt(100_000));
    expect(positions[1]?.afterMinor).toBe(BigInt(5_050_000));
    const batch = assignInvoiceBatch(positions);
    expect(batch.crossingEventId).toBe("b");
    expect(batch.invoiceWithoutMvaEventIds).toEqual(["a"]);
    expect(batch.holdEventIds).toEqual(["b"]);
  });

  it("10: invoice batching stops before crossing and holds later events", () => {
    // Start 49_000; A 500 → 49_500; B 1_000 → 50_500 crossing; C held
    const positions = projectThresholdPositions(
      [ev("A", 50_000), ev("B", 100_000, 1), ev("C", 75_000, 2)],
      BigInt(4_900_000),
    );
    expect(positions[0]?.isCrossing).toBe(false);
    expect(positions[1]?.isCrossing).toBe(true);
    const batch = assignInvoiceBatch(positions);
    expect(batch.invoiceWithoutMvaEventIds).toEqual(["A"]);
    expect(batch.holdEventIds).toEqual(["B", "C"]);
    expect(batch.crossingEventId).toBe("B");
  });

  it("11–12: recognition uses event timestamps; invoice date not in pure calc", () => {
    const early = ev("old", 100_000, -400);
    const recent = ev("new", 100_000, 0);
    const positions = projectThresholdPositions([recent, early]);
    expect(positions[0]?.eventId).toBe("old");
    expect(positions[1]?.eventId).toBe("new");
  });

  it("13: rolling twelve-month window is calendar year back", () => {
    const asOf = new Date(Date.UTC(2026, 6, 17, 15, 0, 0));
    const { windowStart, windowEnd } = rollingTwelveMonthWindow(asOf);
    expect(windowEnd.toISOString()).toBe(asOf.toISOString());
    expect(windowStart.getUTCFullYear()).toBe(2025);
    expect(windowStart.getUTCMonth()).toBe(6);
    expect(windowStart.getUTCDate()).toBe(17);
  });

  it("14–20: pre-registration invoicing semantics and VAT math", () => {
    const below = evaluateNorwayMvaTurnover({
      taxableServiceTurnoverMinor: BigInt(4_000_000),
      mvaRegistered: false,
    });
    expect(below.taxTreatmentCode).toBe("NO_PLATFORM_SERVICE_NOT_REGISTERED_NO_VAT");
    expect(below.PLATFORM_REAL_MVA_INVOICING).toBe("BLOCKED");
    expect(NORWAY_PRE_REGISTRATION_INVOICE_NOTE_NB).toMatch(/ikke registrert/i);
    expect(NORWAY_PRE_REGISTRATION_INVOICE_NOTE_NB.toLowerCase()).not.toMatch(
      /fritatt|nullsats|zero-rated|exempt/,
    );

    const crossed = evaluateNorwayMvaTurnover({
      taxableServiceTurnoverMinor: BigInt(5_050_000),
      mvaRegistered: false,
      crossingDetected: true,
    });
    expect(crossed.PLATFORM_REAL_INVOICING_WITHOUT_MVA).toBe("BLOCKED_PENDING_REGISTRATION");
    expect(crossed.PLATFORM_REAL_MVA_INVOICING).toBe("BLOCKED");

    expect(platformMvaMinor(BigInt(100_000))).toBe(BigInt(25_000));
    const registered = evaluateNorwayMvaTurnover({
      taxableServiceTurnoverMinor: BigInt(5_050_000),
      mvaRegistered: true,
      vatActive: true,
    });
    expect(registered.status).toBe("VAT_ACTIVE");
    expect(registered.taxTreatmentCode).toBe("NO_PLATFORM_SERVICE_STANDARD_VAT_25");
  });

  it("checksum is stable for identical inputs", () => {
    const a = checksumThresholdCalculation({
      windowStartIso: "2025-07-17T00:00:00.000Z",
      windowEndIso: "2026-07-17T00:00:00.000Z",
      recognizedMinor: "4000000",
      invoicedMinor: "3900000",
      includedEventIds: ["e1", "e2"],
      status: "WARNING_80",
    });
    const b = checksumThresholdCalculation({
      windowStartIso: "2025-07-17T00:00:00.000Z",
      windowEndIso: "2026-07-17T00:00:00.000Z",
      recognizedMinor: "4000000",
      invoicedMinor: "3900000",
      includedEventIds: ["e1", "e2"],
      status: "WARNING_80",
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(8);
  });
});
