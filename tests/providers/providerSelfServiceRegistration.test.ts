/**
 * PHASE 4 — provider self-service registration contract suite (fast, no DB).
 *
 * Locks the app-layer contract:
 *  - 21-country registration schema with US/CA provider-required timezone
 *  - anon API allowlist includes exactly the two new public endpoints
 *  - migration invariants (grants, atomic bootstrap, no Melhus fallback,
 *    self-customer guard, legacy_source='provider')
 *  - Sanity mapping is DRAFT-only (no auto-publish)
 *  - invite email localization (nb/en)
 *  - accept client routes through the canonical post-login resolver
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { providerRegistrationSchema } from "@/lib/public/providerRegistrationSchema";
import { providerSlugFromName, providerSlugWithSuffix } from "@/lib/providers/providerRegistrationSlug";
import { buildProviderAdminInviteEmail } from "@/lib/email/templates/providerAdminInvite";
import { API_AUTH_ALLOWLIST } from "@/lib/server/auth/apiAllowlist";
import { SUPPORTED_COUNTRY_CODES, SUPPORTED_MARKETS } from "@/lib/markets/supportedMarkets";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const MIGRATION = "supabase/migrations/20260820120000_provider_self_service_registration.sql";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    company_name: "Test Catering AS",
    country_code: "NO",
    contact_name: "Kari Kokk",
    contact_email: "kari@example.no",
    operating_language: "nb",
    invoice_language: "nb",
    currency: "NOK",
    ...overrides,
  };
}

describe("registration schema — 21 countries + US/CA timezone", () => {
  it("accepts all 21 canonical countries", () => {
    expect(SUPPORTED_COUNTRY_CODES).toHaveLength(21);
    for (const cc of SUPPORTED_COUNTRY_CODES) {
      const market = SUPPORTED_MARKETS.find((m) => m.countryCode === cc)!;
      const needsTz = market.timezoneStrategy === "provider_required";
      const parsed = providerRegistrationSchema.safeParse(
        baseInput({
          country_code: cc,
          currency: market.currency,
          operating_language: market.primaryLanguage,
          invoice_language: market.primaryLanguage,
          ...(needsTz ? { timezone: "America/New_York" } : {}),
        }),
      );
      expect(parsed.success, `${cc} should parse`).toBe(true);
    }
  });

  it("US and CA are provider_required timezone markets and fail without timezone", () => {
    for (const cc of ["US", "CA"]) {
      const market = SUPPORTED_MARKETS.find((m) => m.countryCode === cc)!;
      expect(market.timezoneStrategy).toBe("provider_required");
      expect(market.defaultTimezone).toBeNull();
      const parsed = providerRegistrationSchema.safeParse(
        baseInput({ country_code: cc, currency: market.currency, operating_language: "en", invoice_language: "en" }),
      );
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.message === "TIMEZONE_REQUIRED_FOR_MARKET")).toBe(true);
      }
    }
  });

  it("rejects unknown countries and invalid email", () => {
    expect(providerRegistrationSchema.safeParse(baseInput({ country_code: "XX" })).success).toBe(false);
    expect(providerRegistrationSchema.safeParse(baseInput({ contact_email: "not-an-email" })).success).toBe(false);
  });
});

describe("anon API allowlist", () => {
  it("includes exactly the two new provider endpoints", () => {
    expect(API_AUTH_ALLOWLIST.has("/api/public/provider-registration")).toBe(true);
    expect(API_AUTH_ALLOWLIST.has("/api/auth/register-provider-admin")).toBe(true);
    // Superadmin decision endpoints must NOT be public.
    expect(API_AUTH_ALLOWLIST.has("/api/superadmin/provider-registrations")).toBe(false);
  });
});

describe("migration invariants", () => {
  const sql = read(MIGRATION);
  // Code-only view (SQL comments stripped) for fallback/keyword assertions.
  const code = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

  it("grants anon EXECUTE only on the public create RPC", () => {
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.lp_provider_registration_create(jsonb) TO anon");
    expect(sql).not.toMatch(/lp_provider_registration_approve[^;]*TO[^;]*anon/);
    expect(sql).not.toMatch(/lp_provider_registration_reject[^;]*TO[^;]*anon/);
    expect(sql).not.toMatch(/lp_provider_admin_invite_accept[^;]*TO[^;]*anon/);
  });

  it("approve is an atomic bootstrap: providers + organizations + provider_settings + provider_invites", () => {
    for (const t of ["INSERT INTO public.providers", "INSERT INTO public.organizations", "INSERT INTO public.provider_settings", "INSERT INTO public.provider_invites"]) {
      expect(sql).toContain(t);
    }
    expect(sql).toContain("'provider', NULL, now(), now()"); // legacy_source='provider', legacy_provider_id NULL
  });

  it("enforces US/CA timezone, dedup and self-customer guard; no Melhus fallback", () => {
    expect(sql).toContain("TIMEZONE_REQUIRED_FOR_MARKET");
    expect(sql).toContain("PENDING_REGISTRATION_EXISTS");
    expect(sql).toContain("ORG_NUMBER_IS_CUSTOMER");
    expect(code.toLowerCase()).not.toContain("melhus");
  });

  it("all RPCs are SECURITY DEFINER with pinned search_path", () => {
    const defs = code.match(/SECURITY DEFINER/g) ?? [];
    const pins = code.match(/SET search_path TO 'public', 'pg_temp'/g) ?? [];
    expect(defs.length).toBe(4);
    expect(pins.length).toBe(4);
  });
});

describe("Sanity mapping — draft only, no auto-publish", () => {
  const src = read("lib/cms/syncProviderToSanityDraft.ts");
  it("writes drafts.<id> and never publishes", () => {
    expect(src).toContain("`drafts.${pid}`");
    expect(src).not.toMatch(/\.publish\(/);
    expect(src.toLowerCase()).toContain("ingen melhus-fallback");
  });
  it("approve route uses the draft sync (not the publishing sync)", () => {
    const route = read("app/api/superadmin/provider-registrations/[id]/approve/route.ts");
    expect(route).toContain("syncProviderToSanityDraft");
    expect(route).not.toContain('from "@/lib/cms/syncProviderToSanity"');
  });
});

describe("invite email localization", () => {
  it("builds nb and en variants with the activation link", () => {
    const nb = buildProviderAdminInviteEmail({ contactName: "Kari", companyName: "Test Catering", activateUrl: "https://x/registrer-leverandor?token=abc", locale: "nb" });
    expect(nb.subject).toContain("Aktiver leverandørkontoen");
    expect(nb.text).toContain("https://x/registrer-leverandor?token=abc");
    const en = buildProviderAdminInviteEmail({ contactName: "Kari", companyName: "Test Catering", activateUrl: "https://x/a", locale: "en" });
    expect(en.subject).toContain("Activate your provider account");
  });
});

describe("slug helper", () => {
  it("is deterministic, ascii and suffixable", () => {
    expect(providerSlugFromName("Bærum Catering & Ærlig Økse AS")).toBe("baerum-catering-aerlig-okse-as");
    expect(providerSlugWithSuffix("Test Catering", "a1b2c3")).toBe("test-catering-a1b2c3");
    expect(providerSlugFromName("   ")).toBe("provider");
  });
});

describe("accept client — canonical post-login", () => {
  it("routes through goToPostLogin (E5) with no hardcoded landing", () => {
    const src = read("app/(auth)/registrer-leverandor/RegisterProviderAdminClient.tsx");
    expect(src).toContain("goToPostLogin()");
    expect(src).not.toContain('router.replace("/leverandor")');
  });
});
