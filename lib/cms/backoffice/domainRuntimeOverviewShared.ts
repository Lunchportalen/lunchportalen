/**
 * Pure helpers for domain runtime overview (testbar uten Supabase).
 */

export type CompanyRowPreview = {
  id: string;
  name: string | null;
  status: string | null;
  updated_at: string | null;
  agreement_json: unknown;
  locationCount: number;
};

export function summarizeAgreementJson(agreementJson: unknown): {
  tierLabel: string | null;
  adminEmail: string | null;
  notice: string | null;
} {
  if (agreementJson == null || typeof agreementJson !== "object" || Array.isArray(agreementJson)) {
    return { tierLabel: null, adminEmail: null, notice: null };
  }
  const j = agreementJson as Record<string, unknown>;
  const admin = j.admin && typeof j.admin === "object" && !Array.isArray(j.admin) ? (j.admin as Record<string, unknown>) : null;
  const adminEmail = admin?.email != null ? String(admin.email).trim() || null : null;

  const meal = j.meal_contract && typeof j.meal_contract === "object" && !Array.isArray(j.meal_contract)
    ? (j.meal_contract as Record<string, unknown>)
    : null;
  const tierRaw = meal?.plan_tier ?? j.plan_tier;
  const tierLabel = tierRaw != null ? String(tierRaw).trim() || null : null;

  const notice = j.notice != null ? String(j.notice).trim() || null : null;

  return { tierLabel, adminEmail, notice };
}

export function aggregateLocationCounts(
  rows: Array<{ company_id?: string | null }>
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const id = String(r.company_id ?? "").trim();
    if (!id) continue;
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}
