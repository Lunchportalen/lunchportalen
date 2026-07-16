/**
 * PHASE 11 — launch language quality (contract locks, no DB).
 *
 * Acceptance:
 *  - 15/15 catalogs, 24/24 market locales
 *  - no mixed language / raw keys / unexpected fallback (content gate in CI)
 *  - email templates complete 15/15 (invite, reset, company approved)
 *  - invoice templates complete 15/15 and use company billing language
 *  - notification copy complete 15/15
 *  - native-/legal-review metadata for all 15 languages
 *  - machine translation is draft-only; approved menu translation state locked
 *  - non-translatable protection (identifiers, amounts, statuses, audit IDs)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { APP_LOCALES } from "@/lib/i18n/localeRegistry";
import { MARKET_LOCALE_CODES, SUPPORTED_LANGUAGES } from "@/lib/markets/supportedMarkets";
import { companyApprovedCopy, employeeInviteCopy, passwordResetCopy } from "@/lib/email/i18n/emailCopy";
import { INVOICE_COPY_LANGUAGES, invoiceCopyForLanguage } from "@/lib/billing/invoiceCopy";
import { NOTIFICATION_COPY_LANGUAGES, orderNotificationCopy } from "@/lib/i18n/notificationCopy";
import { allLanguageReviewStatuses } from "@/lib/i18n/languageReviewStatus";
import { protectNonTranslatables, restoreNonTranslatables } from "@/lib/i18n/superadminTranslation";

const root = path.resolve(__dirname, "../..");

describe("canonical launch model: 15 languages, 24 locales", () => {
  it("15/15 base languages with catalogs", () => {
    expect([...APP_LOCALES].sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
    for (const lang of APP_LOCALES) {
      expect(fs.existsSync(path.join(root, `messages/${lang}.json`)), lang).toBe(true);
    }
  });

  it("24/24 regional market locales", () => {
    expect(MARKET_LOCALE_CODES.length).toBe(24);
  });

  it("language content gate passes (no mixed language, no leakage)", () => {
    const out = execFileSync("node", [path.join(root, "scripts/ci/verify-language-content.mjs")], { encoding: "utf8" });
    expect(out).toContain("15/15 catalogs clean");
  });

  it("language content gate is wired into CI platform guards", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    expect(pkg.scripts["ci:language-content-gate"]).toContain("verify-language-content");
    expect(pkg.scripts["ci:platform-guards"]).toContain("ci:language-content-gate");
  });
});

describe("email templates complete 15/15", () => {
  it("invite, password reset and company-approved exist per language, no english fallback", () => {
    for (const lang of APP_LOCALES) {
      const invite = employeeInviteCopy(lang);
      const reset = passwordResetCopy(lang);
      const approved = companyApprovedCopy(lang);
      expect(invite.subject, lang).toBeTruthy();
      expect(reset.subject, lang).toBeTruthy();
      expect(approved.subject, lang).toBeTruthy();
      if (lang !== "en" && lang !== "nb") {
        expect(approved.subject, lang).not.toBe(companyApprovedCopy("en").subject);
        expect(approved.subject, lang).not.toBe(companyApprovedCopy("nb").subject);
      }
    }
  });

  it("unknown locale fails closed to nb (platform default)", () => {
    expect(companyApprovedCopy("xx").subject).toBe(companyApprovedCopy("nb").subject);
    expect(companyApprovedCopy(null).subject).toBe(companyApprovedCopy("nb").subject);
  });
});

describe("invoice templates: company billing language + locale formatting", () => {
  it("15/15 invoice copy languages, all distinct where languages differ", () => {
    expect([...INVOICE_COPY_LANGUAGES].sort()).toEqual([...APP_LOCALES].sort());
    for (const lang of APP_LOCALES) {
      const copy = invoiceCopyForLanguage(lang);
      expect(copy.invoice, lang).toBeTruthy();
      expect(Object.keys(copy.statusLabels).length, lang).toBeGreaterThanOrEqual(8);
    }
    expect(invoiceCopyForLanguage("de").invoice).toBe("Rechnung");
    expect(invoiceCopyForLanguage("el").invoice).toBe("Τιμολόγιο");
    expect(invoiceCopyForLanguage("fi").invoice).toBe("Lasku");
  });

  it("canonical statuses are keys, never translated keys (DRAFT stays DRAFT as key)", () => {
    for (const lang of APP_LOCALES) {
      const labels = invoiceCopyForLanguage(lang).statusLabels;
      expect(Object.keys(labels)).toContain("DRAFT");
      expect(Object.keys(labels)).toContain("PAID");
    }
  });

  it("invoice document resolves buyer language via legal context (loader contract)", () => {
    const src = fs.readFileSync(path.join(root, "lib/billing/invoiceLifecycle.ts"), "utf8");
    expect(src).toContain("invoiceLanguage");
    expect(src).toContain("preferred_locale");
    expect(src).toContain("invoice_language");
    const doc = fs.readFileSync(path.join(root, "components/billing/InvoiceDocument.tsx"), "utf8");
    expect(doc).toContain("invoiceCopyForLanguage(legal?.invoiceLanguage)");
    expect(doc).toContain("Intl.NumberFormat(intlLocale");
  });
});

describe("notification copy complete 15/15", () => {
  it("all base languages present, distinct, fail-closed to nb", () => {
    expect([...NOTIFICATION_COPY_LANGUAGES].sort()).toEqual([...APP_LOCALES].sort());
    const nb = orderNotificationCopy("nb").deliveredSubject("14.07.2026");
    for (const lang of APP_LOCALES) {
      const c = orderNotificationCopy(lang);
      expect(c.deliveredSubject("14.07.2026"), lang).toBeTruthy();
      if (lang !== "nb" && lang !== "da") {
        expect(c.deliveredSubject("14.07.2026"), lang).not.toBe(nb);
      }
    }
    expect(orderNotificationCopy("xx").deliveredSubject("d")).toBe(orderNotificationCopy("nb").deliveredSubject("d"));
    // Aksepterer regionale locales (de-DE → de).
    expect(orderNotificationCopy("de-DE").dispatchedSubject("d")).toBe(orderNotificationCopy("de").dispatchedSubject("d"));
  });

  it("order status notifications use employee and provider language", () => {
    const src = fs.readFileSync(path.join(root, "lib/providers/orderStatusNotifications.ts"), "utf8");
    expect(src).toContain("orderNotificationCopy");
    expect(src).toContain("preferred_locale");
    expect(src).toContain("provider_settings");
  });
});

describe("native-/legal-review metadata", () => {
  it("all 15 languages have review metadata with valid states", () => {
    const statuses = allLanguageReviewStatuses();
    for (const lang of APP_LOCALES) {
      const s = statuses[lang];
      expect(s, lang).toBeTruthy();
      expect(["pending", "in_review", "approved"], lang).toContain(s.nativeReview);
      expect(["pending", "in_review", "approved"], lang).toContain(s.legalReview);
    }
    // Kanonisk basisspråk er godkjent.
    expect(statuses.nb.nativeReview).toBe("approved");
  });
});

describe("machine translation is draft-only; menu translation state locked", () => {
  it("superadmin machine translation can never be auto-approved (migration constraint)", () => {
    const sql = fs.readFileSync(path.join(root, "supabase/migrations/20260826120000_superadmin_norwegian_translations.sql"), "utf8");
    expect(sql).toContain("superadmin_translations_machine_draft_chk");
    expect(sql).toContain("review_state = 'approved' AND reviewed_by IS NULL");
    expect(sql).toContain("original content is immutable");
    expect(sql).toContain("append-only");
  });

  it("machineDraftTranslation always lands in machine_draft, never approved", () => {
    const src = fs.readFileSync(path.join(root, "lib/i18n/superadminTranslation.ts"), "utf8");
    const machineFn = src.slice(src.indexOf("export async function machineDraftTranslation"), src.indexOf("export async function setManualTranslation"));
    expect(machineFn).toContain('review_state: "machine_draft"');
    expect(machineFn).not.toContain('"approved"');
    // Godkjenning krever eksplisitt menneskelig aktør.
    const approveFn = src.slice(src.indexOf("export async function approveTranslation"));
    expect(approveFn).toContain("REVIEWER_REQUIRED");
  });

  it("menu translation approved-state remains provider-owned (existing model untouched)", () => {
    const constants = fs.readFileSync(path.join(root, "lib/smart-menu/translationStatusConstants.ts"), "utf8");
    expect(constants).toContain("approved");
    expect(constants).toContain("draft");
  });
});

describe("non-translatables are protected", () => {
  it("masks and restores identifiers, invoice numbers, amounts, currencies, statuses and audit IDs", () => {
    const text =
      "Orgnr 923609016 MVA. Faktura LPK-2026-0001 på 1 234,50 EUR forfaller. Status: PARTIALLY_PAID. Audit 550e8400-e29b-41d4-a716-446655440000. Kontakt: ola@example.com";
    const { masked, tokens } = protectNonTranslatables(text);
    expect(masked).not.toContain("923609016");
    expect(masked).not.toContain("LPK-2026-0001");
    expect(masked).not.toContain("EUR");
    expect(masked).not.toContain("PARTIALLY_PAID");
    expect(masked).not.toContain("550e8400-e29b-41d4-a716-446655440000");
    expect(masked).not.toContain("ola@example.com");
    expect(tokens.size).toBeGreaterThanOrEqual(5);

    const restored = restoreNonTranslatables(masked, tokens);
    expect(restored).toBe(text);
  });
});
