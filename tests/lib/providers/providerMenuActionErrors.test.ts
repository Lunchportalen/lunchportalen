import { describe, expect, it } from "vitest";

import {
  ENTERPRISE_VALIDATION_NB_MESSAGES,
  MENU_PUBLISH_CONFIRM_SUFFIX_NB,
} from "@/lib/providers/providerMenuPackageSurface";
import {
  PROVIDER_MENU_API_ERROR_CODES,
  resolveEnterpriseWarningMessageKey,
  resolveProviderMenuApiError,
  resolvePublishConfirmPresentation,
} from "@/lib/providers/providerMenuActionErrors";

const t = (key: string, values?: Record<string, string>) => {
  const map: Record<string, string> = {
    "errors.unauthorized": "ERR:unauthorized",
    "errors.forbidden": "ERR:forbidden",
    "errors.validationFailed": "ERR:validationFailed",
    "errors.orderLocked": "ERR:orderLocked",
    "errors.publishConfirmGeneric": "ERR:publishConfirmGeneric",
    "errors.publishConfirmRequired": `ERR:publishConfirmRequired:${values?.warning ?? ""}`,
    "errors.saveFailed": "ERR:saveFailed",
    "errors.loadFailed": "ERR:loadFailed",
    "validation.enterprise.weakValue": "WARN:weakValue",
    "validation.enterprise.upgradeRequired": "WARN:upgradeRequired",
    "validation.enterprise.lowMargin": "WARN:lowMargin",
  };
  return map[key] ?? key;
};

describe("providerMenuActionErrors", () => {
  it("maps known API error codes to stable keys", () => {
    expect(
      resolveProviderMenuApiError(t, { ok: false, error: PROVIDER_MENU_API_ERROR_CODES.UNAUTHORIZED }),
    ).toBe("ERR:unauthorized");
    expect(
      resolveProviderMenuApiError(t, { ok: false, error: PROVIDER_MENU_API_ERROR_CODES.MENU_ORDER_LOCKED }),
    ).toBe("ERR:orderLocked");
  });

  it("maps enterprise validation nb messages without showing raw server text", () => {
    const blocking = resolveProviderMenuApiError(t, {
      ok: false,
      error: PROVIDER_MENU_API_ERROR_CODES.VALIDATION_ERROR,
      message: ENTERPRISE_VALIDATION_NB_MESSAGES.upgradeRequired,
    });
    expect(blocking).toBe("WARN:upgradeRequired");
    expect(blocking).not.toContain("Enterprise som gjenbruker");
  });

  it("maps soft publish confirm suffix to translated warning + confirm chrome", () => {
    const raw = `${ENTERPRISE_VALIDATION_NB_MESSAGES.weakValue}${MENU_PUBLISH_CONFIRM_SUFFIX_NB}`;
    expect(resolveEnterpriseWarningMessageKey(raw)).toBe("weakValue");
    expect(resolvePublishConfirmPresentation(t, raw)).toBe(
      "ERR:publishConfirmRequired:WARN:weakValue",
    );
    expect(resolvePublishConfirmPresentation(t, raw)).not.toContain("Luxus.");
  });

  it("uses safe generic fallback for unknown API messages", () => {
    expect(
      resolveProviderMenuApiError(t, {
        ok: false,
        error: PROVIDER_MENU_API_ERROR_CODES.VALIDATION_ERROR,
        message: "Rettens navn er påkrevd ved publisering.",
      }),
    ).toBe("ERR:validationFailed");
    expect(resolvePublishConfirmPresentation(t, "Ukjent servermelding")).toBe("ERR:publishConfirmGeneric");
  });

  it("falls back to action-specific key for unknown error codes", () => {
    expect(resolveProviderMenuApiError(t, { ok: false, error: "MYSTERY" }, "loadFailed")).toBe(
      "ERR:loadFailed",
    );
  });
});
