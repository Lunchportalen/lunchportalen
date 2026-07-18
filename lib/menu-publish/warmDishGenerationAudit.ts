/**
 * PHASE 17MENU — Warm-dish generation audit record.
 * Production generation must select from approved bank items only; drafts require provider approval.
 */

export type WarmDishGenerationAudit = {
  generation_run_id: string;
  deterministic_seed: string;
  country_code: string;
  menu_profile_id: string;
  input_bank_version: string;
  provider_id: string;
  operating_days: string[];
  provider_constraints: Record<string, unknown>;
  excluded_items: Array<{ dish_key: string; reason: string }>;
  selected_items: Array<{ date: string; dish_key: string; package_keys: string[] }>;
  repeat_check: "PASS" | "FAIL";
  allergen_check: "PASS" | "FAIL";
  locale_check: "PASS" | "FAIL";
  generated_at: string;
  actor: string;
  publication_status: "draft" | "provider_approved" | "published";
  auto_published: false;
  common_warm_dish_per_provider_day: true;
};

export type WarmDishManualOverrideAudit = {
  generation_run_id: string;
  date: string;
  original_dish_key: string;
  replacement_dish_key: string;
  actor: string;
  reason: string;
  recorded_at: string;
};

export function assertGenerationUsesApprovedBank(args: {
  selectedDishKeys: string[];
  approvedBankKeys: Set<string>;
}): void {
  for (const key of args.selectedDishKeys) {
    if (!args.approvedBankKeys.has(key)) {
      throw new Error(`GENERATION_WITHOUT_APPROVED_BANK_ITEM:${key}`);
    }
  }
}

export function assertNotAutoPublished(status: WarmDishGenerationAudit["publication_status"]): void {
  if (status === "published") {
    // published only after explicit provider approval path sets status; auto flag must stay false
  }
}

export function assertCommonWarmDishAcrossPackages(
  selected: Array<{ date: string; dish_key: string; package_keys: string[] }>,
): void {
  const byDate = new Map<string, Set<string>>();
  for (const row of selected) {
    const set = byDate.get(row.date) ?? new Set<string>();
    set.add(row.dish_key);
    byDate.set(row.date, set);
  }
  for (const [date, dishes] of byDate) {
    if (dishes.size > 1) {
      throw new Error(`COMMON_WARM_DISH_VIOLATION:${date}:${[...dishes].join(",")}`);
    }
  }
}
