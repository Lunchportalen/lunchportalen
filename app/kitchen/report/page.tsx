// app/kitchen/report/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import KitchenReportClient from "./KitchenReportClient";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
/**
 * 🔒 NO-EXCEPTION RULE:
 * - systemkonto via epost er fasit
 * - ellers profiles.role (server truth)
 */
function roleByEmailOrProfile(email: string | null | undefined, profileRole: any): Role | null {
  const sys = systemRoleByEmail(email);
  if (sys) return sys;

  const pr = safeStr(profileRole) as Role;
  if (pr === "kitchen" || pr === "superadmin" || pr === "company_admin" || pr === "employee" || pr === "driver") return pr;

  return null;
}

export default async function KitchenReportPage() {
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();

  // ✅ Må være innlogget
  if (authErr || !auth?.user) {
    redirect("/login?next=/kitchen/report");
  }

  const userId = auth.user.id;
  const email = auth.user.email ?? "";

  // ✅ RLS-safe read: profiles (role-truth)
  const { data: me, error: meErr } = await sb
    .from("profiles")
    .select("user_id, role")
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  // Hvis profiles feiler, behandler vi som unauthorized (ingen unntak)
  if (meErr) {
    redirect("/login?next=/kitchen/report");
  }

  const role = roleByEmailOrProfile(email, me?.role);

  // ✅ Kun kitchen + superadmin
  if (role !== "kitchen" && role !== "superadmin") {
    redirect("/login?next=/kitchen/report");
  }

  return <KitchenReportClient />;
}
