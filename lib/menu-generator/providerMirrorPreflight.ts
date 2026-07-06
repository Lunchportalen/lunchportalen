/**
 * Read-only Sanity provider mirror preflight for localized generator apply/dryRun.
 * No writes · no side effects · deterministic validation.
 */

export const PROVIDER_MIRROR_BLOCKER_CODES = [
  "PROVIDER_MIRROR_MISSING",
  "PROVIDER_MIRROR_ID_MISMATCH",
  "PROVIDER_MIRROR_SLUG_MISMATCH",
  "PROVIDER_REF_UNRESOLVED",
] as const;

export type ProviderMirrorBlockerCode = (typeof PROVIDER_MIRROR_BLOCKER_CODES)[number];

export type ProviderMirrorSnapshot = {
  sanityId: string;
  name: string;
  slug: string;
};

export type ProviderMirrorPreflightMode = "dry_run" | "apply";

export type ProviderMirrorPreflightInput = {
  providerId: string;
  expectedSlug: string | null;
  mirror: ProviderMirrorSnapshot | null;
  mode: ProviderMirrorPreflightMode;
};

export type ProviderMirrorPreflightResult = {
  ok: boolean;
  blockerCode?: ProviderMirrorBlockerCode;
  severity: "blocker" | "warning";
  message: string;
  operatorAction: string;
  safeToApply: boolean;
  applyBlocked: boolean;
  mirrorSnapshot?: ProviderMirrorSnapshot;
  errorCode?: ProviderMirrorApplyErrorCode;
};

export type ProviderMirrorPreflightPayload = ProviderMirrorPreflightResult;

export type ProviderMirrorApplyErrorCode =
  | "provider_mirror_missing"
  | "provider_mirror_id_mismatch"
  | "provider_mirror_slug_mismatch"
  | "provider_ref_unresolved";

export const PROVIDER_MIRROR_OPERATOR_ACTION =
  "Kjør syncProviderToSanity og verifiser provider-speil read-only før apply.";

export const SANITY_PROVIDER_MIRROR_QUERY = `*[_type == "provider" && _id == $id][0]{
  "sanityId": _id,
  name,
  "slug": slug.current
}`;

function normalizeSlug(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeId(value: unknown): string {
  return String(value ?? "").trim();
}

export function mapProviderMirrorBlockerToApplyError(
  blockerCode: ProviderMirrorBlockerCode,
): ProviderMirrorApplyErrorCode {
  switch (blockerCode) {
    case "PROVIDER_MIRROR_MISSING":
      return "provider_mirror_missing";
    case "PROVIDER_MIRROR_ID_MISMATCH":
      return "provider_mirror_id_mismatch";
    case "PROVIDER_MIRROR_SLUG_MISMATCH":
      return "provider_mirror_slug_mismatch";
    case "PROVIDER_REF_UNRESOLVED":
      return "provider_ref_unresolved";
    default:
      return "provider_ref_unresolved";
  }
}

export function validateProviderMirrorForGeneratorApply(
  input: ProviderMirrorPreflightInput,
): ProviderMirrorPreflightResult {
  const providerId = normalizeId(input.providerId);
  const expectedSlug = normalizeSlug(input.expectedSlug);
  const mirror = input.mirror;

  if (!providerId) {
    return {
      ok: false,
      blockerCode: "PROVIDER_REF_UNRESOLVED",
      severity: "blocker",
      message: "Provider-ID mangler — providerRef kan ikke verifiseres.",
      operatorAction: PROVIDER_MIRROR_OPERATOR_ACTION,
      safeToApply: false,
      applyBlocked: true,
      errorCode: mapProviderMirrorBlockerToApplyError("PROVIDER_REF_UNRESOLVED"),
    };
  }

  if (!mirror) {
    return {
      ok: false,
      blockerCode: "PROVIDER_MIRROR_MISSING",
      severity: "blocker",
      message: "Sanity provider-speil mangler for denne leverandøren.",
      operatorAction: PROVIDER_MIRROR_OPERATOR_ACTION,
      safeToApply: false,
      applyBlocked: true,
      errorCode: mapProviderMirrorBlockerToApplyError("PROVIDER_MIRROR_MISSING"),
    };
  }

  const sanityId = normalizeId(mirror.sanityId);
  const mirrorSlug = normalizeSlug(mirror.slug);
  const mirrorName = String(mirror.name ?? "").trim();

  if (sanityId !== providerId) {
    return {
      ok: false,
      blockerCode: "PROVIDER_MIRROR_ID_MISMATCH",
      severity: "blocker",
      message: "Sanity provider-speil matcher ikke Supabase provider-ID.",
      operatorAction: PROVIDER_MIRROR_OPERATOR_ACTION,
      safeToApply: false,
      applyBlocked: true,
      mirrorSnapshot: mirror,
      errorCode: mapProviderMirrorBlockerToApplyError("PROVIDER_MIRROR_ID_MISMATCH"),
    };
  }

  if (!mirrorName || !mirrorSlug) {
    return {
      ok: false,
      blockerCode: "PROVIDER_REF_UNRESOLVED",
      severity: "blocker",
      message: "Sanity provider-speil mangler navn eller slug — providerRef kan ikke resolve.",
      operatorAction: PROVIDER_MIRROR_OPERATOR_ACTION,
      safeToApply: false,
      applyBlocked: true,
      mirrorSnapshot: mirror,
      errorCode: mapProviderMirrorBlockerToApplyError("PROVIDER_REF_UNRESOLVED"),
    };
  }

  if (expectedSlug && mirrorSlug !== expectedSlug) {
    return {
      ok: false,
      blockerCode: "PROVIDER_MIRROR_SLUG_MISMATCH",
      severity: "blocker",
      message: "Sanity provider-speil slug matcher ikke Supabase provider slug.",
      operatorAction: PROVIDER_MIRROR_OPERATOR_ACTION,
      safeToApply: false,
      applyBlocked: true,
      mirrorSnapshot: mirror,
      errorCode: mapProviderMirrorBlockerToApplyError("PROVIDER_MIRROR_SLUG_MISMATCH"),
    };
  }

  return {
    ok: true,
    severity: "warning",
    message:
      input.mode === "dry_run"
        ? "Sanity provider-speil OK — apply kan vurderes etter egen scoped GO."
        : "Sanity provider-speil OK.",
    operatorAction: PROVIDER_MIRROR_OPERATOR_ACTION,
    safeToApply: true,
    applyBlocked: false,
    mirrorSnapshot: mirror,
  };
}

type SanityFetchFn = (query: string, params?: Record<string, unknown>) => Promise<unknown>;

export async function fetchSanityProviderMirrorSnapshot(
  fetchFn: SanityFetchFn,
  providerId: string,
): Promise<ProviderMirrorSnapshot | null> {
  const id = normalizeId(providerId);
  if (!id) return null;

  const row = (await fetchFn(SANITY_PROVIDER_MIRROR_QUERY, { id })) as
    | {
        sanityId?: unknown;
        name?: unknown;
        slug?: unknown;
      }
    | null;

  if (!row?.sanityId) return null;

  return {
    sanityId: normalizeId(row.sanityId),
    name: String(row.name ?? "").trim(),
    slug: String(row.slug ?? "").trim(),
  };
}

export async function runProviderMirrorPreflight(input: {
  providerId: string;
  expectedSlug: string | null;
  mode: ProviderMirrorPreflightMode;
  fetchMirror: (providerId: string) => Promise<ProviderMirrorSnapshot | null>;
}): Promise<ProviderMirrorPreflightResult> {
  const mirror = await input.fetchMirror(input.providerId);
  return validateProviderMirrorForGeneratorApply({
    providerId: input.providerId,
    expectedSlug: input.expectedSlug,
    mirror,
    mode: input.mode,
  });
}
