// app/admin/menus/page.tsx
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import MenusClient from "./MenusClient";

export default async function AdminMenusPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/admin/menus");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "superadmin") redirect("/admin");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
            <h1 className="text-2xl font-semibold tracking-tight">Meny</h1>
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
              Kvalitetssjekk og publisering av ukemeny (Man–Fre). Ingen redigering.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
          >
            Tilbake
          </Link>
        </div>

        <div className="mt-6">
          <MenusClient />
        </div>

        <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Regel (låst)</div>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Superadmin kan kun styre synlighet. Innhold redigeres i Sanity.
            Mangelfull meny kan ikke publiseres.
          </p>
        </div>
      </div>
    </main>
  );
}
