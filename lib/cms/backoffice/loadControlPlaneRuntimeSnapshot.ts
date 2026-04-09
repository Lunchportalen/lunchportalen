import "server-only";

import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export type ControlPlaneRuntimeSnapshot =
  | {
      ok: true;
      companies: { total: number; active: number; pending: number; paused: number; closed: number };
      locations: number;
      activeAgreements: number;
    }
  | { ok: false; message: string };

/**
 * Read-only aggregater for CMS control plane (superadmin backoffice).
 * Samme tillitsnivå som øvrige superadmin server-aggregater — ingen mutasjon.
 */
export async function loadControlPlaneRuntimeSnapshot(): Promise<ControlPlaneRuntimeSnapshot> {
  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();
    const { data: auth, error: aerr } = await sb.auth.getUser();
    if (aerr || !auth?.user) return { ok: false, message: "Ikke innlogget." };
    if (!(await isSuperadminProfile(auth.user.id))) return { ok: false, message: "Kun superadmin." };

    if (!hasSupabaseAdminConfig()) {
      return { ok: false, message: "Admin-konfigurasjon mangler (service role)." };
    }

    const admin = supabaseAdmin();

    const { data: companies, error: cErr } = await admin.from("companies").select("status");
    if (cErr) return { ok: false, message: cErr.message };

    let total = 0;
    let active = 0;
    let pending = 0;
    let paused = 0;
    let closed = 0;
    for (const row of companies ?? []) {
      total += 1;
      const st = String((row as { status?: string }).status ?? "").toLowerCase();
      if (st === "pending") pending += 1;
      else if (st === "active") active += 1;
      else if (st === "paused") paused += 1;
      else if (st === "closed") closed += 1;
    }

    const { count: locCount, error: lErr } = await admin
      .from("company_locations")
      .select("id", { count: "exact", head: true });
    if (lErr) return { ok: false, message: lErr.message };

    const { count: agrCount, error: agrErr } = await admin
      .from("company_current_agreement")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE");
    if (agrErr) return { ok: false, message: agrErr.message };

    return {
      ok: true,
      companies: { total, active, pending, paused, closed },
      locations: locCount ?? 0,
      activeAgreements: agrCount ?? 0,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Ukjent feil." };
  }
}
