import {
  getLocalCmsRuntimeLoginCredentials,
  isLocalCmsRuntimeEnabled,
  type LocalCmsRuntimeLoginCredentials,
} from "@/lib/localRuntime/runtime";
import { allowNextForRole, landingForRole } from "@/lib/auth/role";

export type LocalRuntimeAuthRole = "superadmin";

export type LocalRuntimeAuthSession = {
  userId: string;
  email: string;
  role: LocalRuntimeAuthRole;
  company_id: null;
  location_id: null;
};

export type LocalRuntimeAuthState = {
  credentials: LocalCmsRuntimeLoginCredentials;
  session: LocalRuntimeAuthSession;
  defaultNext: string;
};

const LOCAL_RUNTIME_AUTH_USER_ID = "00000000-0000-4000-8000-000000000043";
const LOCAL_RUNTIME_AUTH_FALLBACK_EMAIL = "local.dev.superadmin@lunchportalen.local";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function normEmail(value: unknown): string {
  return safeStr(value).toLowerCase();
}

export function getLocalRuntimeAuthState(): LocalRuntimeAuthState | null {
  if (!isLocalCmsRuntimeEnabled()) return null;

  const credentials = getLocalCmsRuntimeLoginCredentials();
  if (!credentials) return null;

  const session: LocalRuntimeAuthSession = {
    userId: LOCAL_RUNTIME_AUTH_USER_ID,
    email: credentials.email,
    role: "superadmin",
    company_id: null,
    location_id: null,
  };

  return {
    credentials,
    session,
    defaultNext: allowNextForRole(session.role, "/backoffice/content") ?? landingForRole(session.role),
  };
}

export function getLocalRuntimeLoginCredentials(): LocalCmsRuntimeLoginCredentials | null {
  const state = getLocalRuntimeAuthState();
  return state ? { ...state.credentials } : null;
}

export function buildLocalRuntimeAuthSession(): LocalRuntimeAuthSession {
  const state = getLocalRuntimeAuthState();
  if (state) {
    return { ...state.session };
  }

  return {
    userId: LOCAL_RUNTIME_AUTH_USER_ID,
    email: LOCAL_RUNTIME_AUTH_FALLBACK_EMAIL,
    role: "superadmin",
    company_id: null,
    location_id: null,
  };
}

export function isLocalRuntimeLoginMatch(input: {
  email: string;
  password: string;
}): boolean {
  const state = getLocalRuntimeAuthState();
  if (!state) return false;

  return (
    normEmail(input.email) === normEmail(state.credentials.email) &&
    String(input.password ?? "") === state.credentials.password
  );
}

export function resolveLocalRuntimeLoginNext(nextPath: string | null | undefined): string | null {
  const state = getLocalRuntimeAuthState();
  if (!state) return null;
  return allowNextForRole(state.session.role, nextPath ?? null) ?? state.defaultNext;
}
