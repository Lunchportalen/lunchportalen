import { redirect } from "next/navigation";
import KitchenView from "./KitchenView";
import { supabaseServer } from "@/lib/supabase/server";

export const revalidate = 30;

export default async function Page() {
  const supabase = await supabaseServer();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (error) {
    redirect("/today");
  }

  const role = profile?.role ?? "employee";

  // ✅ Kun admin/superadmin
  if (role !== "company_admin" && role !== "superadmin") {
    redirect("/today");
  }

  return (
    <main className="mx-auto max-w-6xl p-6 print:p-0">
      <h1 className="mb-6 text-3xl font-semibold">Kjøkken – dagens bestillinger</h1>
      <KitchenView />
    </main>
  );
}
