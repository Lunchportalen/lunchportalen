/**
 * Phase 2 — provider operational locale → menu_profile_id persistence (save action).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockGetAuthContext = vi.fn();
const mockHasProviderRole = vi.fn();
const mockSupabaseAdmin = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock("@/lib/auth/provider", () => ({
  hasProviderRole: (...args: unknown[]) => mockHasProviderRole(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => mockSupabaseAdmin(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { saveProviderOperationalSettings } from "@/lib/providers/saveProviderOperationalSettings";

const PROVIDER_A = "11111111-1111-1111-1111-111111111111";
const PROVIDER_B = "22222222-2222-2222-2222-222222222222";
const USER_ID = "33333333-3333-3333-3333-333333333333";

function authOk(providerId: string) {
  mockGetAuthContext.mockResolvedValue({ ok: true, user: { id: USER_ID } });
  mockHasProviderRole.mockImplementation(
    async (_userId: string, pid: string, role: string) => pid === providerId && role === "provider_admin",
  );
}

describe("saveProviderOperationalSettings — menu profile persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
    });
  });

  test("persists locale, menu_profile_id, default_country_code and default_currency for de-DE", async () => {
    authOk(PROVIDER_A);

    const res = await saveProviderOperationalSettings({
      providerId: PROVIDER_A,
      operationsEmail: "ordre@provider-a.de",
      kitchenEmail: null,
      deliveryEmail: null,
      locale: "de-DE",
    });

    expect(res).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledOnce();
    const [payload] = mockUpsert.mock.calls[0];
    expect(payload).toMatchObject({
      provider_id: PROVIDER_A,
      locale: "de-DE",
      menu_profile_id: "german_business_lunch",
      default_country_code: "DE",
      default_currency: "EUR",
    });
    expect(payload).not.toHaveProperty("catalog");
    expect(payload).not.toHaveProperty("orders");
  });

  test("persists en-GB with UK profile and GB country code", async () => {
    authOk(PROVIDER_A);

    await saveProviderOperationalSettings({
      providerId: PROVIDER_A,
      operationsEmail: null,
      kitchenEmail: null,
      deliveryEmail: null,
      locale: "en-GB",
    });

    const [payload] = mockUpsert.mock.calls[0];
    expect(payload.menu_profile_id).toBe("uk_office_lunch");
    expect(payload.default_country_code).toBe("GB");
    expect(payload.default_currency).toBe("GBP");
  });

  test("nb-NO remains norwegian_company_lunch — unchanged default market", async () => {
    authOk(PROVIDER_A);

    await saveProviderOperationalSettings({
      providerId: PROVIDER_A,
      operationsEmail: null,
      kitchenEmail: null,
      deliveryEmail: null,
      locale: "nb-NO",
    });

    const [payload] = mockUpsert.mock.calls[0];
    expect(payload.menu_profile_id).toBe("norwegian_company_lunch");
    expect(payload.default_country_code).toBe("NO");
    expect(payload.default_currency).toBe("NOK");
  });

  test("blocks cross-provider write when user is admin for provider A only", async () => {
    authOk(PROVIDER_A);

    const res = await saveProviderOperationalSettings({
      providerId: PROVIDER_B,
      operationsEmail: "ordre@provider-b.no",
      kitchenEmail: null,
      deliveryEmail: null,
      locale: "sv-SE",
    });

    expect(res.ok).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("rejects unsupported locale before upsert", async () => {
    authOk(PROVIDER_A);

    const res = await saveProviderOperationalSettings({
      providerId: PROVIDER_A,
      operationsEmail: null,
      kitchenEmail: null,
      deliveryEmail: null,
      locale: "xx-XX",
    });

    expect(res).toEqual({ ok: false, errorKey: "invalidLocale", field: "locale" });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("does not touch catalog reset or order rewrite fields", async () => {
    authOk(PROVIDER_A);

    await saveProviderOperationalSettings({
      providerId: PROVIDER_A,
      operationsEmail: "ordre@provider-a.it",
      kitchenEmail: null,
      deliveryEmail: null,
      locale: "it-IT",
    });

    const [payload] = mockUpsert.mock.calls[0];
    const keys = Object.keys(payload);
    expect(keys).not.toContain("catalog");
    expect(keys).not.toContain("published_orders");
    expect(keys).not.toContain("reset_catalog");
    expect(payload.menu_profile_id).toBe("italian_office_lunch");
  });
});
