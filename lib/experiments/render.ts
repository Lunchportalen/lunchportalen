// STATUS: KEEP

import "server-only";

import { assignVariant } from "@/lib/experiments/assign";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Optional hook for pages: resolve running experiment assignment + blocks (read-only).
 * Does not modify CMS; caller merges `blocks` into their render pipeline.
 */
export async function getAssignedVariantForRender(
  experimentId: string,
  userId: string,
): Promise<{ variantId: string; blocks: unknown } | null> {
  const eid = String(experimentId ?? "").trim();
  const uid = String(userId ?? "").trim();
  if (!eid || !uid) return null;

  const supabase = supabaseAdmin();

  try {
    const { data: exp, error: e1 } = await supabase.from("experiments").select("id,status").eq("id", eid).maybeSingle();
    if (e1 || !exp || (exp as { status: string }).status !== "running") return null;

    const { data: rows, error: e2 } = await supabase
      .from("experiment_variants")
      .select("variant_id,weight,blocks")
      .eq("experiment_id", eid);
    if (e2 || !rows?.length) return null;

    const weights = (rows as { variant_id: string; weight: number }[]).map((r) => ({
      variantId: r.variant_id,
      weight: r.weight,
    }));
    const { variantId } = assignVariant(eid, uid, weights);
    const row = (rows as { variant_id: string; blocks: unknown }[]).find((r) => r.variant_id === variantId);
    return { variantId, blocks: row?.blocks ?? [] };
  } catch {
    return null;
  }
}
