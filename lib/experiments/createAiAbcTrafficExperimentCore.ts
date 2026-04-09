import "server-only";

import { parseBody } from "@/lib/cms/public/parseBody";
import { explorationBandFromPageViews7d, getExplorationWeights } from "@/lib/moo/exploration";
import { countPageViewsLastDays } from "@/lib/moo/pageTraffic";
import { opsLog } from "@/lib/ops/log";
import { trackUsage } from "@/lib/saas/billingTracker";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type CreateAiAbcExperimentCoreResult =
  | { ok: true; experimentId: string; variantIds: ["A", "B", "C"] }
  | { ok: false; code: string; message: string };

function blocksEqual(a: unknown[], b: unknown[]): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function trafficWeightsToIntegers(w: { wA: number; wB: number; wC: number }): { wA: number; wB: number; wC: number } {
  const scale = 100;
  return {
    wA: Math.max(1, Math.round(w.wA * scale)),
    wB: Math.max(1, Math.round(w.wB * scale)),
    wC: Math.max(1, Math.round(w.wC * scale)),
  };
}

/**
 * Running traffic A/B/C: A = prod; B and C = distinct AI angles.
 * Adaptive exploration: lav sidetrafikk → mer B+C; høy trafikk → mer baseline A (deterministiske vekter).
 */
export async function createAiAbcTrafficExperimentCore(opts: {
  rid: string;
  source: string;
  pageId: string;
  blocksB: unknown[];
  blocksC: unknown[];
}): Promise<CreateAiAbcExperimentCoreResult> {
  const pageId = String(opts.pageId ?? "").trim();
  if (!pageId) {
    return { ok: false, code: "VALIDATION", message: "pageId er påkrevd." };
  }

  const blocksB = Array.isArray(opts.blocksB) ? opts.blocksB : [];
  const blocksC = Array.isArray(opts.blocksC) ? opts.blocksC : [];
  if (blocksB.length === 0 || blocksC.length === 0) {
    return { ok: false, code: "BLOCKS_EMPTY", message: "Variant B og C må begge ha minst én blokk." };
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
      message: "Siden må være publisert før A/B/C-trafikk kan startes.",
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
  if (blocksEqual(blocksA as unknown[], blocksB) || blocksEqual(blocksA as unknown[], blocksC)) {
    return {
      ok: false,
      code: "NO_DIFF",
      message: "B eller C er identisk med produksjon (A). Juster innhold.",
    };
  }
  if (blocksEqual(blocksB, blocksC)) {
    return { ok: false, code: "NO_DIFF_BC", message: "Variant B og C må være forskjellige." };
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

  const pageViews7d = await countPageViewsLastDays(supabase, pageId, 7);
  const explorationBand = explorationBandFromPageViews7d(pageViews7d);
  const wFloat = getExplorationWeights(explorationBand);
  const wInt = trafficWeightsToIntegers(wFloat);

  const { error: vErr } = await supabase.from("experiment_variants").insert([
    {
      experiment_id: experimentId,
      variant_id: "A",
      name: "Produksjon (baseline)",
      blocks: blocksA,
      weight: wInt.wA,
    },
    {
      experiment_id: experimentId,
      variant_id: "B",
      name: "Trygg forbedring",
      blocks: blocksB,
      weight: wInt.wB,
    },
    {
      experiment_id: experimentId,
      variant_id: "C",
      name: "Aggressiv CTA",
      blocks: blocksC,
      weight: wInt.wC,
    },
  ]);
  if (vErr) {
    await supabase.from("experiments").delete().eq("id", experimentId);
    return { ok: false, code: "DB_ERROR", message: vErr.message };
  }

  opsLog("experiment.created.ai_abc", {
    rid: opts.rid,
    source: opts.source,
    experimentId,
    pageId,
    slug: (page as { slug?: string }).slug,
    variants: ["A", "B", "C"],
    pageViews7d,
    explorationBand,
    weights: wInt,
  });
  trackUsage({
    kind: "experiment_created",
    rid: opts.rid,
    source: opts.source,
    experimentId,
    variantCount: 3,
  });

  return { ok: true, experimentId, variantIds: ["A", "B", "C"] };
}
