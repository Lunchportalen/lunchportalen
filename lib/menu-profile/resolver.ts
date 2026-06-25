/**
 * INERT MENU PROFILE RESOLVER — ADR-019 G1
 *
 * Pure resolver behind LP_MENU_PROFILE_RESOLVER (default OFF).
 * No DB, Supabase, Sanity, or runtime route imports until explicit wiring phase.
 */

import { isMenuProfileResolverEnabled } from "@/lib/menu-profile/featureFlag";
import { getDefaultMenuProfileForMarket } from "@/lib/menu-profile/marketDefaults";
import { getMenuProfile, isSupportedMenuProfile } from "@/lib/menu-profile/registry";
import type {
  MarketCode,
  MenuProfileResolverResult,
  ResolveMenuProfileForProviderInput,
} from "@/lib/menu-profile/types";
import { MARKET_CODES } from "@/lib/menu-profile/types";

function parseMarketCode(value: unknown): MarketCode | null {
  const market = String(value ?? "").trim().toUpperCase();
  if (!market) return null;
  return (MARKET_CODES as readonly string[]).includes(market) ? (market as MarketCode) : null;
}

function legacyDisabledResult(): MenuProfileResolverResult {
  return {
    ok: true,
    enabled: false,
    source: "legacy_disabled",
    profile: getMenuProfile("norwegian_company_lunch"),
  };
}

export function resolveMenuProfileForProvider(
  input: ResolveMenuProfileForProviderInput,
): MenuProfileResolverResult {
  if (!isMenuProfileResolverEnabled(input.env ?? {})) {
    return legacyDisabledResult();
  }

  const profileIdRaw = String(input.menuProfileId ?? "").trim();
  if (profileIdRaw) {
    if (!isSupportedMenuProfile(profileIdRaw)) {
      return {
        ok: false,
        enabled: true,
        reason: "unsupported_menu_profile",
        message: `Unknown menu profile: ${profileIdRaw}`,
      };
    }

    return {
      ok: true,
      enabled: true,
      source: "provider_setting",
      profile: getMenuProfile(profileIdRaw),
    };
  }

  const market = parseMarketCode(input.market);
  if (market) {
    return {
      ok: true,
      enabled: true,
      source: "market_default",
      profile: getDefaultMenuProfileForMarket(market),
    };
  }

  return {
    ok: true,
    enabled: true,
    source: "fallback_no_market",
    profile: getDefaultMenuProfileForMarket("NO"),
    warning: "No menu profile or market provided; using NO default.",
  };
}
