// app/superadmin/_guard.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSuperadminEmail } from "@/lib/system/emails";

export default async function SuperadminGuard({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  // Ikke innlogget -> login (med next)
  if (error || !user) {
    redirect("/login?next=/superadmin");
  }

  // Hard superadmin-fasit
  if (!isSuperadminEmail(user.email)) {
    redirect("/"); // eller /week, men / er trygg "failsafe"
  }

  return <>{children}</>;
}
