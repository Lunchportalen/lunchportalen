import { describe, expect, it } from "vitest";
import { derivePendingAgreementDraftFromAgreementJson } from "@/lib/server/superadmin/createAgreementDraftFromRegistration";

function baseJson() {
  return {
    version: 1,
    created_at: "2026-04-01T12:00:00.000Z",
    delivery: { window_from: "11:00", window_to: "13:00" },
    terms: { binding_months: 12, notice_months: 3 },
    plan: {
      days: {
        mon: { enabled: true, tier: "BASIS", price_ex_vat: 90 },
        tue: { enabled: true, tier: "BASIS", price_ex_vat: 90 },
        wed: { enabled: false, tier: "BASIS", price_ex_vat: 0 },
        thu: { enabled: true, tier: "BASIS", price_ex_vat: 90 },
        fri: { enabled: false, tier: "BASIS", price_ex_vat: 0 },
      },
    },
  };
}

describe("derivePendingAgreementDraftFromAgreementJson", () => {
  it("utleder fra plan.days med delvis uke og created_at som start", () => {
    const r = derivePendingAgreementDraftFromAgreementJson(baseJson());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params.tier).toBe("BASIS");
    expect(r.params.delivery_days).toEqual(["mon", "tue", "thu"]);
    expect(r.params.price_per_employee).toBe(90);
    expect(r.params.starts_at).toBe("2026-04-01");
    expect(r.params.slot_start).toBe("11:00");
    expect(r.params.slot_end).toBe("13:00");
  });

  it("tillater blandet BASIS/Luxus; RPC-snapshot følger første aktive ukedag (mon→fre)", () => {
    const j = {
      ...baseJson(),
      plan: {
        days: {
          mon: { enabled: true, tier: "BASIS", price_ex_vat: 90 },
          tue: { enabled: true, tier: "LUXUS", price_ex_vat: 130 },
          wed: { enabled: false, tier: "BASIS", price_ex_vat: 0 },
          thu: { enabled: false, tier: "BASIS", price_ex_vat: 0 },
          fri: { enabled: false, tier: "BASIS", price_ex_vat: 0 },
        },
      },
    };
    const r = derivePendingAgreementDraftFromAgreementJson(j);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params.tier).toBe("BASIS");
    expect(r.params.price_per_employee).toBe(90);
    expect(r.params.delivery_days).toEqual(["mon", "tue"]);
  });

  it("bruker eksplisitt plan.start_date når satt", () => {
    const j = {
      ...baseJson(),
      plan: {
        ...(baseJson().plan as object),
        start_date: "2026-05-10",
      },
    };
    const r = derivePendingAgreementDraftFromAgreementJson(j);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params.starts_at).toBe("2026-05-10");
  });

  it("støtter schedule+tiers når uniform tier", () => {
    const j = {
      version: 1,
      created_at: "2026-01-01T00:00:00Z",
      delivery: { window_from: "10:00", window_to: "12:00" },
      commercial: { bindingMonths: 6, noticeMonths: 1 },
      tiers: { LUXUS: { label: "Luxus", price: 130 } },
      schedule: {
        mon: { tier: "LUXUS" },
        tue: { tier: "LUXUS" },
        wed: { tier: "LUXUS" },
        thu: { tier: "LUXUS" },
        fri: { tier: "LUXUS" },
      },
    };
    const r = derivePendingAgreementDraftFromAgreementJson(j);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params.tier).toBe("LUXUS");
    expect(r.params.delivery_days).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(r.params.binding_months).toBe(6);
    expect(r.params.notice_months).toBe(1);
  });

  it("avslår når agreement_json mangler", () => {
    const r = derivePendingAgreementDraftFromAgreementJson(null);
    expect(r.ok).toBe(false);
    if (r.ok === true) throw new Error("expected fail");
    expect(r.code).toBe("AGREEMENT_JSON_MISSING");
  });
});
