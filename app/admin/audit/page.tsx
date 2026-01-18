// app/admin/audit/page.tsx
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AuditClient from "./AuditClient";

export default async function AdminAuditPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/admin/audit");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || profile?.role !== "superadmin") {
    redirect("/admin");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              Audit / Revisjon
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
              Hvem gjorde hva – og når. Minimumsspor for ansvar og revisjon.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
          >
            Tilbake
          </Link>
        </div>

        {/* Content */}
        <div className="mt-6">
          <AuditClient />
        </div>

        {/* Footnote / principles */}
        <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Prinsipp</div>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Audit-loggen er ikke et analyseverktøy. Den eksisterer for ansvar,
            sporbarhet og revisjon. Hendelser kan ikke redigeres eller slettes.
          </p>
        </div>
      </div>
    </main>
  );
}
