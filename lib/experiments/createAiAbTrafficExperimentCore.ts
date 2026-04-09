import "server-only";

import { parseBody } from "@/lib/cms/public/parseBody";
import { opsLog } from "@/lib/ops/log";
import { trackUsage } from "@/lib/saas/billingTracker";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type CreateAiAbExperimentCoreResult =
  | { ok: true; experimentId: string; variantIds: ["A", "B"] }
  | { ok: false; code: string; message: string };

function blocksEqual(a: unknown[], b: unknown[]): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Running traffic A/B: variant A = current prod block list, B = proposed (e.g. AI) blocks.
 * 50/50 via equal weights on A and B.
 */
export async function createAiAbTrafficExperimentCore(opts: {
  rid: string;
  source: string;
  pageId: string;
  blocksB: unknown[];
}): Promise<CreateAiAbExperimentCoreResult> {
  const pageId = String(opts.pageId ?? "").trim();
  if (!pageId) {
    return { ok: false, code: "VALIDATION", message: "pageId er påkrevd." };
  }

  const blocksB = Array.isArray(opts.blocksB) ? opts.blocksB : [];
  if (blocksB.length === 0) {
    return { ok: false, code: "BLOCKS_B_EMPTY", message: "Variant B må inneholde minst én blokk." };
  }

  const supabase = supabaseAdmin();

  const { data: page, error: pErr } = await supabase
    .from("content_pages")
    .select("id,status,slug")
    .eq("id", pageId)
    .maybeSingle();
  if (pErr) return { ok: false, code: "DB_ERROR", message: pErr.message };
  if (!page?.id) return { ok: false, code: "NOT_FOUND", message: "Fant ikke siden." };
  if (String((page as { status?: string }).status) !== "published") {
    return {
      ok: false,
      code: "NOT_PUBLISHED",
      message: "Siden må være publisert før A/B-trafikk kan startes.",
    };
  }

  const { data: running } = await supabase
    .from("experiments")
    .select("id")
    .eq("content_id", pageId)
    .eq("status", "running")
    .maybeSingle();
  if (running?.id) {
    return { ok: false, code: "EXPERIMENT_RUNNING", message: "Det kjører allerede et aktivt eksperiment for denne siden." };
  }

  const { data: prodVar, error: pvErr } = await supabase
    .from("content_page_variants")
    .select("body")
    .eq("page_id", pageId)
    .eq("locale", "nb")
    .eq("environment", "prod")
    .maybeSingle();
  if (pvErr) return { ok: false, code: "DB_ERROR", message: pvErr.message };
  if (prodVar?.body == null) {
    return { ok: false, code: "NOT_FOUND", message: "Fant ikke produksjonsvariant (nb/prod) for siden." };
  }

  const blocksA = parseBody((prodVar as { body: unknown }).body);
  if (blocksEqual(blocksA as unknown[], blocksB)) {
    return {
      ok: false,
      code: "NO_DIFF",
      message: "Variant B er identisk med produksjon (A). Juster innhold før du starter A/B.",
    };
  }

  let expInsert = await supabase
    .from("experiments")
    .insert({ content_id: pageId, status: "running", page_id: pageId })
    .select("id")
    .single();
  if (expInsert.error) {
    const msg = expInsert.error.message ?? "";
    const missingCol = msg.includes("page_id") || expInsert.error.code === "42703";
    if (missingCol) {
      expInsert = await supabase.from("experiments").insert({ content_id: pageId, status: "running" }).select("id").single();
    }
  }
  if (expInsert.error || !expInsert.data?.id) {
    return { ok: false, code: "DB_ERROR", message: expInsert.error?.message ?? "Kunne ikke opprette eksperiment." };
  }

  const experimentId = String((expInsert.data as { id: string }).id);

  const { error: vErr } = await supabase.from("experiment_variants").insert([
    {
      experiment_id: experimentId,
      variant_id: "A",
      name: "Produksjon",
      blocks: blocksA,
      weight: 1,
    },
    {
      experiment_id: experimentId,
      variant_id: "B",
      name: "AI / utkast",
      blocks: blocksB,
      weight: 1,
    },
  ]);
  if (vErr) {
    await supabase.from("experiments").delete().eq("id", experimentId);
    return { ok: false, code: "DB_ERROR", message: vErr.message };
  }

  opsLog("experiment.created.ai_ab", {
    rid: opts.rid,
    source: opts.source,
    experimentId,
    pageId,
    slug: (page as { slug?: string }).slug,
    variants: ["A", "B"],
  });
  trackUsage({
    kind: "experiment_created",
    rid: opts.rid,
    source: opts.source,
    experimentId,
    variantCount: 2,
  });

  return { ok: true, experimentId, variantIds: ["A", "B"] };
}
