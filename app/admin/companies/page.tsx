// app/admin/companies/page.tsx
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import CompaniesClient from "./CompaniesClient";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export default async function AdminCompaniesPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/admin/companies");

  // ✅ Hos dere: profiles PK = user_id
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (profile?.role as Role | undefined) ?? undefined;

  // Kun superadmin
  if (error || role !== "superadmin") redirect("/admin");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              Firma
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
              Liste over firma med statuskontroll på firmanivå (Active / Paused /
              Closed). Ingen unntak.
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
          {/* Client: søk + filter + status-actions */}
          <CompaniesClient />
        </div>

        <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Regel (låst)</div>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Firmastatus er én sannhetskilde. Når et firma settes til Paused eller
            Closed, stoppes innlogging og alle beskyttede ruter automatisk av
            middleware og API-guards.
          </p>
        </div>
      </div>
    </main>
  );
}
