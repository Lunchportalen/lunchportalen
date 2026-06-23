import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  PROVIDER_BILLING_ACTION_ERROR_KEYS,
  billingContactActionFailure,
  mapBillingContactRpcErrorKey,
  resolveProviderBillingActionError,
} from "@/lib/providers/providerBillingActionErrors";

const BILLING_ACTIONS = join(process.cwd(), "app/leverandor/faktura/actions.ts");
const BILLING_CONTACT_FORM = join(process.cwd(), "components/providers/BillingContactForm.tsx");
const LOAD_BILLING = join(process.cwd(), "lib/providers/loadProviderBilling.ts");

describe("providerBillingActionErrors", () => {
  it("billingContactActionFailure returns stable errorKey", () => {
    expect(billingContactActionFailure("invalidEmail")).toEqual({
      success: false,
      errorKey: "invalidEmail",
    });
  });

  it("mapBillingContactRpcErrorKey maps RPC codes without raw message", () => {
    expect(mapBillingContactRpcErrorKey("PERMISSION_DENIED")).toBe("forbidden");
    expect(mapBillingContactRpcErrorKey("INVALID_BILLING_EMAIL:bad@")).toBe("invalidEmail");
    expect(mapBillingContactRpcErrorKey("ACTIVE_SUBSCRIPTION_NOT_FOUND")).toBe("activeSubscriptionNotFound");
    expect(mapBillingContactRpcErrorKey("UNEXPECTED_RPC_FAILURE")).toBe("saveFailed");
  });

  it("resolveProviderBillingActionError translates known key and safe fallback", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { billing: { errors: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.billing.errors[key] ?? key;
    expect(
      resolveProviderBillingActionError(t, { success: false, errorKey: "invalidEmail" }, "saveFailed"),
    ).toBe("Ugyldig faktura-e-post.");
    expect(resolveProviderBillingActionError(t, { success: false }, "saveFailed")).toBe(
      "Kunne ikke lagre fakturakontakt.",
    );
    expect(
      resolveProviderBillingActionError(t, { success: false, errorKey: "RAW_SERVER" }, "unknown"),
    ).toBe("Noe gikk galt. Prøv igjen.");
  });

  it("nb/en define all billing action error keys", async () => {
    for (const locale of ["nb", "en"] as const) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { billing: { errors: Record<string, string> } };
      };
      for (const key of PROVIDER_BILLING_ACTION_ERROR_KEYS) {
        expect(messages.provider.billing.errors[key]).toBeTruthy();
      }
    }
  });
});

describe("PR 6b wiring and payload locks", () => {
  it("billing contact action returns errorKey-only failures", () => {
    const src = readFileSync(BILLING_ACTIONS, "utf8");
    expect(src).toContain("errorKey: ProviderBillingActionErrorKey");
    expect(src).not.toContain('error: "Ikke innlogget."');
    expect(src).not.toContain("mapRpcError");
    expect(src).toContain("billingContactActionFailure");
    expect(src).toContain("mapBillingContactRpcErrorKey");
    expect(src).toContain("p_billing_email: billingEmail.trim()");
    expect(src).toContain("p_billing_org_number: billingOrgNumber.trim() || null");
    expect(src).toContain("p_billing_address: billingAddress.trim() || null");
  });

  it("BillingContactForm resolves errorKey via i18n", () => {
    const src = readFileSync(BILLING_CONTACT_FORM, "utf8");
    expect(src).toContain("resolveProviderBillingActionError");
    expect(src).toContain('useTranslations("provider.billing.errors")');
    expect(src).not.toContain("res.error");
  });

  it("loadProviderBilling and billing runtime remain untouched", () => {
    const src = readFileSync(LOAD_BILLING, "utf8");
    expect(src).toContain("loadProviderBilling");
    expect(src).not.toContain("providerBillingActionErrors");
  });
});
