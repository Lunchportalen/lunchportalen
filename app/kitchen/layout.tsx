// app/kitchen/layout.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  // Ikke innlogget
  if (!user) redirect("/login?next=/kitchen");

  const email = normEmail(user.email);

  // ✅ Fasit: kun KJØKKEN-konto får være her
  if (email === "kjokken@lunchportalen.no") {
    return <>{children}</>;
  }

  // ✅ Superadmin skal alltid til superadmin
  if (email === "superadmin@lunchportalen.no") redirect("/superadmin");

  // ✅ Driver skal til driver
  if (email === "driver@lunchportalen.no") redirect("/driver");

  // ✅ Kunder skal aldri til kitchen
  // (company_admin / employee)
  redirect("/admin");
}
