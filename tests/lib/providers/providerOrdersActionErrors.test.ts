import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  PROVIDER_ORDERS_ACTION_ERROR_KEYS,
  isProviderOrdersActionErrorKey,
  kitchenOrderActionFailure,
  resolveProviderOrdersActionError,
} from "@/lib/providers/providerOrdersActionErrors";

const ACTIONS_PATH = join(process.cwd(), "app/leverandor/ordrer/actions.ts");

describe("providerOrdersActionErrors", () => {
  it("kitchenOrderActionFailure returns stable errorKey", () => {
    expect(kitchenOrderActionFailure("kitchenRoleRequired")).toEqual({
      success: false,
      errorKey: "kitchenRoleRequired",
    });
  });

  it("resolveProviderOrdersActionError translates known errorKey", async () => {
    const messages = (await loadMessagesForLocale("en")) as {
      provider: { orders: { errors: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.orders.errors[key] ?? key;
    expect(
      resolveProviderOrdersActionError(t, { success: false, errorKey: "kitchenRoleRequired" }),
    ).toBe("Only kitchen roles can update status.");
  });

  it("resolveProviderOrdersActionError falls back to updateFailed when errorKey missing", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { orders: { errors: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.orders.errors[key] ?? key;
    expect(resolveProviderOrdersActionError(t, { success: false })).toBe("Kunne ikke oppdatere status.");
    expect(resolveProviderOrdersActionError(t, { success: false, errorKey: "PERMISSION_DENIED" })).toBe(
      "Kunne ikke oppdatere status.",
    );
  });

  it("nb/en messages define all action error keys", async () => {
    for (const locale of ["nb", "en"] as const) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { orders: { errors: Record<string, string> } };
      };
      for (const key of PROVIDER_ORDERS_ACTION_ERROR_KEYS) {
        expect(messages.provider.orders.errors[key]).toBeTruthy();
      }
    }
  });

  it("isProviderOrdersActionErrorKey rejects unknown values", () => {
    expect(isProviderOrdersActionErrorKey("kitchenRoleRequired")).toBe(true);
    expect(isProviderOrdersActionErrorKey("PERMISSION_DENIED")).toBe(false);
  });
});

describe("advanceKitchenOrder action contract", () => {
  it("returns errorKey instead of hardcoded Norwegian strings", () => {
    const src = readFileSync(ACTIONS_PATH, "utf8");
    expect(src).toContain("errorKey");
    expect(src).toContain("kitchenOrderActionFailure");
    expect(src).not.toContain('"Ikke innlogget."');
    expect(src).not.toContain('"Ordre ikke funnet."');
    expect(src).not.toContain("Kun kjøkken-rolle kan oppdatere status.");
    expect(src).not.toContain("Kunne ikke oppdatere status.");
    expect(src).toContain("advanceOrderStatus");
    expect(src).not.toContain("lp_order_set");
  });

  it("does not leak RPC error messages to the client", () => {
    const src = readFileSync(ACTIONS_PATH, "utf8");
    expect(src).not.toContain("OrderStatusError");
    expect(src).not.toContain("e.message");
  });
});
