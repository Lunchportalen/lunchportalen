// app/superadmin/firms/[companyId]/actions.ts
"use server";

import { supabaseServer } from "@/lib/supabase/server";

export async function setCompanyStatus(companyId: string, status: "ACTIVE" | "PAUSED" | "CLOSED") {
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("companies")
    .update({ status })
    .eq("id", companyId);

  if (error) throw new Error("Kunne ikke oppdatere status");

  await supabase.from("audit_log").insert({
    entity: "company",
    entity_id: companyId,
    action: `STATUS_${status}`,
  });
}
