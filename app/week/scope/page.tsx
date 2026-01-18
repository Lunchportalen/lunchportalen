// app/week/scope/page.tsx
export const revalidate = 0;

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ScopeClient from "./ScopeClient";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export default async function WeekScopePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/week/scope");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id, location_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (profile?.role as Role | undefined) ?? undefined;

  // Kun roller som faktisk kan bestille i week
  if (!role || (role !== "superadmin" && role !== "company_admin" && role !== "employee")) {
    redirect("/admin");
  }

  // Hvis scope allerede finnes → tilbake til week
  if (profile?.company_id && profile?.location_id) {
    redirect("/week");
  }

  const nextRaw = searchParams?.next;
  const next =
    typeof nextRaw === "string" && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/week";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Oppsett</div>
          <h1 className="text-2xl font-semibold tracking-tight">Velg firma og lokasjon</h1>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Dette brukes kun for at du skal kunne bestille lunsj i ukevisningen. Ingen ansattvalg.
          </p>
        </div>

        <div className="mt-6">
          <ScopeClient nextPath={next} />
        </div>
      </div>
    </main>
  );
}
