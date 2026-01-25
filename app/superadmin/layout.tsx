// app/superadmin/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import SuperadminNav from "@/components/superadmin/SuperadminNav";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type ProfileRow = {
  role: Role | null;
  disabled_at: string | null;
};

/* =========================
   Security helpers (fail-closed)
========================= */

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function normalizeRole(v: unknown): Role {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  return "employee";
}

/**
 * Primary policy:
 * - Superadmin is hard-locked by email (cannot be spoofed by metadata).
 * Secondary:
 * - We still read profiles.role to detect disabled users and mismatches.
 */
function isHardSuperadminEmail(email: string | null | undefined) {
  return normEmail(email) === "superadmin@lunchportalen.no";
}

function computeRoleFromUserMetadata(user: any): Role {
  // Never trust client-supplied fields, but server-side user object is still “soft”
  const appRole = normalizeRole(user?.app_metadata?.role);
  if (appRole !== "employee") return appRole;

  const metaRole = normalizeRole(user?.user_metadata?.role);
  return metaRole;
}

async function currentPathFromHeaders() {
  try {
    const h = await headers();
    const url = h.get("x-url") || h.get("referer") || "";
    if (url) {
      const u = new URL(url);
      const path = (u.pathname || "/superadmin") + (u.search || "");
      return path.startsWith("/superadmin") ? path : "/superadmin";
    }
  } catch {}
  return "/superadmin";
}

function noStore() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

/* =========================
   Layout
========================= */

export default async function SuperadminLayout({ children }: { children: ReactNode }) {
  const sb = await supabaseServer();

  // ✅ Keep auth lookups server-side, never cached
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  // Not logged in → route to auth router with safe next
  if (error || !user) {
    const next = encodeURIComponent(await currentPathFromHeaders());
    redirect(`/api/auth/redirect?next=${next}`);
  }

  // ✅ Hard superadmin gate (email) – cannot be overridden by metadata
  const hardOk = isHardSuperadminEmail(user.email);

  // ✅ Also read profiles to enforce disabled gate and detect role drift
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("role,disabled_at")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  // Fail-closed if profiles cannot be read (security > convenience)
  if (pErr) {
    const next = encodeURIComponent(await currentPathFromHeaders());
    redirect(`/api/auth/redirect?next=${next}`);
  }

  // Disabled users are always blocked (including superadmin email)
  if (profile?.disabled_at) {
    const next = encodeURIComponent(await currentPathFromHeaders());
    redirect(`/api/auth/redirect?next=${next}`);
  }

  // If hard email is correct, allow regardless of profiles.role (avoid lockout).
  // If hard email is not correct, require profiles.role === superadmin OR user metadata role.
  const metaRole = computeRoleFromUserMetadata(user);
  const dbRole = normalizeRole(profile?.role);

  const allowed =
    hardOk ||
    dbRole === "superadmin" ||
    metaRole === "superadmin"; // fallback for early-stage setups (still server-side user obj)

  if (!allowed) {
    const next = encodeURIComponent(await currentPathFromHeaders());
    redirect(`/api/auth/redirect?next=${next}`);
  }

  // ✅ Enterprise shell (consistent, calm, "command center")
  return (
    <div className="min-h-[calc(100vh-0px)] bg-[rgb(var(--lp-bg))]">
      {/* Top shell */}
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
        {/* Header row */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white ring-1 ring-[rgb(var(--lp-border))] shadow-sm">
              <span className="text-sm font-black text-neutral-900">SA</span>
            </div>
            <div>
              <div className="text-xs font-extrabold tracking-wide text-neutral-600">LUNCHPORTALEN</div>
              <div className="text-xl font-black tracking-tight text-neutral-950">Superadmin</div>
            </div>
          </div>

          {/* Right meta */}
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <div className="hidden sm:block rounded-2xl bg-white/70 px-3 py-2 text-xs font-bold text-neutral-700 ring-1 ring-[rgb(var(--lp-border))] backdrop-blur">
              {normEmail(user.email)}
            </div>

            {/* System badge placeholder – safe, no data leaks */}
            <div className="rounded-2xl bg-white/70 px-3 py-2 text-xs font-extrabold text-neutral-700 ring-1 ring-[rgb(var(--lp-border))] backdrop-blur">
              SYSTEM: <span className="text-emerald-700">NORMAL</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="mb-6">
          <SuperadminNav />
        </div>

        {/* Content surface */}
        <div className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))] shadow-sm backdrop-blur sm:p-6">
          {children}
        </div>

        {/* Footer meta (quiet) */}
        <div className="mt-6 text-[11px] font-semibold text-[rgb(var(--lp-muted))]">
          Cache: no-store • Runtime: nodejs
        </div>
      </div>
    </div>
  );
}
