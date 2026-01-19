// app/week/page.tsx
import { redirect } from "next/navigation";
import WeekClient from "./WeekClient";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await supabaseServer();

  // 1. Autentisering
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Profil + rolle + scope
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, company_id, location_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[week/page] profile error:", error);
    redirect("/login");
  }

  const role = profile?.role;

  // 3. Superadmin skal aldri til /week
  if (role === "superadmin") {
    redirect("/kitchen"); // evt. /superadmin hvis du heller vil
  }

  // 4. Week krever firmatilknytning
  if (!profile?.company_id || !profile?.location_id) {
    return (
      <main className="mx-auto max-w-3xl px-6 pb-10 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          Mangler firmatilknytning
        </h1>
        <p className="mt-2 text-sm text-muted">
          Kontoen din er ikke knyttet til et firma eller en lokasjon.
          Ta kontakt med firmaets administrator.
        </p>
      </main>
    );
  }

  // 5. Alt OK → vis ukeplanlegging
  return (
    <main className="mx-auto max-w-5xl px-6 pb-10 pt-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-text">
          Planlegg lunsj
        </h1>
        <p className="mt-2 text-sm text-muted">
          Endringer låses kl.{" "}
          <span className="font-medium text-text">08:00</span> samme dag.
        </p>
      </div>

      <WeekClient />
    </main>
  );
}
