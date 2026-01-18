export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/admin/users");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "superadmin") redirect("/admin");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Brukere</h1>
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
              Kommer nå: brukeroversikt, rolleendring og firmotilknytning.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
          >
            Tilbake
          </Link>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Neste implementasjon</div>
          <ul className="mt-2 space-y-2 text-sm text-[rgb(var(--lp-muted))]">
            <li>• Søk på navn / e-post</li>
            <li>• Endre rolle (employee/company_admin/kitchen/driver)</li>
            <li>• Flytte bruker til firma (senere)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
