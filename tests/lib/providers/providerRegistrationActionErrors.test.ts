import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  PROVIDER_REGISTRATION_ACTION_ERROR_KEYS,
  isProviderRegistrationActionErrorKey,
  mapRegistrationRpcErrorKey,
  registrationActionFailure,
  resolveProviderRegistrationActionError,
} from "@/lib/providers/providerRegistrationActionErrors";

const ACTIONS_PATH = join(process.cwd(), "app/leverandor/registreringer/actions.ts");
const DIALOG_PATH = join(process.cwd(), "components/providers/RegistrationApproveDialog.tsx");

describe("providerRegistrationActionErrors", () => {
  it("registrationActionFailure returns stable errorKey", () => {
    expect(registrationActionFailure("invalidTier")).toEqual({
      success: false,
      errorKey: "invalidTier",
    });
  });

  it("resolveProviderRegistrationActionError translates known errorKey", async () => {
    const messages = (await loadMessagesForLocale("en")) as {
      provider: { registrations: { errors: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.registrations.errors[key] ?? key;
    expect(
      resolveProviderRegistrationActionError(t, { success: false, errorKey: "invalidTier" }),
    ).toBe("Invalid agreement tier.");
  });

  it("resolveProviderRegistrationActionError falls back to actionFailed when errorKey missing", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { registrations: { errors: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.registrations.errors[key] ?? key;
    expect(resolveProviderRegistrationActionError(t, { success: false })).toBe("Handlingen feilet.");
    expect(
      resolveProviderRegistrationActionError(t, { success: false, errorKey: "PERMISSION_DENIED" }),
    ).toBe("Handlingen feilet.");
  });

  it("nb/en messages define all action error keys", async () => {
    for (const locale of ["nb", "en"] as const) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { registrations: { errors: Record<string, string> } };
      };
      for (const key of PROVIDER_REGISTRATION_ACTION_ERROR_KEYS) {
        expect(messages.provider.registrations.errors[key]).toBeTruthy();
      }
    }
  });

  it("mapRegistrationRpcErrorKey maps RPC codes without leaking raw text", () => {
    expect(mapRegistrationRpcErrorKey("REGISTRATION_NOT_PENDING")).toBe("registrationAlreadyProcessed");
    expect(mapRegistrationRpcErrorKey("PERMISSION_DENIED")).toBe("providerAdminRequired");
    expect(mapRegistrationRpcErrorKey("AGREEMENT_TIER_INVALID")).toBe("invalidTier");
    expect(mapRegistrationRpcErrorKey("something else")).toBe("actionFailed");
  });

  it("isProviderRegistrationActionErrorKey rejects unknown values", () => {
    expect(isProviderRegistrationActionErrorKey("approveFailed")).toBe(true);
    expect(isProviderRegistrationActionErrorKey("PERMISSION_DENIED")).toBe(false);
  });
});

describe("registration server actions contract", () => {
  it("returns errorKey instead of hardcoded Norwegian strings", () => {
    const src = readFileSync(ACTIONS_PATH, "utf8");
    expect(src).toContain("errorKey");
    expect(src).toContain("registrationActionFailure");
    expect(src).not.toContain('"Ikke innlogget."');
    expect(src).not.toContain("mapRpcError");
    expect(src).not.toContain('success: false, error:');
  });

  it("RegistrationApproveDialog resolves errorKey via i18n", () => {
    const src = readFileSync(DIALOG_PATH, "utf8");
    expect(src).toContain("resolveProviderRegistrationActionError");
    expect(src).toContain('useTranslations("provider.registrations.errors")');
    expect(src).not.toContain('res.error');
  });

  it("approve/reject payloads unchanged", () => {
    const src = readFileSync(DIALOG_PATH, "utf8");
    expect(src).toContain("approveProviderRegistration(providerId, registration.id, tier)");
    expect(src).toContain("rejectProviderRegistration(providerId, registration.id, rejectReason)");
    const actions = readFileSync(ACTIONS_PATH, "utf8");
    expect(actions).toContain("lp_company_registration_approve_provider");
    expect(actions).toContain("lp_company_registration_reject_provider");
    expect(actions).toContain('p_agreement_tier: tier');
    expect(actions).toContain("p_reason: trimmed");
  });
});
