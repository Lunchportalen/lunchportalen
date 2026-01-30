// 3) SIDE: app/system/kvittering/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import ReceiptClient from "./receipt-client";
import { supabaseServer } from "@/lib/supabase/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export default async function KvitteringPage() {
  const sb = await supabaseServer();

  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) {
    redirect("/login?next=/system/kvittering");
  }

  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (pErr || !profile?.role) redirect("/login?next=/system/kvittering");

  const role = safeStr(profile.role) as Role;

  // Kun superadmin + kitchen
  if (role !== "superadmin" && role !== "kitchen") {
    redirect("/login?next=/system/kvittering");
  }

  return <ReceiptClient />;
}
