// app/kitchen/page.tsx
import { redirect } from "next/navigation";
import KitchenView from "./KitchenView";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const supabase = await supabaseServer();

  // 🔐 Auth gate
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    redirect("/login?next=/kitchen");
  }

  // 🔐 Role gate (profiles.id = auth.user.id)
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  // Hvis profilen ikke kan leses -> send til uke (hoved)
  if (error || !profile?.role) {
    redirect("/week");
  }

  const role = profile.role;

  // ✅ Kun kitchen og superadmin
  if (!["kitchen", "superadmin"].includes(role)) {
    redirect("/week");
  }

  return (
    <main className="mx-auto max-w-6xl p-6 print:p-0">
      <h1 className="mb-6 text-3xl font-semibold">
        Kjøkken – dagens bestillinger
      </h1>
      <KitchenView />
    </main>
  );
}
