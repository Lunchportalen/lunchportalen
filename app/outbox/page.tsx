// app/outbox/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import OutboxClient from "../superadmin/outbox/outbox-client";
import { SYSTEM_EMAILS } from "@/lib/system/emails";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normEmail(v: any) {
  return safeStr(v).toLowerCase();
}
function normRole(v: any) {
  return safeStr(v).toLowerCase().replace(/[^a-z]/g, "");
}

const NEXT = "/outbox";

export default async function OutboxOpsPage() {
  const sb = await supabaseServer();

  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) redirect(`/login?next=${encodeURIComponent(NEXT)}`);

  const email = normEmail(auth.user.email);
  if (email === SYSTEM_EMAILS.ORDER) {
    // ✅ Ordre-bruker får slippe inn uten profiles
    return <OutboxClient apiBase="/api/outbox" />;
  }

  // ellers: superadmin (for sikkerhet)
  const { data: profile } = await sb
    .from("profiles")
    .select("role, disabled_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!profile || (profile as any).disabled_at) redirect(`/login?next=${encodeURIComponent(NEXT)}`);

  if (normRole((profile as any).role) !== "superadmin") {
    redirect("/superadmin"); // fail-safe
  }

  return <OutboxClient apiBase="/api/superadmin/outbox" />;
}
