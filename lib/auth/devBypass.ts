import "server-only";

import {
  decodeLocalDevAuthSessionPayload,
  isLocalDevAuthBypassEnabled,
  LOCAL_DEV_AUTH_BYPASS_FLAG,
  LOCAL_DEV_AUTH_COOKIE,
} from "@/lib/auth/localDevBypassCookie";
import { buildLocalRuntimeAuthSession, type LocalRuntimeAuthSession } from "@/lib/auth/localRuntimeAuth";

export { LOCAL_DEV_AUTH_BYPASS_FLAG, LOCAL_DEV_AUTH_COOKIE };
export type LocalDevAuthSession = LocalRuntimeAuthSession;

export const LOCAL_DEV_AUTH_ACCESS_TOKEN = "lp_local_dev_auth_access";
export const LOCAL_DEV_AUTH_REFRESH_TOKEN = "lp_local_dev_auth_refresh";

type CookieReader = {
  get(name: string): { value?: string } | undefined;
};

type CookieWriter = {
  set(input: {
    name: string;
    value: string;
    path: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax";
    maxAge?: number;
  }): void;
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function baseCookie() {
  return {
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
  };
}

function encodeSession(session: LocalDevAuthSession): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

export { isLocalDevAuthBypassEnabled };

export function buildLocalDevAuthSession(): LocalDevAuthSession {
  return buildLocalRuntimeAuthSession();
}

export function readLocalDevAuthSession(cookieReader: CookieReader): LocalDevAuthSession | null {
  if (!isLocalDevAuthBypassEnabled()) return null;
  const raw = safeStr(cookieReader.get(LOCAL_DEV_AUTH_COOKIE)?.value);
  if (!raw) return null;
  return decodeLocalDevAuthSessionPayload(raw);
}

export function writeLocalDevAuthSessionCookies(
  cookieWriter: CookieWriter,
  session: LocalDevAuthSession = buildLocalDevAuthSession()
): void {
  const payload = encodeSession(session);
  const cookie = baseCookie();
  cookieWriter.set({
    name: LOCAL_DEV_AUTH_COOKIE,
    value: payload,
    ...cookie,
  });
  /**
   * Legacy httpOnly mirror cookies (optional compatibility only).
   * Middleware and `getAuthContext()` do **not** treat these as canonical session proof;
   * SSR `sb-*-auth-token*` or `lp_local_dev_auth` (when bypass enabled) are the gates.
   */
  cookieWriter.set({
    name: "sb-access-token",
    value: LOCAL_DEV_AUTH_ACCESS_TOKEN,
    ...cookie,
  });
  cookieWriter.set({
    name: "sb-refresh-token",
    value: LOCAL_DEV_AUTH_REFRESH_TOKEN,
    ...cookie,
  });
}

export function clearLocalDevAuthSessionCookies(cookieWriter: CookieWriter): void {
  const cookie = baseCookie();
  cookieWriter.set({
    name: LOCAL_DEV_AUTH_COOKIE,
    value: "",
    maxAge: 0,
    ...cookie,
  });
  cookieWriter.set({
    name: "sb-access-token",
    value: "",
    maxAge: 0,
    ...cookie,
  });
  cookieWriter.set({
    name: "sb-refresh-token",
    value: "",
    maxAge: 0,
    ...cookie,
  });
}
