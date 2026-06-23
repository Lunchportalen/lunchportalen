import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  PROVIDER_CUSTOMER_ACTION_ERROR_KEYS,
  customerActionFailure,
  isProviderCustomerActionErrorKey,
  resolveProviderCustomerActionError,
} from "@/lib/providers/providerCustomerActionErrors";

const ACTIONS_PATH = join(process.cwd(), "app/leverandor/kunder/actions.ts");
const DIALOG_PATH = join(process.cwd(), "components/providers/CustomerDetailClient.tsx");

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

  it("CustomerDetailClient resolves errorKey via i18n", () => {
    const src = readFileSync(DIALOG_PATH, "utf8");
    expect(src).toContain("resolveProviderCustomerActionError");
    expect(src).toContain('useTranslations("provider.customers.errors")');
    expect(src).not.toContain('"Handlingen feilet."');
  });

  it("lifecycle action payloads unchanged", () => {
    const src = readFileSync(ACTIONS_PATH, "utf8");
    expect(src).toContain("suspendCompany(companyId, reason.trim())");
    expect(src).toContain("pauseCompany(companyId, reason.trim())");
    expect(src).toContain("deleteCompany(companyId, reason.trim())");
    expect(src).toContain("resumeCompany(companyId)");
    expect(src).not.toContain("lp_order_set");
    expect(src).not.toContain("lp_order_advance_status");
  });
});
