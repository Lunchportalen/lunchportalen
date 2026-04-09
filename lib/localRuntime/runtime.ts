import { CANONICAL_LOCAL_PROVIDER_CMS_PASSWORD } from "@/lib/auth/canonicalDevCredentials";
import { SUPERADMIN_EMAIL } from "@/lib/system/emailAddresses";

export const CMS_RUNTIME_MODE_FLAG = "LP_CMS_RUNTIME_MODE";
const LEGACY_LOCAL_CMS_RUNTIME_FLAG = "LP_LOCAL_CMS_RUNTIME";
const LEGACY_LOCAL_CMS_RUNTIME_MODE_FLAG = "LOCAL_CMS_RUNTIME_MODE";
const LEGACY_CONTENT_RESERVE_FLAG = "LOCAL_DEV_CONTENT_RESERVE";

const LOCAL_PROVIDER_VALUES = new Set(["1", "true", "on", "local", "provider", "local_provider"]);
const RESERVE_VALUES = new Set(["reserve", "content_reserve"]);
const REMOTE_VALUES = new Set([
  "0",
  "false",
  "off",
  "remote",
  "remote_backend",
  "remote-only",
]);

export const LOCAL_CMS_RUNTIME_SUPABASE_URL = "http://local-runtime.supabase.invalid";
export const LOCAL_CMS_RUNTIME_SUPABASE_ANON_KEY = "local-runtime-anon-key";

export type CmsRuntimeMode = "local_provider" | "reserve" | "remote_backend";
export type CmsRuntimeModeSource =
  | typeof CMS_RUNTIME_MODE_FLAG
  | typeof LEGACY_LOCAL_CMS_RUNTIME_MODE_FLAG
  | typeof LEGACY_LOCAL_CMS_RUNTIME_FLAG
  | typeof LEGACY_CONTENT_RESERVE_FLAG
  | "default_remote_backend";

export type CmsRuntimeStatus = {
  mode: CmsRuntimeMode;
  source: CmsRuntimeModeSource;
  explicit: boolean;
  usesLocalProvider: boolean;
  usesReserve: boolean;
  requiresRemoteBackend: boolean;
};

export type LocalCmsRuntimeLoginCredentials = {
  email: string;
  password: string;
};

const LOCAL_CMS_RUNTIME_LOGIN_CREDENTIALS: LocalCmsRuntimeLoginCredentials = {
  email: SUPERADMIN_EMAIL,
  password: CANONICAL_LOCAL_PROVIDER_CMS_PASSWORD,
};

function safeTrim(value: unknown): string {
  return String(value ?? "").trim();
}

function runtimeStatus(
  mode: CmsRuntimeMode,
  source: CmsRuntimeModeSource,
  explicit: boolean,
): CmsRuntimeStatus {
  return {
    mode,
    source,
    explicit,
    usesLocalProvider: mode === "local_provider",
    usesReserve: mode === "reserve",
    requiresRemoteBackend: mode === "remote_backend",
  };
}

function parseExplicitMode(value: unknown): CmsRuntimeMode | null {
  const normalized = safeTrim(value).toLowerCase();
  if (!normalized) return null;
  if (LOCAL_PROVIDER_VALUES.has(normalized)) return "local_provider";
  if (RESERVE_VALUES.has(normalized)) return "reserve";
  if (REMOTE_VALUES.has(normalized)) return "remote_backend";
  return null;
}

function parseLegacyReserveFlag(value: unknown): CmsRuntimeMode | null {
  const normalized = safeTrim(value).toLowerCase();
  if (!normalized) return null;
  if (LOCAL_PROVIDER_VALUES.has(normalized)) return "reserve";
  if (RESERVE_VALUES.has(normalized)) return "reserve";
  if (REMOTE_VALUES.has(normalized)) return "remote_backend";
  return null;
}

export function getCmsRuntimeStatus(): CmsRuntimeStatus {
  const canonicalMode = parseExplicitMode(process.env[CMS_RUNTIME_MODE_FLAG]);
  if (canonicalMode) {
    return runtimeStatus(canonicalMode, CMS_RUNTIME_MODE_FLAG, true);
  }

  const legacyMode = parseExplicitMode(process.env[LEGACY_LOCAL_CMS_RUNTIME_MODE_FLAG]);
  if (legacyMode) {
    return runtimeStatus(legacyMode, LEGACY_LOCAL_CMS_RUNTIME_MODE_FLAG, true);
  }

  const legacyLocal = parseExplicitMode(process.env[LEGACY_LOCAL_CMS_RUNTIME_FLAG]);
  if (legacyLocal === "local_provider") {
    return runtimeStatus(legacyLocal, LEGACY_LOCAL_CMS_RUNTIME_FLAG, true);
  }

  const legacyReserve = parseLegacyReserveFlag(process.env[LEGACY_CONTENT_RESERVE_FLAG]);
  if (legacyReserve) {
    return runtimeStatus(legacyReserve, LEGACY_CONTENT_RESERVE_FLAG, true);
  }

  if (legacyLocal === "remote_backend") {
    return runtimeStatus("remote_backend", LEGACY_LOCAL_CMS_RUNTIME_FLAG, true);
  }

  return runtimeStatus("remote_backend", "default_remote_backend", false);
}

export function isLocalCmsRuntimeEnabled(): boolean {
  return getCmsRuntimeStatus().mode === "local_provider";
}

export function isCmsReserveModeEnabled(): boolean {
  return getCmsRuntimeStatus().mode === "reserve";
}

export function localCmsRuntimeStatus() {
  const status = getCmsRuntimeStatus();
  return {
    enabled: status.mode === "local_provider",
    mode: status.mode,
  } as const;
}

export function getLocalCmsRuntimeLoginCredentials(): LocalCmsRuntimeLoginCredentials | null {
  if (!isLocalCmsRuntimeEnabled()) return null;
  return { ...LOCAL_CMS_RUNTIME_LOGIN_CREDENTIALS };
}

