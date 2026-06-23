import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  PROVIDER_CUSTOMER_ACTION_ERROR_KEYS,
  customerActionFailure,
  extractProviderCustomerApiErrorCode,
  isProviderCustomerActionErrorKey,
  mapProviderCustomerApiErrorKey,
  resolveProviderCustomerActionError,
  resolveProviderCustomerApiError,
} from "@/lib/providers/providerCustomerActionErrors";

const ACTIONS_PATH = join(process.cwd(), "app/leverandor/kunder/actions.ts");
const DETAIL_CLIENT_PATH = join(process.cwd(), "components/providers/CustomerDetailClient.tsx");
const REMOVAL_PATH = join(process.cwd(), "components/providers/ProviderCustomerRemovalDialog.tsx");
const RESTORE_PATH = join(process.cwd(), "components/providers/ProviderCustomerRestoreDialog.tsx");
const AGREEMENT_EDIT_PATH = join(process.cwd(), "components/providers/ProviderCustomerAgreementEditDialog.tsx");

describe("providerCustomerActionErrors", () => {
  it("customerActionFailure returns stable errorKey", () => {
    expect(customerActionFailure("customerNotFound")).toEqual({
      success: false,
      errorKey: "customerNotFound",
    });
  });

  it("resolveProviderCustomerActionError translates known errorKey", async () => {
    const messages = (await loadMessagesForLocale("en")) as {
      provider: { customers: { errors: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.customers.errors[key] ?? key;
    expect(
      resolveProviderCustomerActionError(t, { success: false, errorKey: "customerNotFound" }),
    ).toBe("Customer not found.");
  });

  it("resolveProviderCustomerActionError falls back to updateFailed when errorKey missing", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { customers: { errors: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.customers.errors[key] ?? key;
    expect(resolveProviderCustomerActionError(t, { success: false })).toBe("Kunne ikke oppdatere kunde.");
    expect(
      resolveProviderCustomerActionError(t, { success: false, errorKey: "PERMISSION_DENIED" }),
    ).toBe("Kunne ikke oppdatere kunde.");
  });

  it("nb/en messages define all action error keys", async () => {
    for (const locale of ["nb", "en"] as const) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { customers: { errors: Record<string, string> } };
      };
      for (const key of PROVIDER_CUSTOMER_ACTION_ERROR_KEYS) {
        expect(messages.provider.customers.errors[key]).toBeTruthy();
      }
    }
  });

  it("isProviderCustomerActionErrorKey rejects unknown values", () => {
    expect(isProviderCustomerActionErrorKey("customerNotFound")).toBe(true);
    expect(isProviderCustomerActionErrorKey("PERMISSION_DENIED")).toBe(false);
  });
});

describe("mapProviderCustomerApiErrorKey", () => {
  it("maps auth and scope API codes without leaking raw message", () => {
    expect(mapProviderCustomerApiErrorKey("UNAUTHORIZED", "restoreAction")).toBe("notAuthenticated");
    expect(mapProviderCustomerApiErrorKey("PROVIDER_ROLE_MISSING", "restoreAction")).toBe("providerAdminRequired");
    expect(mapProviderCustomerApiErrorKey("OUT_OF_SCOPE", "removalAction")).toBe("outOfScope");
    expect(mapProviderCustomerApiErrorKey("NOT_FOUND", "agreementLoad")).toBe("customerNotFound");
  });

  it("maps agreement validation codes to invalidAgreement", () => {
    expect(mapProviderCustomerApiErrorKey("EMPTY_DELIVERY_DAYS", "agreementSave")).toBe("invalidAgreement");
    expect(mapProviderCustomerApiErrorKey("INVALID_PLAN", "agreementSave")).toBe("invalidAgreement");
    expect(mapProviderCustomerApiErrorKey("EMPTY_PATCH", "agreementSave")).toBe("invalidPayload");
  });

  it("uses context default for execution failures", () => {
    expect(mapProviderCustomerApiErrorKey("EXECUTION_FAILED", "restoreAction")).toBe("restoreFailed");
    expect(mapProviderCustomerApiErrorKey("EXECUTION_FAILED", "agreementSave")).toBe("agreementUpdateFailed");
    expect(mapProviderCustomerApiErrorKey("", "removalLoad")).toBe("loadRulesFailed");
  });

  it("extractProviderCustomerApiErrorCode prefers detail.code", () => {
    expect(
      extractProviderCustomerApiErrorCode({
        ok: false,
        error: "VALIDATION",
        detail: { code: "CONFIRM_MISMATCH" },
      }),
    ).toBe("CONFIRM_MISMATCH");
  });
});

describe("resolveProviderCustomerApiError", () => {
  it("translates API error via errorKey and appends RID", async () => {
    const messages = (await loadMessagesForLocale("en")) as {
      provider: { customers: { errors: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.customers.errors[key] ?? key;
    const text = resolveProviderCustomerApiError(
      t,
      { ok: false, error: "FORBIDDEN", rid: "rid-123" },
      "restoreAction",
    );
    expect(text).toBe("You do not have access to this customer. (RID: rid-123)");
    expect(text).not.toContain("Du har ikke");
  });

  it("falls back to context default when code unknown", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { customers: { errors: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.customers.errors[key] ?? key;
    expect(
      resolveProviderCustomerApiError(t, { ok: false, error: "SOME_NEW_CODE" }, "agreementSave"),
    ).toBe("Kunne ikke lagre avtale.");
  });
});

describe("customer server actions contract", () => {
  it("returns errorKey instead of hardcoded Norwegian strings", () => {
    const src = readFileSync(ACTIONS_PATH, "utf8");
    expect(src).toContain("errorKey");
    expect(src).toContain("customerActionFailure");
    expect(src).not.toContain('"Ikke innlogget."');
    expect(src).not.toContain('"Kunde ikke funnet."');
    expect(src).not.toContain("Kunne ikke suspendere kunde.");
    expect(src).not.toContain("e.message");
  });

  it("uses distinct suspendFailed and pauseFailed errorKeys", () => {
    const src = readFileSync(ACTIONS_PATH, "utf8");
    expect(src).toContain('customerActionFailure("suspendFailed")');
    expect(src).toContain('customerActionFailure("pauseFailed")');
    expect(src).toContain("suspendCompany(companyId, reason.trim())");
    expect(src).toContain("pauseCompany(companyId, reason.trim())");
    expect(src).toContain("deleteCompany(companyId, reason.trim())");
    expect(src).toContain("resumeCompany(companyId)");
    expect(src).not.toContain("lp_order_set");
    expect(src).not.toContain("lp_order_advance_status");
  });

  it("CustomerDetailClient resolves errorKey via i18n", () => {
    const src = readFileSync(DETAIL_CLIENT_PATH, "utf8");
    expect(src).toContain("resolveProviderCustomerActionError");
    expect(src).toContain('useTranslations("provider.customers.errors")');
    expect(src).not.toContain('"Handlingen feilet."');
  });

  it("removal/restore/agreement dialogs resolve API errors via i18n", () => {
    const removal = readFileSync(REMOVAL_PATH, "utf8");
    const restore = readFileSync(RESTORE_PATH, "utf8");
    const agreement = readFileSync(AGREEMENT_EDIT_PATH, "utf8");

    expect(removal).toContain("resolveProviderCustomerApiError");
    expect(removal).toContain('useTranslations("provider.customers.errors")');
    expect(removal).not.toContain("parseApiMessage");
    expect(removal).toContain('JSON.stringify({ mode, confirmation: confirm.trim(), reason: reason.trim() || null })');

    expect(restore).toContain("resolveProviderCustomerApiError");
    expect(restore).toContain('JSON.stringify({ confirmation: confirm.trim() })');
    expect(restore).not.toContain("parseApiMessage");

    expect(agreement).toContain("resolveProviderCustomerApiError");
    expect(agreement).toContain('method: "PATCH"');
    expect(agreement).toContain("JSON.stringify(payload)");
    expect(agreement).not.toContain("parseApiMessage");
  });
});
