import "server-only";

import { createHash } from "crypto";

import { verifyTable } from "@/lib/db/verifyTable";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AbVariantRow = {
  id: string;
  experiment_id: string;
  social_post_id: string;
  label: string | null;
};

function hash32(input: string): number {
  const h = createHash("sha256").update(input).digest();
  return h.readUInt32BE(0);
}

/**
 * Deterministisk variant gitt eksperiment + inngangspost (samme input ⇒ samme variant).
 */
export function pickDeterministicVariant(experimentId: string, entryPostId: string, variants: AbVariantRow[]): AbVariantRow | null {
  if (!variants.length) return null;
  if (variants.length === 1) return variants[0] ?? null;
  const idx = hash32(`${experimentId}:${entryPostId}`) % variants.length;
  return variants[idx] ?? null;
}

/**
 * Laster første aktive eksperiment med minst én variant (sortert på label, id for stabilitet).
 */
export async function loadActiveExperimentVariants(
  admin: SupabaseClient,
  route: string,
): Promise<{ experimentId: string; experimentName: string | null; variants: AbVariantRow[] } | null> {
  const expOk = await verifyTable(admin, "ab_experiments", route);
  const varOk = await verifyTable(admin, "ab_variants", route);
  if (!expOk || !varOk) return null;

  const { data: ex, error: eErr } = await admin.from("ab_experiments").select("id, name").eq("status", "active").order("created_at", { ascending: true }).limit(1).maybeSingle();

  if (eErr || !ex || typeof ex !== "object") return null;
  const experimentId = String((ex as Record<string, unknown>).id ?? "");
  if (!experimentId) return null;
  const experimentName =
    typeof (ex as Record<string, unknown>).name === "string" ? String((ex as Record<string, unknown>).name) : null;

  const { data: vars, error: vErr } = await admin
    .from("ab_variants")
    .select("id, experiment_id, social_post_id, label")
    .eq("experiment_id", experimentId)
    .order("label", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (vErr || !Array.isArray(vars) || vars.length === 0) return null;

  const variants: AbVariantRow[] = [];
  for (const r of vars) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const eid = typeof o.experiment_id === "string" ? o.experiment_id : "";
    const sp = typeof o.social_post_id === "string" ? o.social_post_id : "";
    if (!id || !eid || !sp) continue;
    variants.push({
      id,
      experiment_id: eid,
      social_post_id: sp,
      label: typeof o.label === "string" ? o.label : null,
    });
  }

  if (variants.length === 0) return null;
  return { experimentId, experimentName, variants };
}
