import "server-only";

import { parseBody } from "@/lib/cms/public/parseBody";
import { toPageBodyFromBlocks } from "@/lib/experiments/rollout";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Post-apply check: prod `content_page_variants` body matches winner blocks (same pipeline as apply).
 */
export async function validateWinnerAppliedToProd(opts: {
  experimentId: string;
  pageId: string;
  winnerVariantId: string;
}): Promise<{ ok: boolean; detail?: string }> {
  const eid = String(opts.experimentId ?? "").trim();
  const pageId = String(opts.pageId ?? "").trim();
  const wid = String(opts.winnerVariantId ?? "").trim();
  if (!eid || !pageId || !wid) {
    return { ok: false, detail: "missing_ids" };
  }

  const supabase = supabaseAdmin();

  const { data: vRow, error: vErr } = await supabase
    .from("experiment_variants")
    .select("blocks")
    .eq("experiment_id", eid)
    .eq("variant_id", wid)
    .maybeSingle();
  if (vErr || !vRow) {
    return { ok: false, detail: vErr?.message ?? "winner_variant_missing" };
  }

  const expected = toPageBodyFromBlocks((vRow as { blocks: unknown }).blocks);

  const { data: prod, error: pErr } = await supabase
    .from("content_page_variants")
    .select("body")
    .eq("page_id", pageId)
    .eq("locale", "nb")
    .eq("environment", "prod")
    .maybeSingle();
  if (pErr) {
    return { ok: false, detail: pErr.message };
  }
  if (prod?.body == null) {
    return { ok: false, detail: "prod_variant_missing" };
  }

  try {
    const expectedBlocks = parseBody(expected);
    const prodBlocks = parseBody(prod.body);
    if (JSON.stringify(expectedBlocks) === JSON.stringify(prodBlocks)) {
      return { ok: true };
    }
    return { ok: false, detail: "blocks_mismatch" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "stringify_failed" };
  }
}
