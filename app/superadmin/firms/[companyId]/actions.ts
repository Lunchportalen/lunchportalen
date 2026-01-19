// app/superadmin/firms/[companyId]/actions.ts
"use server";

import { supabaseServer } from "@/lib/supabase/server";

export type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED";

function isCompanyStatus(v: any): v is CompanyStatus {
  return v === "ACTIVE" || v === "PAUSED" || v === "CLOSED";
}

function severityFor(status: CompanyStatus) {
  if (status === "CLOSED") return "critical";
  if (status === "PAUSED") return "warning";
  return "info";
}

export async function setCompanyStatus(companyId: string, nextStatus: CompanyStatus) {
  if (!companyId) throw new Error("companyId mangler");
  if (!isCompanyStatus(nextStatus)) throw new Error("Ugyldig status");

  const supabase = await supabaseServer();

  // ✅ actor (auth)
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) throw new Error("Ikke innlogget");

  const actor_user_id = user.id;
  const actor_email = user.email ?? null;

  // ✅ enterprise: hent rolle fra profiles (kilde til sannhet)
  const prof = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", actor_user_id) // ✅ FASIT: profiles PK er user_id
    .single();

  if (prof.error) throw new Error(prof.error.message);

  const actor_role = String(prof.data?.role ?? "");
  if (actor_role !== "superadmin") {
    throw new Error("Mangler tilgang (superadmin kreves)");
  }

  // ✅ hent nåværende firma (status + navn)
  const cur = await supabase
    .from("companies")
    .select("id,name,status")
    .eq("id", companyId)
    .single();

  if (cur.error) throw new Error(cur.error.message);

  const companyName = cur.data?.name ?? "Ukjent firma";
  const currentStatus = cur.data?.status as CompanyStatus | undefined;
  if (!currentStatus) throw new Error("Mangler status på firma");

  // ✅ idempotens: samme status -> ingen audit
  if (currentStatus === nextStatus) {
    return { ok: true as const, changed: false as const, status: currentStatus };
  }

  // ✅ status-update (kjernehandling) – returner oppdatert row
  const upd = await supabase
    .from("companies")
    .update({ status: nextStatus })
    .eq("id", companyId)
    .select("id,status")
    .single();

  if (upd.error) throw new Error(upd.error.message);

  // ✅ audit_log insert
  const before = { status: currentStatus };
  const after = { status: nextStatus };

  const auditPayload = {
    actor_user_id,
    actor_role,
    actor_email,
    action: "company.status_changed",
    severity: severityFor(nextStatus),

    company_id: companyId,
    target_type: "company",
    target_id: companyId, // text i din tabell
    target_label: companyName,

    before,
    after,

    meta: {
      source: "superadmin_ui",
      ui: "CompanyStatusControls",
    },
  };

  // Enterprise valg:
  // A) Hard fail hvis audit feiler (streng compliance)
  // B) Best effort (status endres uansett, men vi logger error)
  const HARD_FAIL_ON_AUDIT = true;

  const ins = await supabase.from("audit_log").insert(auditPayload);

  if (ins.error) {
    if (HARD_FAIL_ON_AUDIT) {
      // Rollback-strategi: prøv å sette status tilbake (best effort),
      // siden vi ikke har transaksjon her.
      await supabase.from("companies").update({ status: currentStatus }).eq("id", companyId);
      throw new Error(`Audit feilet, endringen ble rullet tilbake: ${ins.error.message}`);
    } else {
      console.error("[audit_log insert failed]", ins.error.message, auditPayload);
    }
  }

  return {
    ok: true as const,
    changed: true as const,
    from: currentStatus,
    to: nextStatus,
    status: upd.data?.status ?? nextStatus,
  };
}
