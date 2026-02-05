// app/superadmin/invoices/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import InvoicesClient from "./InvoicesClient";
import { supabaseServer } from "@/lib/supabase/server";
import { isSuperadminEmail } from "@/lib/system/emails";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type ProfileRow = { role: Role | null };

function isHardSuperadmin(email: string | null | undefined) {
  return isSuperadminEmail(email);
}

export default async function Page() {
  const sb = await supabaseServer();

  // Auth gate
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect("/login?next=/superadmin/invoices");
  }

  // Role gate (FASET)
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (pErr || !profile?.role) redirect("/login?next=/superadmin");
  if (profile.role !== "superadmin" || !isHardSuperadmin(user.email)) {
    redirect("/login?next=/superadmin");
  }

  return <InvoicesClient />;
}
