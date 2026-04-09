// app/superadmin/invoices/reconcile/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import ReconcileClient from "./ReconcileClient";
import { supabaseServer } from "@/lib/supabase/server";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function defaultMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function normalizeMonth(raw: string): string {
  const month = safeStr(raw);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return defaultMonth();
  return month;
}

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const sb = await supabaseServer();

  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect("/login?next=/superadmin/invoices/reconcile");
  }

  if (!(await isSuperadminProfile(user.id))) {
    redirect("/login?next=/superadmin");
  }

  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const monthRaw = searchParams?.month;
  const monthValue = Array.isArray(monthRaw) ? monthRaw[0] : monthRaw;
  const initialMonth = normalizeMonth(safeStr(monthValue));

  return <ReconcileClient initialMonth={initialMonth} />;
}
