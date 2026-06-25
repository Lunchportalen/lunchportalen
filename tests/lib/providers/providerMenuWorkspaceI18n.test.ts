import { describe, expect, it } from "vitest";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  resolveNextStepAction,
  statusChipLabelKey,
  summarizeWeekMetrics,
  weekReadinessKey,
} from "@/lib/provider-menu/providerMenuWorkspace";
import {
  providerWorkspaceCategories,
  summarizeWorkspaceWeekStatusKey,
} from "@/lib/provider-menu/providerMenuCatalogSurface";
import {
  validateEnterprisePublish,
  WEEKDAY_KEYS,
} from "@/lib/providers/providerMenuPackageSurface";
import { PROD_LUNCH_CATEGORY_FIXTURE } from "../provider-menu/lunchCategoryCatalogFixtures";

const LOCALES = ["nb", "en", "sv", "da", "fi", "de", "fr", "es", "it"] as const;

describe("provider menu workspace i18n", () => {
  it.each(LOCALES)("loads workspace and validation keys for %s", async (locale) => {
    const messages = (await loadMessagesForLocale(locale)) as {
      provider: {
        menu: {
          validation: { enterprise: Record<string, string> };
          workspace: {
            status: Record<string, string>;
            catalogStatus: Record<string, string>;
            nextStep: Record<string, string>;
            weekdaysPossessive: Record<string, string>;
            readiness: Record<string, string>;
          };
        };
      };
    };
    expect(messages.provider.menu.validation.enterprise.upgradeRequired).toBeTruthy();
    expect(messages.provider.menu.validation.enterprise.weakValue).toBeTruthy();
    expect(messages.provider.menu.validation.enterprise.lowMargin).toBeTruthy();
    expect(messages.provider.menu.workspace.status.published).toBeTruthy();
    expect(messages.provider.menu.workspace.nextStep.publish_week).toBeTruthy();
    expect(messages.provider.menu.workspace.weekdaysPossessive.mon).toBeTruthy();
    expect(messages.provider.menu.workspace.readiness.not_ready).toBeTruthy();
    expect(messages.provider.menu.workspace.catalogStatus.missing_warm_dish).toBeTruthy();
  });

  it("status chip labels map to stable keys", () => {
    expect(statusChipLabelKey("published")).toBe("published");
    expect(statusChipLabelKey("missing")).toBe("missing");
  });

  it("validateEnterprisePublish returns messageKey without changing rules", () => {
    const warnings = validateEnterprisePublish({
      tier: "ENTERPRISE",
      mealTitle: "Samme rett",
      description: "Uten upgrade",
      sourcePackage: null,
      upgradeType: null,
      upgradeNote: "",
      estimatedCostPerPortion: null,
      luxusEstimatedCost: null,
      priceExVatNok: 170,
    });
    expect(warnings.some((w) => w.code === "WEAK_VALUE" && w.messageKey === "weakValue")).toBe(true);
    expect(warnings.every((w) => Boolean(w.messageKey))).toBe(true);
  });

  it("resolveNextStepAction returns key ids for weekday labels", () => {
    const dates = ["2026-06-15", "2026-06-16"];
    const categories = providerWorkspaceCategories(PROD_LUNCH_CATEGORY_FIXTURE, "BASIS");
    const metrics = summarizeWeekMetrics({}, dates, "BASIS", categories, PROD_LUNCH_CATEGORY_FIXTURE);
    const step = resolveNextStepAction(
      {},
      dates,
      "BASIS",
      metrics,
      [WEEKDAY_KEYS[0]!, WEEKDAY_KEYS[1]!],
      PROD_LUNCH_CATEGORY_FIXTURE,
    );
    expect(step.key).toBe("fill_warm_dish_for_day");
    if (step.key === "fill_warm_dish_for_day") {
      expect(step.weekdayKey).toBe("mon");
    }
    expect(weekReadinessKey(metrics)).toBe("not_ready");
    expect(
      summarizeWorkspaceWeekStatusKey({}, dates, "BASIS", PROD_LUNCH_CATEGORY_FIXTURE),
    ).toBe("has_draft");
  });
});
