/**
 * Local dev auth bypass — shared between **Edge (middleware)** and Node (API / RSC).
 *
 * Canonical session source in normal operation: Supabase SSR `sb-*-auth-token*` cookies
 * (see `utils/supabase/ssrSessionCookies.ts` + `updateSession`).
 *
 * This path exists only when `isLocalDevAuthBypassEnabled()` is true:
 * - Local CMS runtime (`LP_CMS_RUNTIME_MODE` → local provider) **only when `NODE_ENV !== "production"`**
 * - or `LOCAL_DEV_AUTH_BYPASS=true` when `NODE_ENV !== "production"`.
 * Production (`NODE_ENV === "production"`) never enables this path, even if CMS flags are mis-set.
 */
import type { NextRequest } from "next/server";

import type { LocalRuntimeAuthSession } from "@/lib/auth/localRuntimeAuth";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";

export const LOCAL_DEV_AUTH_BYPASS_FLAG = "LOCAL_DEV_AUTH_BYPASS";
export const LOCAL_DEV_AUTH_COOKIE = "lp_local_dev_auth";

export type LocalDevAuthCookieSession = LocalRuntimeAuthSession;

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

export function isLocalDevAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (isLocalCmsRuntimeEnabled()) return true;
  return safeStr(process.env[LOCAL_DEV_AUTH_BYPASS_FLAG]).toLowerCase() === "true";
}

/** Edge-safe base64url → UTF-8 (matches `Buffer#toString("base64url")` in `devBypass`). */
function decodeBase64UrlUtf8(payload: string): string {
  const pad = payload.length % 4 === 0 ? "" : "=".repeat(4 - (payload.length % 4));
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

export function decodeLocalDevAuthSessionPayload(raw: string): LocalDevAuthCookieSession | null {
  try {
    const json = decodeBase64UrlUtf8(raw);
    const parsed = JSON.parse(json) as Partial<LocalDevAuthCookieSession> | null;
    const userId = safeStr(parsed?.userId);
    const email = safeStr(parsed?.email).toLowerCase();
    const role = safeStr(parsed?.role);
    if (!userId || !email || role !== "superadmin") return null;
    return {
      userId,
      email,
      role: "superadmin",
      company_id: null,
      location_id: null,
    };
  } catch {
    return null;
  }
}

export function readLocalDevAuthSessionFromCookieJar(
  entries: Iterable<{ name: string; value?: string }>
): LocalDevAuthCookieSession | null {
  if (!isLocalDevAuthBypassEnabled()) return null;
  for (const c of entries) {
    if (String(c.name ?? "") !== LOCAL_DEV_AUTH_COOKIE) continue;
    const raw = safeStr(c.value);
    if (!raw) return null;
    return decodeLocalDevAuthSessionPayload(raw);
  }
  return null;
}

export function hasLocalDevBypassSessionInCookieJar(
  entries: Iterable<{ name: string; value?: string }>
): boolean {
  return readLocalDevAuthSessionFromCookieJar(entries) != null;
}

/** Explicit middleware helper: same gate signal as `getAuthContext()` dev-bypass branch. */
export function isLocalDevAuthenticatedRequest(req: Pick<NextRequest, "cookies">): boolean {
  return hasLocalDevBypassSessionInCookieJar(req.cookies.getAll());
}
