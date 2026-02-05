// app/superadmin/layout.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import SuperadminHeader from "@/components/superadmin/SuperadminHeader";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";

/* =========================
   Security helpers (fail-closed)
========================= */

type ProfileRow = {
  disabled_at: string | null;
};

async function currentPathFromHeaders() {
  try {
    const h = await headers(); // ✅ your Next requires await

    // Best-effort: if you set "x-url" in middleware, prefer that.
    const url = h.get("x-url") || h.get("next-url") || h.get("referer") || "";
    if (url) {
      const u = new URL(url);
      const path = (u.pathname || "/superadmin") + (u.search || "");
      return path.startsWith("/superadmin") ? path : "/superadmin";
    }
  } catch {}

  return "/superadmin";
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
    redirect(`/login?next=${next}`);
  }

  const role = await getRoleForUser(user.id);

  if (role !== "superadmin") {
    if (role === "company_admin") redirect("/admin?e=forbidden");
    if (role === "employee") redirect("/orders?e=forbidden");
    if (role === "driver") redirect("/driver?e=forbidden");
    if (role === "kitchen") redirect("/kitchen?e=forbidden");
    redirect("/login");
  }

  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("disabled_at")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle<ProfileRow>();

  if (pErr || profile?.disabled_at) {
    redirect("/login");
  }

  // ✅ Enterprise shell (consistent, calm, "command center")
  return (
    <div className="min-h-[calc(100vh-0px)] bg-[rgb(var(--lp-bg))]">
      <SuperadminHeader />
      <div className="mx-auto max-w-7xl px-4 pt-[27px] pb-16">
        <div className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))] shadow-sm backdrop-blur sm:p-6">
          {children}
        </div>

        <div className="mt-6 text-[11px] font-semibold text-[rgb(var(--lp-muted))]">
          Cache: no-store • Runtime: nodejs
        </div>
      </div>
    </div>
  );
}
