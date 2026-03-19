// app/superadmin/system/operations/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import SystemOperationsDashboard from "../SystemOperationsDashboard";
import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function SuperadminSystemOperationsPage() {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user) {
    redirect("/login");
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-neutral-600">
        <Link href="/superadmin/system" className="text-[rgb(var(--lp-accent))] hover:underline">
          ← System
        </Link>
      </div>
      <SystemOperationsDashboard />
    </div>
  );
}
