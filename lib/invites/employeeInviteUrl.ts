import "server-only";

/** Canonical public URL path for employee invite acceptance (token i query). */
export const EMPLOYEE_INVITE_REGISTER_PATH = "/register/employee";

export function buildEmployeeInviteUrl(appBaseUrl: string, rawToken: string) {
  const base = String(appBaseUrl ?? "")
    .trim()
    .replace(/\/+$/, "");
  return `${base}${EMPLOYEE_INVITE_REGISTER_PATH}?token=${encodeURIComponent(rawToken)}`;
}

export function getPublicAppUrlFromEnv(): string {
  const env =
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  const s = String(env ?? "").trim();
  if (s) return s.startsWith("http") ? s.replace(/\/+$/, "") : `https://${s}`.replace(/\/+$/, "");
  return "http://localhost:3000";
}
