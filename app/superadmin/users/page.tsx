// app/superadmin/users/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import SuperadminUsersClient from "@/components/superadmin/SuperadminUsersClient";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";

export default async function SuperadminUsersPage() {
  const sb = await supabaseServer();

  // Auth gate
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) redirect("/login?next=/superadmin/users");

  // Role gate: profiles.role === "superadmin"
  if (!(await isSuperadminProfile(user.id))) {
    redirect("/login?next=/superadmin");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 lp-select-text">
      <h1 className="text-2xl font-semibold tracking-tight">Brukere (Superadmin)</h1>
      <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
        Full oversikt. Slett eller deaktiver. Alt skal audites.
      </p>

      <div className="mt-6 rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <SuperadminUsersClient />
      </div>
    </main>
  );
}
