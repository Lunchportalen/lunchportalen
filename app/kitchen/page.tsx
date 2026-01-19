// app/kitchen/page.tsx
import { redirect } from "next/navigation";
import KitchenView from "./KitchenView";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const supabase = await supabaseServer();

  /* =========================
     🔐 AUTH GATE
  ========================= */
  const { data: auth, error: authErr } = await supabase.auth.getUser();

  // Hvis auth feiler eller user mangler -> login (med next)
  if (authErr || !auth?.user) {
    redirect("/login?next=/kitchen");
  }

  /* =========================
     🔐 ROLE GATE
     profiles.id = auth.user.id
  ========================= */
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  // Hvis profilen ikke kan leses -> send til hoved (uke)
  if (profileErr || !profile?.role) {
    redirect("/week");
  }

  const role = profile.role;

  // ✅ Kun kitchen og superadmin
  if (!["kitchen", "superadmin"].includes(role)) {
    redirect("/week");
  }

  /* =========================
     ✅ PAGE
  ========================= */
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 print:p-0">
      {/* Sticky topp for kjøkken (bedre drift/bruk) */}
      <div className="sticky top-0 z-10 -mx-6 mb-6 border-b border-slate-200 bg-[rgb(var(--lp-bg))]/90 px-6 py-4 backdrop-blur print:static print:border-0 print:bg-transparent print:backdrop-blur-0">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Kjøkken – dagens bestillinger
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Velg dato, bruk hurtigknapper og få full oversikt per firma,
              lokasjon og ansatt.
            </p>
          </div>

          {/* Drifts-hints (informasjon – ikke knapper) */}
          <div className="hidden flex-wrap gap-3 text-xs text-slate-600 md:flex print:hidden">
            <div className="flex items-center gap-2">
              <span aria-hidden>⌛</span>
              <span>Hurtigvalg: i dag / neste</span>
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden>📅</span>
              <span>Datovelger + leveringsdag</span>
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden>🖨️</span>
              <span>Print-vennlig liste</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selve kjøkkenvisningen (her ligger ekte knapper/datovelger) */}
      <KitchenView />
    </main>
  );
}
