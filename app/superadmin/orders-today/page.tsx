// app/superadmin/orders-today/page.tsx — hub entry removed; deep links redirect to operativ oversikt
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";

export default async function OrdersTodayPage() {
  const sb = await supabaseServer();

  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect("/login?next=/superadmin/orders-today");
  }

  if (!(await isSuperadminProfile(user.id))) {
    redirect("/login?next=/superadmin");
  }

  redirect("/superadmin/operations");
}
