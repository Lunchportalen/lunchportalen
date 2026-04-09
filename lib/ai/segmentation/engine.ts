import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

export type CustomerSegmentKind = "high_value" | "at_risk" | "low_engagement" | "high_growth_potential";

export type CompanySegmentRow = {
  companyId: string;
  companyName: string;
  segment: CustomerSegmentKind;
  activeProfiles: number;
  score: number;
  reason: string;
};

/**
 * Rule-based segmentation from profile counts — explainable; no auto actions.
 */
export async function segmentCustomers(rid: string): Promise<CompanySegmentRow[]> {
  const sb = supabaseAdmin();
  try {
    const [{ data: companies, error: cErr }, { data: profiles, error: pErr }] = await Promise.all([
      sb.from("companies").select("id,name").limit(80),
      sb.from("profiles").select("id,company_id").limit(5000),
    ]);
    if (cErr || pErr) {
      opsLog("segmentation.engine.query_error", {
        rid,
        c: cErr?.message,
        p: pErr?.message,
      });
      return [];
    }

    const byCompany = new Map<string, { active: number; total: number }>();
    for (const row of profiles ?? []) {
      const r = row as { company_id?: string | null };
      const cid = r.company_id ? String(r.company_id) : "";
      if (!cid) continue;
      const cur = byCompany.get(cid) ?? { active: 0, total: 0 };
      cur.total += 1;
      cur.active += 1;
      byCompany.set(cid, cur);
    }

    const out: CompanySegmentRow[] = [];
    for (const c of companies ?? []) {
      const row = c as { id?: string; name?: string | null };
      const id = String(row.id ?? "").trim();
      if (!id) continue;
      const name = String(row.name ?? "Selskap").trim() || "Selskap";
      const counts = byCompany.get(id) ?? { active: 0, total: 0 };
      const a = counts.active;

      let segment: CustomerSegmentKind;
      let score: number;
      let reason: string;

      if (a >= 12) {
        segment = "high_value";
        score = 0.85;
        reason = `Høy aktiv brukerbase (${a} aktive profiler) — prioritert suksess og utvidelse.`;
      } else if (a <= 2 && counts.total > 0) {
        segment = "at_risk";
        score = 0.78;
        reason = `Få aktive brukere (${a}) — risiko for lav verdiuttak og churn.`;
      } else if (a === 0) {
        segment = "low_engagement";
        score = 0.72;
        reason = "Ingen aktive profiler knyttet — onboarding eller datakvalitet bør sjekkes.";
      } else {
        segment = "high_growth_potential";
        score = 0.65;
        reason = `Moderat base (${a}) — rom for vekst gjennom aktivering og innhold.`;
      }

      out.push({ companyId: id, companyName: name, segment, activeProfiles: a, score, reason });
    }

    out.sort((x, y) => y.score - x.score);
    return out;
  } catch (e) {
    opsLog("segmentation.engine.failed", { rid, message: e instanceof Error ? e.message : String(e) });
    return [];
  }
}
