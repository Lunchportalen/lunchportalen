import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "investor_experiments_count";

export async function countRunningCmsExperiments(): Promise<number> {
  if (!hasSupabaseAdminConfig()) return 0;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "experiments", ROUTE);
    if (!ok) return 0;
    const { count, error } = await admin
      .from("experiments")
      .select("id", { count: "exact", head: true })
      .eq("status", "running");
    if (error) return 0;
    return typeof count === "number" ? count : 0;
  } catch {
    return 0;
  }
}
