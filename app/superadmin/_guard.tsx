// app/superadmin/_guard.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

export default async function SuperadminGuard({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  // Ikke innlogget -> login (med next)
  if (error || !user) {
    redirect("/login?next=/superadmin");
  }

  // Hard superadmin-fasit
  const email = normEmail(user.email);
  if (email !== "superadmin@lunchportalen.no") {
    redirect("/"); // eller /week, men / er trygg "failsafe"
  }

  return <>{children}</>;
}
