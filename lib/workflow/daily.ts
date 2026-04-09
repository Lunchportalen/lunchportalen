export type CompanyRef = { id: string };

/**
 * Representerer planlagt dagsrytme (integrasjon / lock-in via arbeidsflyt — ikke hard låsing).
 */
export function generateDailyPlan(company: CompanyRef): {
  companyId: string;
  meals: "generated";
  schedule: "locked";
  timestamp: number;
} {
  return {
    companyId: String(company.id ?? "").trim() || "unknown",
    meals: "generated",
    schedule: "locked",
    timestamp: Date.now(),
  };
}
