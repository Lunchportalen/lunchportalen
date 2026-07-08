import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const guardedFiles = [
  "app/(app)/week/EmployeeWeekClient.tsx",
  "components/week/WeekMenuReadOnly.tsx",
  "app/admin/dashboard/MyLunchCard.tsx",
  "components/admin/AgreementBlock.tsx",
  "components/providers/ProviderMenuCommandHeader.tsx",
  "components/providers/ProviderMenuPricePreviewStrip.tsx",
  "components/providers/ProviderMenuBuilder.tsx",
  "components/providers/ProviderMenuEditor.tsx",
  "components/providers/ProviderMenuCatalogEditor.tsx",
  "components/providers/RegistrationApproveDialog.tsx",
  "components/providers/ProviderCustomerAgreementEditDialog.tsx",
  "components/auth/CompanyRegistrationForm.tsx",
  "components/onboarding/PlanStep.tsx",
];

describe("tier display UI guard", () => {
  it("keeps customer/provider UI on the centralized tier display helper", () => {
    for (const file of guardedFiles) {
      const source = read(file);
      expect(source, `${file} should not define local hardcoded tier maps`).not.toMatch(
        /const\s+(TIER_LABELS|TIER_DISPLAY_LABELS|TIER_SOURCE_LABELS)\s*:/,
      );
    }
  });

  it("guards previously found raw tier rendering snippets", () => {
    expect(read("app/admin/dashboard/MyLunchCard.tsx")).not.toContain("Tier: {tierToday");
    expect(read("components/admin/AgreementBlock.tsx")).not.toContain("d.tier : \"Ikke i avtalen\"");
    expect(read("components/admin/AgreementBlock.tsx")).not.toContain("d.tier : \"—\"");
    expect(read("app/menus/week/page.tsx")).not.toContain("{menu.tier}</span>");
  });
});
