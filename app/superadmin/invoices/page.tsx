// app/superadmin/invoices/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import InvoicesClient from "./InvoicesClient";
import { supabaseServer } from "@/lib/supabase/server";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";

export default async function Page() {
  const sb = await supabaseServer();

  // Auth gate
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect("/login?next=/superadmin/invoices");
  }

  // Role gate: profiles.role === "superadmin"
  if (!(await isSuperadminProfile(user.id))) {
    redirect("/login?next=/superadmin");
  }

  return <InvoicesClient />;
}
