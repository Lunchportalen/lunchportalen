/**
 * USA address → jurisdiction resolver (Phase 15G.2).
 * Never invents local rates. Returns exact state or explicit BLOCKED.
 */

import {
  assertUsJurisdictionLaunchable,
  resolveUsJurisdiction,
  type UsStateJurisdiction,
  type UsJurisdictionSupportStatus,
} from "@/lib/tax/jurisdictions/usStates";

export type UsAddressInput = {
  countryCode: string;
  stateCode: string | null | undefined;
  countyFips?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

export type UsJurisdictionResolution =
  | {
      ok: true;
      jurisdictionPath: string;
      state: UsStateJurisdiction;
      coverageStatus: UsJurisdictionSupportStatus;
      localRequested: boolean;
      /** Local overlays never guessed — always null until evidenced rate rows exist. */
      localRateBps: null;
    }
  | {
      ok: false;
      code:
        | "COUNTRY_NOT_US"
        | "STATE_REQUIRED"
        | "STATE_UNKNOWN"
        | "JURISDICTION_BLOCKED"
        | "LOCAL_RATE_UNSUPPORTED";
      message: string;
      jurisdictionPath: string | null;
    };

export function resolveUsAddressJurisdiction(input: UsAddressInput): UsJurisdictionResolution {
  const country = String(input.countryCode ?? "").trim().toUpperCase();
  if (country !== "US") {
    return { ok: false, code: "COUNTRY_NOT_US", message: "US address resolver requires country US", jurisdictionPath: null };
  }
  const stateCode = String(input.stateCode ?? "").trim().toUpperCase();
  if (!stateCode) {
    return { ok: false, code: "STATE_REQUIRED", message: "US state/DC code required", jurisdictionPath: null };
  }
  const state = resolveUsJurisdiction(stateCode);
  if (!state) {
    return {
      ok: false,
      code: "STATE_UNKNOWN",
      message: `Unknown US jurisdiction ${stateCode}`,
      jurisdictionPath: `US/${stateCode}`,
    };
  }

  const localRequested = Boolean(input.countyFips || input.city || input.postalCode);
  const pathParts = [`US`, state.stateCode];
  if (input.countyFips) pathParts.push(`COUNTY:${String(input.countyFips).toUpperCase()}`);
  if (input.city) pathParts.push(`CITY:${String(input.city).trim().toUpperCase().replace(/\s+/g, "_")}`);
  const jurisdictionPath = pathParts.join("/");

  if (state.coverageStatus === "BLOCKED_MISSING_EVIDENCE") {
    return {
      ok: false,
      code: "JURISDICTION_BLOCKED",
      message: `US/${state.stateCode} blocked: missing DOR-approved prepared-food/sales-tax evidence`,
      jurisdictionPath,
    };
  }

  // Local overlays: structure supported, rates never guessed.
  if (localRequested && state.coverageStatus === "SUPPORTED") {
    return {
      ok: false,
      code: "LOCAL_RATE_UNSUPPORTED",
      message: `Local (county/city) rate for ${jurisdictionPath} not evidenced — refuse guess`,
      jurisdictionPath,
    };
  }

  return {
    ok: true,
    jurisdictionPath: `US/${state.stateCode}`,
    state,
    coverageStatus: state.coverageStatus,
    localRequested,
    localRateBps: null,
  };
}

/** Provider/company onboarding gate — fail closed. */
export function assertUsOnboardingJurisdiction(stateCode: string): void {
  assertUsJurisdictionLaunchable(stateCode);
}

export type UsBoundaryCase = {
  name: string;
  input: UsAddressInput;
  expectOk: boolean;
  expectCode?: string;
};

/** Representative boundary fixtures for tests (not rate tables). */
export const US_BOUNDARY_CASES: readonly UsBoundaryCase[] = [
  {
    name: "state-only TX blocked",
    input: { countryCode: "US", stateCode: "TX" },
    expectOk: false,
    expectCode: "JURISDICTION_BLOCKED",
  },
  {
    name: "state+county still blocked without evidence",
    input: { countryCode: "US", stateCode: "NY", countyFips: "36061" },
    expectOk: false,
    expectCode: "JURISDICTION_BLOCKED",
  },
  {
    name: "state+city NYC",
    input: { countryCode: "US", stateCode: "NY", city: "New York" },
    expectOk: false,
    expectCode: "JURISDICTION_BLOCKED",
  },
  {
    name: "missing state",
    input: { countryCode: "US", stateCode: null },
    expectOk: false,
    expectCode: "STATE_REQUIRED",
  },
  {
    name: "unknown state",
    input: { countryCode: "US", stateCode: "XX" },
    expectOk: false,
    expectCode: "STATE_UNKNOWN",
  },
  {
    name: "postal boundary CA",
    input: { countryCode: "US", stateCode: "CA", postalCode: "90001" },
    expectOk: false,
    expectCode: "JURISDICTION_BLOCKED",
  },
];
