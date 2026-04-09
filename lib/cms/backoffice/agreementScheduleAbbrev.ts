import { normalizeAgreement } from "@/lib/agreements/normalizeAgreement";

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri"] as const;
const DAY_LABEL: Record<(typeof DAY_ORDER)[number], string> = {
  mon: "Man",
  tue: "Tir",
  wed: "Ons",
  thu: "Tor",
  fri: "Fre",
};

/**
 * Kort operativ ukesplan (tier per dag) når agreement_json normaliseres.
 * Brukes kun som CMS-innsyn — ikke ny sannhetskilde.
 */
export function summarizeAgreementScheduleForCms(agreementJson: unknown): {
  ok: true;
  dayTiers: Array<{ day: string; tier: string }>;
  bindingMonths: number;
  noticeMonths: number;
} | { ok: false } {
  const r = normalizeAgreement(agreementJson);
  if (!r.ok) return { ok: false };
  const dayTiers = DAY_ORDER.map((d) => ({
    day: DAY_LABEL[d],
    tier: r.schedule[d].tier,
  }));
  return {
    ok: true,
    dayTiers,
    bindingMonths: r.commercial.bindingMonths,
    noticeMonths: r.commercial.noticeMonths,
  };
}
