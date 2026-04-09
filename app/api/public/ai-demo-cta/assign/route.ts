import { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  catalogKeysInOrder,
  defaultDemoCtaSeedCatalog,
  parseDemoCtaVariantCatalog,
  resolveCatalogLabelForPatternContext,
} from "@/lib/public/demoCtaAb/catalog";
import { DEMO_CTA_AB_EXPERIMENT_KEY, DEMO_CTA_AB_WEIGHT_FLOOR } from "@/lib/public/demoCtaAb/config";
import {
  demoCtaPatternContextKey,
  type DemoPatternIntent,
} from "@/lib/public/demoCtaAb/patternContext";
import type { DemoDeviceSegment, DemoSourceSegment } from "@/lib/public/demoCtaAb/contextSegments";
import {
  alignWeightsToCatalogKeys,
  clampDemoCtaWeightsForKeys,
  normalizeDemoCtaWeightsForKeys,
  pickDemoCtaVariant,
  winningDemoCtaVariant,
} from "@/lib/public/demoCtaAb/weights";
import {
  applyExplorationToPrior,
  mixGlobalWithContextLearned,
  resolveDemoAbExplorationEpsilon,
} from "@/lib/server/demoCtaAb/blendAssignment";
import {
  classifyDeviceFromUserAgent,
  classifyIntentFromSignals,
  classifySourceFromSignals,
} from "@/lib/server/demoCtaAb/classifyContext";
import { runDemoCtaAbRebalancePipeline } from "@/lib/server/demoCtaAb/rebalance";

const RATE_PER_MINUTE = 120;
const rateMap = new Map<string, number>();

function minuteBucket(): number {
  return Math.floor(Date.now() / 60_000);
}

/** Public demo CTA A/B — single assign surface; client must use lib/public/demoCtaAb/canonicalPublicCtaAb. */

type AssignBody = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
};

export async function POST(request: NextRequest) {
  const rid = makeRid("dab");
  try {
    const env: "prod" | "staging" =
      typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging"
        ? "staging"
        : "prod";

    const fwd = request.headers.get("x-forwarded-for");
    const ip = (fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 64);
    const rk = `dab:${ip}:${minuteBucket()}`;
    const n = (rateMap.get(rk) ?? 0) + 1;
    rateMap.set(rk, n);
    if (n > RATE_PER_MINUTE) {
      return jsonErr(rid, "For mange forsøk", 429, "RATE_LIMIT_EXCEEDED");
    }

    let body: AssignBody = {};
    try {
      const raw = await request.json().catch(() => null);
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const o = raw as Record<string, unknown>;
        body = {
          utmSource: typeof o.utmSource === "string" ? o.utmSource : undefined,
          utmMedium: typeof o.utmMedium === "string" ? o.utmMedium : undefined,
          referrer: typeof o.referrer === "string" ? o.referrer : undefined,
        };
      }
    } catch {
      body = {};
    }

    const ua = request.headers.get("user-agent");
    const device_seg = classifyDeviceFromUserAgent(ua) as DemoDeviceSegment;
    const source_seg = classifySourceFromSignals({
      utm_source: body.utmSource,
      utm_medium: body.utmMedium,
      referrer: body.referrer,
    }) as DemoSourceSegment;
    const intent_seg = classifyIntentFromSignals({
      source_seg,
      utm_source: body.utmSource,
      utm_medium: body.utmMedium,
      utm_campaign: body.utmCampaign,
      referrer: body.referrer,
    });

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();

    const seedCatalog = defaultDemoCtaSeedCatalog();

    const { data: globalRow, error: globalReadErr } = await supabase
      .from("ai_demo_cta_ab_state")
      .select("weights,variant_catalog")
      .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY)
      .maybeSingle();

    if (globalReadErr) {
      return jsonErr(rid, globalReadErr.message, 500, "READ_FAILED");
    }

    const nowIso = new Date().toISOString();

    if (!globalRow) {
      const initialW = clampDemoCtaWeightsForKeys(
        normalizeDemoCtaWeightsForKeys({ a: 0.5, b: 0.5 }, catalogKeysInOrder(seedCatalog)),
        catalogKeysInOrder(seedCatalog),
        DEMO_CTA_AB_WEIGHT_FLOOR,
      );
      const up = await supabase.from("ai_demo_cta_ab_state").upsert(
        {
          experiment_key: DEMO_CTA_AB_EXPERIMENT_KEY,
          weights: initialW,
          variant_catalog: seedCatalog,
          last_rebalanced_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "experiment_key" },
      );
      if (up.error) {
        return jsonErr(rid, up.error.message, 500, "SEED_FAILED");
      }
    } else if (!parseDemoCtaVariantCatalog(globalRow.variant_catalog)) {
      await supabase
        .from("ai_demo_cta_ab_state")
        .update({ variant_catalog: seedCatalog, updated_at: nowIso })
        .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY);
    }

    const { data: globalRowFresh } = await supabase
      .from("ai_demo_cta_ab_state")
      .select("weights,variant_catalog,exploration_rate")
      .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY)
      .maybeSingle();

    const catalogResolved = parseDemoCtaVariantCatalog(globalRowFresh?.variant_catalog) ?? seedCatalog;
    const keysResolved = catalogKeysInOrder(catalogResolved);
    const globalW = clampDemoCtaWeightsForKeys(
      normalizeDemoCtaWeightsForKeys(globalRowFresh?.weights, keysResolved),
      keysResolved,
      DEMO_CTA_AB_WEIGHT_FLOOR,
    );

    const { data: ctxRow } = await supabase
      .from("ai_demo_ab_context_state")
      .select("weights,impressions_total")
      .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY)
      .eq("device_seg", device_seg)
      .eq("source_seg", source_seg)
      .eq("intent_seg", intent_seg)
      .maybeSingle();

    if (!ctxRow) {
      const win = winningDemoCtaVariant(globalW, keysResolved);
      await supabase.from("ai_demo_ab_context_state").upsert(
        {
          experiment_key: DEMO_CTA_AB_EXPERIMENT_KEY,
          device_seg,
          source_seg,
          intent_seg,
          weights: globalW,
          winning_variant: win,
          impressions_total: 0,
          last_rebalanced_at: nowIso,
          updated_at: nowIso,
        },
        {
          onConflict: "experiment_key,device_seg,source_seg,intent_seg",
          ignoreDuplicates: true,
        },
      );
    }

    const { data: ctxRow2 } = await supabase
      .from("ai_demo_ab_context_state")
      .select("weights,impressions_total")
      .eq("experiment_key", DEMO_CTA_AB_EXPERIMENT_KEY)
      .eq("device_seg", device_seg)
      .eq("source_seg", source_seg)
      .eq("intent_seg", intent_seg)
      .maybeSingle();

    const contextLearned = ctxRow2?.weights
      ? clampDemoCtaWeightsForKeys(
          alignWeightsToCatalogKeys(ctxRow2.weights, catalogResolved, globalW),
          keysResolved,
          DEMO_CTA_AB_WEIGHT_FLOOR,
        )
      : null;
    const contextImp = typeof ctxRow2?.impressions_total === "number" ? Math.max(0, ctxRow2.impressions_total) : 0;
    const dominant = contextLearned ? Math.max(...keysResolved.map((k) => contextLearned[k] ?? 0)) : 0.5;

    const prior = mixGlobalWithContextLearned(globalW, contextLearned, contextImp, keysResolved);
    const storedEps =
      globalRowFresh &&
      typeof (globalRowFresh as { exploration_rate?: unknown }).exploration_rate === "number" &&
      Number.isFinite((globalRowFresh as { exploration_rate: number }).exploration_rate)
        ? (globalRowFresh as { exploration_rate: number }).exploration_rate
        : null;
    const eps = resolveDemoAbExplorationEpsilon({
      contextImp,
      dominantWeight: dominant,
      storedRate: storedEps,
    });
    const finalWeights = applyExplorationToPrior(prior, eps, keysResolved);
    const variantKey = pickDemoCtaVariant(finalWeights, keysResolved);
    const patternCtx = demoCtaPatternContextKey({
      device_seg,
      intent_seg: intent_seg as DemoPatternIntent,
    });
    const label = resolveCatalogLabelForPatternContext(
      catalogResolved[variantKey],
      patternCtx,
      catalogResolved.a?.label ?? "Prøv med dine egne tall",
    );

    void runDemoCtaAbRebalancePipeline(supabase, env).catch(() => {});

    try {
      const { onEvent } = await import("@/lib/pos/eventHandler");
      onEvent({
        type: "variant_performance_updated",
        experiment_id: DEMO_CTA_AB_EXPERIMENT_KEY,
        variant_id: variantKey,
        experiment_event_type: "view",
      });
    } catch {
      /* POS etter vellykket assign — skal ikke påvirke svar */
    }

    return jsonOk(
      rid,
      {
        experimentKey: DEMO_CTA_AB_EXPERIMENT_KEY,
        variantKey,
        label,
        deviceSeg: device_seg,
        sourceSeg: source_seg,
        intentSeg: intent_seg,
        contextKey: `${device_seg}|${source_seg}|${intent_seg}`,
      },
      200,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return jsonErr(rid, message, 500, "SERVER_ERROR");
  }
}
