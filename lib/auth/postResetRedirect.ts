import type { SupabaseClient } from "@supabase/supabase-js";

export const POST_RESET_SUCCESS_MESSAGE = "Passordet er oppdatert.";
export const POST_RESET_REDIRECT_MESSAGE = "Sender deg videre …";

/** Canonical post-login resolver used by login form — same path after password reset. */
export function buildPostLoginRedirectUrl(): string {
  return "/api/auth/post-login";
}

/**
 * Mirror browser recovery session into SSR auth cookies before post-login redirect.
 * Never log tokens.
 */
export async function syncAuthSessionToServer(sb: SupabaseClient): Promise<boolean> {
  const { data } = await sb.auth.getSession();
  const access_token = data?.session?.access_token;
  const refresh_token = data?.session?.refresh_token;
  if (!access_token || !refresh_token) return false;

  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify({ access_token, refresh_token }),
  });

  return res.ok;
}

export async function redirectAfterPasswordReset(sb: SupabaseClient): Promise<void> {
  await syncAuthSessionToServer(sb);
  window.location.assign(buildPostLoginRedirectUrl());
}
