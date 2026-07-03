/**
 * SMART-3 — employee translation display governance contracts.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { EMPLOYEE_COMMERCIAL_FIELD_NAMES } from "../fixtures/g5d0-runtime-contract.constants";

const ROOT = process.cwd();

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("SMART-3 — employee approved translation contracts", () => {
  test("employee overlay helper is server-only read model", () => {
    const src = readSource("lib/smart-menu/employeeApprovedTranslations.ts");
    expect(src).toContain('"server-only"');
    expect(src).toContain("isEmployeeVisibleTranslation");
    expect(src).not.toMatch(/lp_order_set/);
    expect(src).not.toMatch(/menuDayPayload/);
  });

  test("order/window wires overlay via employeeApprovedTranslations only", () => {
    const src = readSource("app/api/order/window/route.ts");
    expect(src).toContain("overlayApprovedTranslationsOnOrderWindowDays");
    expect(src).toContain("resolveEmployeeDisplayLocaleFromRequest");
    expect(src).not.toMatch(/\bmenu_content_translations\b/);
    expect(src).toMatch(/choice_key/);
    expect(src).toMatch(/item_key|itemKey/);
  });

  test("order write path unchanged — no translation identity", () => {
    for (const rel of [
      "lib/orders/resolveOrderDayItemPersist.ts",
      "lib/orders/orderWriteGuard.ts",
      "lib/validation/schemas.ts",
    ]) {
      const src = readSource(rel);
      expect(src).not.toMatch(/employeeApprovedTranslations/);
      expect(src).not.toMatch(/menu_content_translations/);
    }
  });

  test("employee week client uses honest SMART-3 copy", () => {
    const src = readSource("app/(app)/week/EmployeeWeekClient.tsx");
    expect(src).toMatch(/godkjente menytekster/i);
    expect(src).toMatch(/Originaltekst vises ellers/i);
    expect(src).toMatch(/endrer ikke meny, pakke, pris eller bestilling/i);
    expect(src).not.toMatch(/Språkvalg for ansatte kommer senere/i);
  });

  test("LocaleSwitcher re-enabled for employee shell", () => {
    expect(readSource("components/nav/HeaderShell.tsx")).toContain("showLocaleSwitcher = true");
    expect(readSource("components/layout/EmployeeLayout.tsx")).toContain("showLocaleSwitcher={true}");
  });

  test("employee overlay does not expose translation metadata fields", () => {
    const src = readSource("lib/smart-menu/employeeApprovedTranslations.ts");
    expect(src).toMatch(/displayText/);
    expect(src).not.toMatch(/approved_by/);
    expect(src).not.toMatch(/approved_at/);
    const windowTypes = readSource("app/api/order/window/route.ts").slice(
      readSource("app/api/order/window/route.ts").indexOf("type DayCategoryItem"),
      readSource("app/api/order/window/route.ts").indexOf("type AgreementStatusOut"),
    );
    for (const field of [
      "approved_by",
      "approved_at",
      "original_text_hash",
      "translationStatus",
      "employeeVisible",
      ...EMPLOYEE_COMMERCIAL_FIELD_NAMES,
    ]) {
      expect(windowTypes, `DayCategory types must not expose ${field}`).not.toMatch(
        new RegExp(`\\b${field}\\b\\s*:`),
      );
    }
  });

  test("draft/suggested/rejected/stale never employee-visible in overlay helper", () => {
    const src = readSource("lib/smart-menu/employeeApprovedTranslations.ts");
    expect(src).toContain("isEmployeeVisibleTranslation");
    expect(src).toMatch(/status.*approved|"approved"/);
  });

  test("PR #389 remains superseded — not merged as employee meal translation", () => {
    const doc = readSource("docs/architecture/smart-menu-language-profile-currency.md");
    expect(doc).toMatch(/PR #389/);
    expect(doc).toMatch(/do not merge|Do not merge/i);
  });

  test("no LP_MENU_PROFILE_* activation or G5d.8/cutover claims in SMART-3 scope files", () => {
    for (const rel of [
      "lib/smart-menu/employeeApprovedTranslations.ts",
      "app/api/order/window/route.ts",
      "app/(app)/week/EmployeeWeekClient.tsx",
    ]) {
      const src = readSource(rel);
      expect(src).not.toMatch(/LP_MENU_PROFILE_.*=\s*true/);
      expect(src).not.toMatch(/G5d\.8 started/i);
      expect(src).not.toMatch(/runtime cutover approved/i);
    }
  });

  test("provider approval API unchanged for SMART-3", () => {
    const src = readSource("app/api/provider/menu-translations/route.ts");
    expect(src).toContain("employeeTranslationsLive: false");
  });

  test("client components do not import node:crypto translationStatus", () => {
    const panel = readSource("app/leverandor/meny/oversettelser/ProviderMenuTranslationsPanel.tsx");
    expect(panel).toContain("translationStatusConstants");
    expect(panel).not.toMatch(/from "@\/lib\/smart-menu\/translationStatus"/);
  });
});
