// app/min-side/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function MinSidePage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  // Ikke innlogget → til login
  if (!data.user) redirect("/login?next=%2Fweek");

  // Innlogget → Min side peker på dashboardet ditt
  redirect("/week");
}
