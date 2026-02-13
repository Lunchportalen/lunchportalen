// app/login/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "./LoginForm";

type SP = Record<string, string | string[] | undefined>;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function first(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

/**
 * ✅ Safe redirect target
 * - internal only
 * - blocks auth-flow loops
 * - blocks /api/*
 * - blocks /superadmin (company_admin must land on /admin)
 */
function safeNextPath(next: string | null | undefined) {
  if (!next) return null;
  const n = safeStr(next);
  if (!n) return null;
  if (!n.startsWith("/")) return null;
  if (n.startsWith("//")) return null;
  if (n.startsWith("/api/")) return null;
  if (n.startsWith("/login")) return null;

  // blokkér auth-flow sider
  if (
    n === "/register" ||
    n.startsWith("/register/") ||
    n === "/registrering" ||
    n.startsWith("/registrering/") ||
    n === "/forgot-password" ||
    n.startsWith("/forgot-password/") ||
    n === "/reset-password" ||
    n.startsWith("/reset-password/")
  ) {
    return null;
  }

  // aldri send noen til superadmin via next
  if (n.startsWith("/superadmin")) return "/admin";

  return n;
}

function decodeBase64Json(val: string): any | null {
  // cookie format: "base64-<BASE64JSON>"
  const raw = val.startsWith("base64-") ? val.slice("base64-".length) : val;

  try {
    const json = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function findSupabaseAuthCookie(all: Array<{ name: string; value: string }>) {
  // Supabase SSR cookie name: sb-<project-ref>-auth-token
  const c = all.find((x) => x.name.startsWith("sb-") && x.name.endsWith("-auth-token"));
  return c ?? null;
}

function isSessionValid(payload: any) {
  // payload typically includes: access_token, token_type, expires_at, user:{...}
  const expiresAt = Number(payload?.expires_at ?? 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false;

  // expires_at is unix seconds
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt <= now) return false;

  const email = safeStr(payload?.user?.email);
  return !!email;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}) {
  // ✅ Next 15.5: may be Promise → must await
  const sp = await Promise.resolve(searchParams ?? {});
  const nextRaw = first(sp.next);
  const nextSafe = safeNextPath(nextRaw);

  // ✅ ZERO-network auth check:
  // If auth cookie exists + not expired, redirect away from /login immediately.
  // IMPORTANT: redirect to a stable target to avoid loops.
  const jar = await cookies();
  const all = jar.getAll();
  const authCookie = findSupabaseAuthCookie(all);

  if (authCookie) {
    const payload = decodeBase64Json(authCookie.value);
    if (payload && isSessionValid(payload)) {
      // ✅ Send user to post-login router which resolves role->landing and applies allowlist for next
      const to = `/api/auth/post-login${nextSafe ? `?next=${encodeURIComponent(nextSafe)}` : ""}`;
      redirect(to);
    }
  }

  // Not logged in (or cookie missing/expired) → show form
  return (
    <AuthShell title="Logg inn" subtitle="Tilgang for ansatte og administrator.">
      <LoginForm />
    </AuthShell>
  );
}
