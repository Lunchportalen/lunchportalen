import { describe, expect, it } from "vitest";

import type { AgreementChangeRequestRow, AgreementSnapshotForResolver } from "@/lib/agreements/changeRequestTypes";
import { parsePackageByDayRequestedChange } from "@/lib/agreements/changeRequestValidation";
import {
  dayKeyFromIsoDate,
  resolveAgreementForDateFromSnapshot,
} from "@/lib/agreements/resolveAgreementForDate";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROVIDER_A = "22222222-2222-4222-8222-222222222222";
const AGREEMENT_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";

function baseSnapshot(overrides: Partial<AgreementSnapshotForResolver> = {}): AgreementSnapshotForResolver {
  return {
    agreementId: AGREEMENT_ID,
    companyId: COMPANY_ID,
    locationId: null,
    providerId: PROVIDER_A,
    status: "ACTIVE",
    deliveryDays: ["mon", "tue", "wed", "thu", "fri"],
    dayTiers: {
      mon: "BASIS",
      tue: "BASIS",
      wed: "BASIS",
      thu: "BASIS",
      fri: "BASIS",
    },
    ...overrides,
  };
}

function approvedFridayEnterpriseRequest(effectiveFrom = "2026-06-01"): AgreementChangeRequestRow {
  return {
    id: REQUEST_ID,
    provider_id: PROVIDER_A,
    company_id: COMPANY_ID,
    agreement_id: AGREEMENT_ID,
    requested_by_user_id: null,
    requested_by_role: "company_admin",
    status: "APPROVED",
    effective_from: effectiveFrom,
    effective_to: null,
    change_type: "PACKAGE_BY_DAY",
    requested_change: {
      day_overrides: {
        fri: { package: "ENTERPRISE" },
      },
    },
    current_snapshot: {},
    note: null,
    approved_by_user_id: null,
    approved_at: "2026-05-20T10:00:00.000Z",
    rejected_by_user_id: null,
    rejected_at: null,
    rejection_reason: null,
    created_at: "2026-05-15T10:00:00.000Z",
    updated_at: "2026-05-20T10:00:00.000Z",
  };
}

describe("resolveAgreementForDateFromSnapshot", () => {
  it("models Pettersen-style ENTERPRISE on Friday only after effective_from", () => {
    const friday = "2026-06-05";
    const monday = "2026-06-01";
    const approved = approvedFridayEnterpriseRequest("2026-06-01");

    const mondayResult = resolveAgreementForDateFromSnapshot({
      snapshot: baseSnapshot(),
      dateISO: monday,
      approvedChangeRequests: [approved],
    });
    const fridayResult = resolveAgreementForDateFromSnapshot({
      snapshot: baseSnapshot(),
      dateISO: friday,
      approvedChangeRequests: [approved],
    });

    expect(mondayResult.ok).toBe(true);
    if (!mondayResult.ok) return;
    expect(mondayResult.tier).toBe("BASIS");
    expect(mondayResult.tierSource).toBe("BASE_AGREEMENT");

    expect(fridayResult.ok).toBe(true);
    if (!fridayResult.ok) return;
    expect(fridayResult.tier).toBe("ENTERPRISE");
    expect(fridayResult.tierSource).toBe("APPROVED_CHANGE_REQUEST");
    expect(fridayResult.changeRequestId).toBe(REQUEST_ID);
  });

  it("keeps base agreement tiers for Monday–Thursday", () => {
    const approved = approvedFridayEnterpriseRequest("2026-06-01");
    for (const date of ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04"]) {
      const result = resolveAgreementForDateFromSnapshot({
        snapshot: baseSnapshot(),
        dateISO: date,
        approvedChangeRequests: [approved],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.tier).toBe("BASIS");
      expect(result.baseDayTiers.fri).toBe("BASIS");
    }
  });

  it("returns BASIS before effective_from even when request is approved", () => {
    const approved = approvedFridayEnterpriseRequest("2026-06-10");
    const result = resolveAgreementForDateFromSnapshot({
      snapshot: baseSnapshot(),
      dateISO: "2026-06-05",
      approvedChangeRequests: [approved],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tier).toBe("BASIS");
    expect(result.tierSource).toBe("BASE_AGREEMENT");
  });

  it("ignores rejected requests", () => {
    const rejected = { ...approvedFridayEnterpriseRequest("2026-06-01"), status: "REJECTED" as const };
    const result = resolveAgreementForDateFromSnapshot({
      snapshot: baseSnapshot(),
      dateISO: "2026-06-05",
      approvedChangeRequests: [rejected],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tier).toBe("BASIS");
  });

  it("ignores cancelled requests", () => {
    const cancelled = { ...approvedFridayEnterpriseRequest("2026-06-01"), status: "CANCELLED" as const };
    const result = resolveAgreementForDateFromSnapshot({
      snapshot: baseSnapshot(),
      dateISO: "2026-06-05",
      approvedChangeRequests: [cancelled],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tier).toBe("BASIS");
  });

  it("does not mutate base snapshot tiers", () => {
    const snapshot = baseSnapshot();
    const approved = approvedFridayEnterpriseRequest("2026-06-01");
    resolveAgreementForDateFromSnapshot({
      snapshot,
      dateISO: "2026-06-05",
      approvedChangeRequests: [approved],
    });
    expect(snapshot.dayTiers.fri).toBe("BASIS");
  });

  it("maps ISO date to weekday deterministically", () => {
    expect(dayKeyFromIsoDate("2026-06-05")).toBe("fri");
    expect(dayKeyFromIsoDate("2026-06-06")).toBeNull();
  });
});

describe("change request validation", () => {
  it("parses friday alias into canonical day key", () => {
    const parsed = parsePackageByDayRequestedChange({
      day_overrides: {
        friday: { package: "ENTERPRISE" },
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.value) return;
    expect(parsed.value.day_overrides.fri?.package).toBe("ENTERPRISE");
  });

  it("rejects empty day_overrides", () => {
    const parsed = parsePackageByDayRequestedChange({ day_overrides: {} });
    expect(parsed.ok).toBe(false);
  });
});
