"use server";

import { logAiExecution } from "@/lib/ai/logging/aiExecutionLog";
import { createAuditEvent, logAudit } from "@/lib/audit/logger";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import {
  ensure21DayCalendar,
  parseCalendar,
  rollingDayKeys,
  serializeCalendar,
  type CalendarPost,
} from "@/lib/social/calendar";
import { learnFromCalendarPosts } from "@/lib/social/calendarLearning";
import { generatePost } from "@/lib/social/generator";
import { engagementTierFromPosts, learnFromPerformance } from "@/lib/social/learning";
import { enrichCalendarPostsWithMedia } from "@/lib/social/mediaAdapter";
import type { PostPerformancePatch } from "@/lib/social/performance";
import { trackPostPerformance } from "@/lib/social/performance";
import { runSchedulerWithLearning } from "@/lib/social/scheduler";
import { evaluateAdCampaignEconomicsGate } from "@/lib/product/adCampaignEconomicsGate";
import { pickBestProductForGrowth } from "@/lib/social/selection";
import { SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS } from "@/lib/social/superadminEngineSeed";
import { defaultSocialLocation } from "@/lib/social/location";
import { runAutonomousCycle } from "@/lib/social/automationEngine";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { generateVideo } from "@/lib/video/generator";
import {
  canonicalCampaignForApproval,
  canonicalRoasBudgetPayloadHash,
  issueAdApprovalProof,
  issueRoasBudgetChangeProof,
  verifyAdApprovalProof,
  verifyRoasBudgetChangeProof,
} from "@/lib/ads/approval";
import { computeNextBudgetWithGuardrails } from "@/lib/ads/execution";
import { assertRoasBudgetChangeAllowed, recordRoasBudgetChange } from "@/lib/ads/rateLimit";
import { evaluateProfitFirstAll, type CampaignProfitInput } from "@/lib/ads/profitExecution";
import { runPortfolioPlanner, type PortfolioPlannerInput } from "@/lib/ads/portfolioPlanner";
import { summarizeClosedLoopEngine, type CampaignSpendBinding } from "@/lib/revenue/engineView";
import { buildRevenueEventsFromCalendarPosts } from "@/lib/revenue/pipeline";
import {
  buildCampaign,
  type BuiltAdCampaign,
  type ProductForAdCampaign,
  type VideoForAdCampaign,
} from "@/lib/ads/campaign";
import { publishCampaign } from "@/lib/ads/publish";
import type { AutonomyAggressiveness, Decision } from "@/lib/social/decisionEngine";
import { revertDecision } from "@/lib/social/revert";
import { logDecisionReverted } from "@/lib/social/observability";

async function requireSuperadmin() {
  const auth = await getAuthContext();
  if (!auth.ok || auth.role !== "superadmin") {
    return { ok: false as const, error: "Ingen tilgang" as const };
  }
  return { ok: true as const, auth };
}

function logSocial(capability: string, userId: string | null, metadata: Record<string, unknown>) {
  void logAiExecution({
    capability,
    resultStatus: "success",
    userId,
    metadata: { domain: "social_engine", ...metadata },
  });
}

function logAdsEvent(
  capability: string,
  userId: string | null,
  metadata: Record<string, unknown>,
  ok: boolean,
) {
  void logAiExecution({
    capability,
    resultStatus: ok ? "success" : "failure",
    userId,
    metadata: { domain: "ads_engine", ...metadata },
  });
}

function logProcurementEvent(
  capability: string,
  userId: string | null,
  metadata: Record<string, unknown>,
  ok: boolean,
) {
  void logAiExecution({
    capability,
    resultStatus: ok ? "success" : "failure",
    userId,
    metadata: { domain: "procurement", ...metadata },
  });
}

function logPricingStrategyEvent(
  capability: string,
  userId: string | null,
  metadata: Record<string, unknown>,
  ok: boolean,
) {
  void logAiExecution({
    capability,
    resultStatus: ok ? "success" : "failure",
    userId,
    metadata: { domain: "pricing_strategy", ...metadata },
  });
}

function pickPostIdForProductTracking(posts: CalendarPost[], productId: string) {
  const list = posts.filter((p) => p.productId === productId && p.status !== "cancelled");
  const pub = list.find((p) => p.status === "published");
  return pub?.id ?? list[0]?.id ?? null;
}

export async function socialEngineFillCalendarAction(postsJson: string) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const existing = parseCalendar(postsJson || "[]");
  const insights = learnFromCalendarPosts(existing);
  let next = ensure21DayCalendar(
    SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS,
    existing,
    insights,
    defaultSocialLocation,
  );
  next = await enrichCalendarPostsWithMedia(next);
  const suggested = pickBestProductForGrowth(SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS, existing);
  const withImage = next.filter((p) => p.socialMedia?.imageUrl).length;
  logSocial("social_engine_calendar_fill", gate.auth.userId, {
    before: existing.length,
    after: next.length,
    postsWithCmsImage: withImage,
    suggestedProductId: suggested?.id ?? null,
  });
  return { ok: true as const, postsJson: serializeCalendar(next), totalPosts: next.length };
}

export async function socialEngineSchedulerAction(postsJson: string) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const posts = parseCalendar(postsJson || "[]");
  const insights = learnFromCalendarPosts(posts);
  const { posts: next, promotedCount, wouldPublish } = runSchedulerWithLearning(posts, Date.now(), insights);
  logSocial("social_engine_scheduler", gate.auth.userId, {
    promotedCount,
    wouldPublish,
    timeInsight: insights.bestTimeSlots[0] ?? null,
  });
  return { ok: true as const, postsJson: serializeCalendar(next), promotedCount, wouldPublish };
}

export async function socialEngineGenerateDraftAction(postsJson?: string) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const history = parseCalendar(postsJson || "[]");
  const tier = engagementTierFromPosts(history);
  const product = pickBestProductForGrowth(SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS, history);
  if (!product) {
    return {
      ok: false as const,
      error: "Ingen demo-produkt oppfyller margin- og lagerkrav for trygg generering (profit-first).",
    };
  }

  const slotDay = rollingDayKeys()[0] ?? "";
  const matchPost = history.find((x) => x.productId === product.id && x.status !== "cancelled") ?? null;
  const draft = await generatePost(product, {
    slotDay,
    location: defaultSocialLocation,
    learningEngagementTier: tier,
    calendarPostId: matchPost?.id,
  });
  logSocial("social_engine_generate", gate.auth.userId, {
    productId: product.id,
    slotDay,
    hookLen: draft.hook.length,
    mediaItemId: draft.media.mediaItemId,
    mediaSource: draft.media.source ?? null,
    tier,
  });
  return { ok: true as const, draft };
}

export async function socialEngineGenerateVideoAction(postsJson?: string) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const history = parseCalendar(postsJson || "[]");
  const product = pickBestProductForGrowth(SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS, history);
  if (!product) {
    return {
      ok: false as const,
      error: "Ingen demo-produkt oppfyller margin- og lagerkrav for trygg videogenerering (profit-first).",
    };
  }

  const slotDay = rollingDayKeys()[0] ?? "";
  const bundle = await generateVideo(product, { calendarPosts: history, slotDay });

  logSocial("social_engine_video_generate", gate.auth.userId, {
    productId: product.id,
    slotDay,
    hookCount: bundle.hooks.length,
    totalDurationSec: bundle.totalDurationSec,
    missingImages: bundle.missingAssets.images,
    missingVideos: bundle.missingAssets.videos,
    mediaImageCount: bundle.media.images.length,
    mediaVideoCount: bundle.media.videos.length,
    videoProvider: bundle.providerStatus.name,
    videoProviderUsed: bundle.providerStatus.used,
    voiceId: bundle.voice.voice,
    captionBeats: bundle.captions.length,
    previewUrl: bundle.previewUrl != null,
    videoUrl: bundle.videoUrl != null,
    localRenderEngine: bundle.localRender.engine,
    previewFrameCount: bundle.previewFrames.length,
    conversionVideoId: bundle.conversionVideoId,
    selectedHookStrength: bundle.conversion.selectedHookStrength,
    selectedHookType: bundle.conversion.selectedHookType,
    videoDropOffDiagnosis: bundle.conversion.dropOffDiagnosis,
    abVariantCount: bundle.conversion.abVariants.length,
  });

  const { composed, conversion, ...rest } = bundle;
  void composed;
  return {
    ok: true as const,
    productId: product.id,
    productName: product.name,
    ...rest,
    conversion: {
      ...conversion,
      abVariants: conversion.abVariants.map((v) => ({ id: v.id, hook: v.hook })),
    },
  };
}

export async function socialEngineBuildAdCampaignAction(
  postsJson: string,
  input: {
    productId: string;
    productName: string;
    videoUrl: string | null;
    previewUrl: string | null;
    hook: string;
    cta?: string;
    conversionVideoId?: string;
  },
) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const posts = parseCalendar(postsJson || "[]");
  const catalogHit = SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS.find((p) => p.id === input.productId.trim());
  const econGate = evaluateAdCampaignEconomicsGate(catalogHit);
  if (econGate.ok === false) {
    logAdsEvent(
      "ads_campaign_build",
      gate.auth.userId,
      { productId: input.productId, blocked: econGate.reason },
      false,
    );
    const error =
      econGate.reason === "low_margin"
        ? "Annonseutkast blokkert: produktmargin under minimum (profit-first)."
        : "Annonseutkast blokkert: tomt lager.";
    return { ok: false as const, error };
  }

  const video: VideoForAdCampaign = {
    videoUrl: input.videoUrl,
    previewUrl: input.previewUrl,
    script: { hook: input.hook, cta: input.cta },
    conversionVideoId: input.conversionVideoId,
  };
  const product: ProductForAdCampaign = { id: input.productId, name: input.productName };
  const built = buildCampaign(video, product);
  const postId = pickPostIdForProductTracking(posts, product.id);
  const campaign: BuiltAdCampaign = { ...built, postId };

  logAdsEvent(
    "ads_campaign_build",
    gate.auth.userId,
    {
      campaignName: campaign.name,
      productId: campaign.productId,
      postId,
      conversionVideoId: campaign.conversionVideoId,
      hasCreative: Boolean(campaign.creative),
      economicsLowStock: econGate.lowStockPriorityReduction,
      economicsInventory: econGate.inventoryLevel,
    },
    true,
  );

  return {
    ok: true as const,
    campaign,
    economicsHint: {
      lowStockPriorityReduction: econGate.lowStockPriorityReduction,
      inventoryLevel: econGate.inventoryLevel,
      marginPct: econGate.marginPct,
    },
  };
}

export async function socialEngineApproveAdCampaignAction(campaign: BuiltAdCampaign, budget: number) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const digest = canonicalCampaignForApproval({
    name: campaign.name,
    creative: campaign.creative,
    text: campaign.text,
    cta: campaign.cta,
    productId: campaign.productId,
    conversionVideoId: campaign.conversionVideoId,
    postId: campaign.postId,
  });

  const actor = gate.auth.user?.id ?? gate.auth.email ?? gate.auth.userId ?? "";
  const issued = issueAdApprovalProof(actor, digest, budget);
  if ("error" in issued) {
    logAdsEvent(
      "ads_campaign_approve",
      gate.auth.userId,
      { campaignName: campaign.name, err: issued.error },
      false,
    );
    return { ok: false as const, error: issued.error };
  }

  logAdsEvent(
    "ads_campaign_approve",
    gate.auth.userId,
    {
      campaignName: campaign.name,
      productId: campaign.productId,
      budget,
      expiresAt: issued.expiresAt,
    },
    true,
  );

  return { ok: true as const, proof: issued.proof, expiresAt: issued.expiresAt };
}

export async function socialEnginePublishAdCampaignAction(
  campaign: BuiltAdCampaign,
  budget: number,
  approvalProof: string,
) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const uid = gate.auth.user?.id ?? gate.auth.email ?? gate.auth.userId ?? "";
  const digest = canonicalCampaignForApproval({
    name: campaign.name,
    creative: campaign.creative,
    text: campaign.text,
    cta: campaign.cta,
    productId: campaign.productId,
    conversionVideoId: campaign.conversionVideoId,
    postId: campaign.postId,
  });

  const verified = verifyAdApprovalProof(uid, digest, budget, approvalProof);
  if (!verified) {
    logAdsEvent(
      "ads_campaign_publish",
      gate.auth.userId,
      { campaignName: campaign.name, reason: "invalid_or_expired_approval" },
      false,
    );
    return {
      ok: false as const,
      error: "Ugyldig eller utløpt godkjenning — godkjenn på nytt med gjeldende budsjett.",
    };
  }

  const payload = {
    name: campaign.name,
    creative: campaign.creative,
    text: campaign.text,
    cta: campaign.cta,
    budget,
    productId: campaign.productId,
    productName: campaign.productName,
    conversionVideoId: campaign.conversionVideoId,
    postId: campaign.postId,
  };

  try {
    const result = await publishCampaign(payload, true);
    const publishOk =
      typeof result === "object" &&
      result !== null &&
      (result as { status?: string }).status !== "blocked_no_budget" &&
      (result as { status?: string }).status !== "blocked_no_creative";
    logAdsEvent("ads_campaign_publish", gate.auth.userId, { campaignName: campaign.name, result }, publishOk);

    const postId = typeof campaign.postId === "string" ? campaign.postId.trim() : "";
    if (publishOk && postId) {
      try {
        if (hasSupabaseAdminConfig()) {
          const rec = result as Record<string, unknown>;
          const rawExt = rec.externalId ?? rec.external_id ?? null;
          const externalId =
            rawExt == null || rawExt === ""
              ? null
              : typeof rawExt === "string"
                ? rawExt
                : String(rawExt);
          const { error } = await supabaseAdmin()
            .from("social_posts")
            .update({
              status: "published",
              published_at: new Date().toISOString(),
              external_id: externalId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", postId);
          if (error) {
            console.error("[social] publish state update failed", error.message);
          }
        }
      } catch (e) {
        console.error("[social] publish state update failed", e);
      }
    }

    return { ok: true as const, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logAdsEvent("ads_campaign_publish", gate.auth.userId, { campaignName: campaign.name, error: msg }, false);
    return { ok: false as const, error: msg };
  }
}

export async function socialEngineRevertAdApprovalAction(campaignName: string) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  logAdsEvent("ads_approval_reverted", gate.auth.userId, { campaignName }, true);
  return { ok: true as const };
}

function nokKr(label: string, n: unknown): { ok: true; v: number } | { ok: false; error: string } {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
    return { ok: false as const, error: `${label} må være et ikke-negativt tall` };
  }
  return { ok: true as const, v: Math.round(n) };
}

function campaignDigestForRoas(campaign: Parameters<typeof canonicalCampaignForApproval>[0]) {
  return canonicalCampaignForApproval(campaign);
}

export async function socialEngineApproveRoasBudgetChangeAction(
  campaign: BuiltAdCampaign,
  spend: number,
  revenue: number,
  fromBudget: number,
  paused: boolean,
) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const sp = nokKr("Spend", spend);
  const rev = nokKr("Omsetning", revenue);
  const fb = nokKr("Gjeldende budsjett", fromBudget);
  if (sp.ok === false) return { ok: false as const, error: sp.error };
  if (rev.ok === false) return { ok: false as const, error: rev.error };
  if (fb.ok === false) return { ok: false as const, error: fb.error };

  if (paused) {
    logAdsEvent(
      "ads_roas_approve_blocked",
      gate.auth.userId,
      { campaignName: campaign.name, reason: "paused" },
      false,
    );
    return { ok: false as const, error: "Kampanje er satt på pause — ingen ROAS-budsjettendring." };
  }

  const digest = campaignDigestForRoas({
    name: campaign.name,
    creative: campaign.creative,
    text: campaign.text,
    cta: campaign.cta,
    productId: campaign.productId,
    conversionVideoId: campaign.conversionVideoId,
    postId: campaign.postId,
  });

  const guard = computeNextBudgetWithGuardrails({
    budget: fb.v,
    spend: sp.v,
    revenue: rev.v,
    paused: false,
  });

  if (Math.round(guard.nextBudget) === Math.round(fb.v)) {
    logAdsEvent(
      "ads_roas_approve_blocked",
      gate.auth.userId,
      { campaignName: campaign.name, reason: "no_change_after_guardrails" },
      false,
    );
    return {
      ok: false as const,
      error: "Ingen budsjettendring etter guardrails (nøytral ROAS, allerede innenfor cap, eller anbefalt pause).",
    };
  }

  const payloadHash = canonicalRoasBudgetPayloadHash({
    campaignDigest: digest,
    fromBudget: fb.v,
    toBudget: Math.round(guard.nextBudget),
    spend: sp.v,
    revenue: rev.v,
    paused: false,
  });

  const actor = gate.auth.user?.id ?? gate.auth.email ?? gate.auth.userId ?? "";
  const issued = issueRoasBudgetChangeProof(actor, payloadHash);
  if ("error" in issued) {
    logAdsEvent("ads_roas_approve", gate.auth.userId, { campaignName: campaign.name, err: issued.error }, false);
    return { ok: false as const, error: issued.error };
  }

  logAdsEvent(
    "ads_roas_approve",
    gate.auth.userId,
    {
      campaignName: campaign.name,
      productId: campaign.productId,
      fromBudget: fb.v,
      suggestedBudget: Math.round(guard.nextBudget),
      roas: guard.roas,
      classification: guard.classification,
      pauseRecommended: guard.pauseRecommended,
      expiresAt: issued.expiresAt,
    },
    true,
  );

  return {
    ok: true as const,
    proof: issued.proof,
    expiresAt: issued.expiresAt,
    suggestedBudget: Math.round(guard.nextBudget),
    roas: guard.roas,
    classification: guard.classification,
    pauseRecommended: guard.pauseRecommended,
  };
}

export async function socialEngineApplyRoasBudgetChangeAction(
  campaign: BuiltAdCampaign,
  spend: number,
  revenue: number,
  fromBudget: number,
  toBudget: number,
  paused: boolean,
  roasProof: string,
) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const sp = nokKr("Spend", spend);
  const rev = nokKr("Omsetning", revenue);
  const fb = nokKr("Gjeldende budsjett", fromBudget);
  const tb = nokKr("Nytt budsjett", toBudget);
  if (sp.ok === false) return { ok: false as const, error: sp.error };
  if (rev.ok === false) return { ok: false as const, error: rev.error };
  if (fb.ok === false) return { ok: false as const, error: fb.error };
  if (tb.ok === false) return { ok: false as const, error: tb.error };

  if (paused) {
    logAdsEvent("ads_roas_apply_blocked", gate.auth.userId, { campaignName: campaign.name, reason: "paused" }, false);
    return { ok: false as const, error: "Kampanje er satt på pause — endring ikke utført." };
  }

  const digest = campaignDigestForRoas({
    name: campaign.name,
    creative: campaign.creative,
    text: campaign.text,
    cta: campaign.cta,
    productId: campaign.productId,
    conversionVideoId: campaign.conversionVideoId,
    postId: campaign.postId,
  });

  const guard = computeNextBudgetWithGuardrails({
    budget: fb.v,
    spend: sp.v,
    revenue: rev.v,
    paused: false,
  });

  const expectedTo = Math.round(guard.nextBudget);
  if (tb.v !== expectedTo) {
    logAdsEvent(
      "ads_roas_apply_blocked",
      gate.auth.userId,
      { campaignName: campaign.name, reason: "to_budget_mismatch", expectedTo, got: tb.v },
      false,
    );
    return {
      ok: false as const,
      error: "Foreslått budsjett stemmer ikke med serverens guardrails — oppdater visning og godkjenn på nytt.",
    };
  }

  const payloadHash = canonicalRoasBudgetPayloadHash({
    campaignDigest: digest,
    fromBudget: fb.v,
    toBudget: expectedTo,
    spend: sp.v,
    revenue: rev.v,
    paused: false,
  });

  const actor = gate.auth.user?.id ?? gate.auth.email ?? gate.auth.userId ?? "";
  if (!verifyRoasBudgetChangeProof(actor, payloadHash, roasProof)) {
    logAdsEvent("ads_roas_apply_blocked", gate.auth.userId, { campaignName: campaign.name, reason: "bad_proof" }, false);
    return { ok: false as const, error: "Ugyldig eller utløpt ROAS-godkjenning." };
  }

  const rate = assertRoasBudgetChangeAllowed(digest);
  if (rate.ok === false) {
    logAdsEvent("ads_roas_apply_blocked", gate.auth.userId, { campaignName: campaign.name, reason: rate.reason }, false);
    return { ok: false as const, error: rate.reason };
  }

  recordRoasBudgetChange(digest);

  logAdsEvent(
    "ads_roas_budget_applied",
    gate.auth.userId,
    {
      campaignName: campaign.name,
      productId: campaign.productId,
      fromBudget: fb.v,
      toBudget: expectedTo,
      spend: sp.v,
      revenue: rev.v,
      roas: guard.roas,
      classification: guard.classification,
    },
    true,
  );

  void logAudit(
    createAuditEvent({
      action: "budget_change",
      entity: "campaign",
      entityId: campaign.name,
      actor: { id: gate.auth.user?.id ?? null, role: "superadmin" },
      source: "user",
      before: { budget: fb.v },
      after: {
        budget: expectedTo,
        spend: sp.v,
        revenue: rev.v,
        roas: guard.roas,
        classification: guard.classification,
      },
    }),
  );

  return { ok: true as const, newBudget: expectedTo };
}

export async function socialEnginePauseCampaignRoasAction(campaignName: string) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  if (!campaignName.trim()) {
    return { ok: false as const, error: "Mangler kampanjenavn" };
  }
  logAdsEvent("ads_roas_campaign_pause", gate.auth.userId, { campaignName: campaignName.trim() }, true);
  return { ok: true as const };
}

export async function socialEngineLogRoasHistoryAction(
  entries: Array<{
    campaignName: string;
    spend: number;
    revenue: number;
    roas: number;
    budget: number;
    suggestedBudget: number;
    classification: string;
  }>,
) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false as const, error: "Mangler ROAS-oppføringer" };
  }
  logAdsEvent("ads_roas_history_snapshot", gate.auth.userId, { count: entries.length, entries }, true);
  return { ok: true as const };
}

export async function socialEngineRevenueEngineLogAction(payload: {
  postsJson: string;
  spendBindings: CampaignSpendBinding[];
}) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  try {
    const posts = parseCalendar(payload?.postsJson || "[]");
    const bindings = Array.isArray(payload?.spendBindings) ? payload.spendBindings : [];
    const events = buildRevenueEventsFromCalendarPosts(posts);
    const summary = summarizeClosedLoopEngine(events, bindings);
    logAdsEvent(
      "ads_revenue_engine",
      gate.auth.userId,
      {
        totalRevenue: summary.totalRevenue,
        totalSpend: summary.totalSpend,
        totalProfit: summary.totalProfit,
        marginPct: summary.marginPct,
        portfolioRoas: summary.portfolioRoas,
        globalSafety: summary.globalSafety,
        bestCampaign: summary.bestCampaign,
        worstCampaign: summary.worstCampaign,
        decisionCount: summary.decisions.length,
        eventCount: events.length,
        signalRevenueTotal: summary.signalRevenueTotal,
        excludedWeakAttributionRevenue: summary.excludedWeakAttributionRevenue,
        attributionReliabilityLabel: summary.attributionReliabilityLabel,
        traceableEventCount: summary.traceableEventCount,
        reliableEventCount: summary.reliableEventCount,
      },
      true,
    );
    void logAudit(
      createAuditEvent({
        action: "revenue_engine_eval",
        entity: "revenue",
        actor: { id: gate.auth.user?.id ?? null, role: "superadmin" },
        source: "user",
        after: {
          totalRevenue: summary.totalRevenue,
          totalSpend: summary.totalSpend,
          totalProfit: summary.totalProfit,
          marginPct: summary.marginPct,
          portfolioRoas: summary.portfolioRoas,
          eventCount: events.length,
        },
      }),
    );
    return { ok: true as const, summary, eventCount: events.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logAdsEvent("ads_revenue_engine", gate.auth.userId, { error: msg }, false);
    return { ok: false as const, error: "Omsetningsmotor feilet (fail-closed)." };
  }
}

export async function socialEnginePortfolioPlannerLogAction(input: PortfolioPlannerInput) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  try {
    const safe: PortfolioPlannerInput = {
      accounts: Array.isArray(input?.accounts) ? input.accounts : [],
      campaigns: Array.isArray(input?.campaigns) ? input.campaigns : [],
      creatives: Array.isArray(input?.creatives) ? input.creatives : [],
    };
    const result = runPortfolioPlanner(safe);
    logAdsEvent(
      "ads_portfolio_planner",
      gate.auth.userId,
      {
        metrics: result.metrics,
        portfolioPolicy: result.portfolioPolicy,
        spendStatus: result.accountResolution.spendStatus,
        allocationBase: result.allocationBase,
        allocationFinal: result.allocationFinal,
        diversifiedCapped: result.diversified.filter((d) => d.capped).length,
        rotationCreativeIds: result.rotationOrder.map((c) => c.id),
        scalingSuggestions: result.scalingSuggestions,
        scalingEffective: result.scalingEffective,
        failClosedReasons: result.failClosedReasons,
        variantBlocks: result.creativeVariantsByCampaign.length,
      },
      true,
    );
    return { ok: true as const, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logAdsEvent("ads_portfolio_planner", gate.auth.userId, { error: msg }, false);
    return { ok: false as const, error: "Portfolio-planlegger feilet (fail-closed)." };
  }
}

export async function socialEngineProfitControlEvaluateAction(rows: CampaignProfitInput[]) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false as const, error: "Mangler kampanjedata" };
    }
    const sanitized: CampaignProfitInput[] = rows
      .filter((r) => r && typeof r === "object")
      .map((r) => ({
        name: typeof r.name === "string" ? r.name : "",
        budget: typeof r.budget === "number" && Number.isFinite(r.budget) ? r.budget : 0,
        spend: typeof r.spend === "number" && Number.isFinite(r.spend) ? r.spend : 0,
        revenue: typeof r.revenue === "number" && Number.isFinite(r.revenue) ? r.revenue : 0,
      }));
    const out = evaluateProfitFirstAll(sanitized);
    logAdsEvent(
      "ads_profit_control_eval",
      gate.auth.userId,
      {
        accountStatus: out.accountStatus,
        accountTotalSpend: out.accountTotalSpend,
        profitSummary: out.profitSummary,
        rowResults: out.rowResults,
      },
      true,
    );
    return {
      ok: true as const,
      accountStatus: out.accountStatus,
      accountTotalSpend: out.accountTotalSpend,
      profitSummary: out.profitSummary,
      rowResults: out.rowResults,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logAdsEvent("ads_profit_control_eval", gate.auth.userId, { error: msg }, false);
    return { ok: false as const, error: "Profit-evaluering feilet (fail-closed, ingen handling)." };
  }
}

export async function socialEngineProcurementDecisionAction(payload: {
  decision: "approve" | "reject";
  productId: string;
  productName?: string;
  supplierId?: string;
  supplierName?: string;
  suggestedQty?: number;
  estimatedCost?: number;
  deliveryDays?: number;
  valid?: boolean;
  blockReason?: string | null;
}) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const decision = payload.decision === "reject" ? "reject" : "approve";
  logProcurementEvent(
    "procurement_superadmin_decision",
    gate.auth.userId,
    {
      decision,
      productId: String(payload.productId ?? "").trim(),
      productName: payload.productName ?? null,
      supplierChosen: payload.supplierId ?? null,
      supplierName: payload.supplierName ?? null,
      quantity: typeof payload.suggestedQty === "number" && Number.isFinite(payload.suggestedQty) ? payload.suggestedQty : null,
      estimatedCostNok:
        typeof payload.estimatedCost === "number" && Number.isFinite(payload.estimatedCost) ? payload.estimatedCost : null,
      deliveryDays:
        typeof payload.deliveryDays === "number" && Number.isFinite(payload.deliveryDays) ? payload.deliveryDays : null,
      planLineValid: payload.valid ?? null,
      blockReason: payload.blockReason ?? null,
      autoOrder: false,
      manualApprovalRequired: true,
    },
    true,
  );

  void logAudit(
    createAuditEvent({
      action: decision === "approve" ? "procurement_approved" : "procurement_rejected",
      entity: "procurement",
      entityId: String(payload.productId ?? "").trim() || undefined,
      actor: { id: gate.auth.user?.id ?? null, role: "superadmin" },
      source: "user",
      after: {
        decision,
        productName: payload.productName ?? null,
        supplierId: payload.supplierId ?? null,
        suggestedQty: payload.suggestedQty ?? null,
        estimatedCost: payload.estimatedCost ?? null,
      },
    }),
  );

  return { ok: true as const };
}

export async function socialEnginePricingStrategyDecisionAction(payload: {
  decision: "approve" | "reject";
  productId: string;
  productName?: string;
  oldPrice?: number;
  suggestedPrice?: number;
  rawSuggested?: number;
  marginBeforePct?: number;
  marginAfterPct?: number;
  elasticity?: string;
  demandScore?: number;
  guardPassed?: boolean;
}) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const decision = payload.decision === "reject" ? "reject" : "approve";
  logPricingStrategyEvent(
    "pricing_strategy_superadmin_decision",
    gate.auth.userId,
    {
      decision,
      productId: String(payload.productId ?? "").trim(),
      productName: payload.productName ?? null,
      oldPrice: payload.oldPrice ?? null,
      suggestedPrice: payload.suggestedPrice ?? null,
      rawSuggested: payload.rawSuggested ?? null,
      marginBeforePct: payload.marginBeforePct ?? null,
      marginAfterPct: payload.marginAfterPct ?? null,
      elasticity: payload.elasticity ?? null,
      demandScore: payload.demandScore ?? null,
      guardPassed: payload.guardPassed ?? null,
      autoPriceChange: false,
      note: "Audit only — no catalog mutation",
    },
    true,
  );

  if (decision === "approve") {
    void logAudit(
      createAuditEvent({
        action: "pricing_suggestion_approved",
        entity: "product",
        entityId: String(payload.productId ?? "").trim() || undefined,
        actor: { id: gate.auth.user?.id ?? null, role: "superadmin" },
        source: "user",
        before: { price: payload.oldPrice ?? null },
        after: {
          suggestedPrice: payload.suggestedPrice ?? null,
          marginBeforePct: payload.marginBeforePct ?? null,
          marginAfterPct: payload.marginAfterPct ?? null,
          guardPassed: payload.guardPassed ?? null,
        },
      }),
    );
  }

  return { ok: true as const };
}

export async function socialEngineSupplierNegotiationIntentAction(payload: {
  productId: string;
  productName?: string;
  supplierId: string;
  supplierName?: string;
  negotiationAction: string;
  targetPrice?: number | null;
  marketReference?: number | null;
  message?: string;
}) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  logPricingStrategyEvent(
    "pricing_strategy_supplier_negotiation_intent",
    gate.auth.userId,
    {
      productId: String(payload.productId ?? "").trim(),
      productName: payload.productName ?? null,
      supplierId: String(payload.supplierId ?? "").trim(),
      supplierName: payload.supplierName ?? null,
      negotiationAction: payload.negotiationAction,
      targetPrice: payload.targetPrice ?? null,
      marketReference: payload.marketReference ?? null,
      message: payload.message ?? null,
      autoNegotiation: false,
      note: "Intent only — follow up outside system",
    },
    true,
  );

  return { ok: true as const };
}

export async function socialEngineLearnAction(postsJson: string) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const posts = parseCalendar(postsJson || "[]");
  const learning = learnFromPerformance(posts);
  logSocial("social_engine_learning", gate.auth.userId, {
    bestProducts: learning.bestProducts.length,
    bestHooks: learning.bestHooks.length,
    bestVideoHooks: learning.bestVideoHooks.length,
    bestVideoVoiceTones: learning.bestVideoVoiceTones.length,
    bestVideoCaptionStyles: learning.bestVideoCaptionStyles.length,
    bestMediaStyles: learning.bestMediaStyles,
    bestTimes: learning.bestTimes.slice(0, 4),
    bestHookTypesForVideo: learning.bestHookTypesForVideo,
    worstHookTypesForVideo: learning.worstHookTypesForVideo,
    productEconomicsLedger: learning.productEconomicsLedger?.length ?? 0,
  });
  return { ok: true as const, learning };
}

const ACTION_TYPES = new Set<Decision["type"]>([
  "generate_post",
  "schedule_post",
  "promote_product",
  "adjust_timing",
  "boost_existing",
  "deprioritize",
  "publish",
  "generate",
  "schedule",
  "promote",
]);

function parseDecisionForRevert(raw: unknown): { ok: true; decision: Decision } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Ugyldig nyttelast" };
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return { ok: false, error: "Mangler beslutnings-ID" };
  if (typeof o.type !== "string" || !ACTION_TYPES.has(o.type as Decision["type"])) {
    return { ok: false, error: "Ukjent handlingstype" };
  }
  if (typeof o.data !== "object" || o.data === null || Array.isArray(o.data)) {
    return { ok: false, error: "Ugyldig data" };
  }
  const risk = o.riskLevel;
  const riskLevel =
    risk === "low" || risk === "medium" || risk === "high" ? risk : ("low" as const);
  const decision: Decision = {
    id: o.id,
    type: o.type as Decision["type"],
    reason: typeof o.reason === "string" ? o.reason : "",
    confidence: typeof o.confidence === "number" && Number.isFinite(o.confidence) ? o.confidence : 0,
    expectedImpact:
      typeof o.expectedImpact === "number" && Number.isFinite(o.expectedImpact) ? o.expectedImpact : undefined,
    riskLevel,
    data: { ...(o.data as Record<string, unknown>) },
    approved: Boolean(o.approved),
    executed: Boolean(o.executed),
    timestamp: typeof o.timestamp === "number" && Number.isFinite(o.timestamp) ? o.timestamp : 0,
    skipReason: typeof o.skipReason === "string" ? o.skipReason : undefined,
  };
  return { ok: true, decision };
}

export type SocialAutonomousRunOptions = {
  paused?: boolean;
  aggressiveness?: AutonomyAggressiveness;
  maxActionsPerRun?: number;
};

export async function socialEngineAutonomousRunAction(
  postsJson: string,
  pausedOrOptions?: boolean | SocialAutonomousRunOptions,
) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const opts: SocialAutonomousRunOptions =
    typeof pausedOrOptions === "boolean" ? { paused: pausedOrOptions } : (pausedOrOptions ?? {});

  const result = await runAutonomousCycle({
    postsJson: postsJson || "[]",
    products: SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS,
    location: defaultSocialLocation,
    paused: opts.paused === true,
    aggressiveness: opts.aggressiveness,
    maxActionsPerRunOverride: opts.maxActionsPerRun,
    actorUserId: gate.auth.userId,
  });

  const actorAuditId = gate.auth.user?.id ?? null;
  void logAudit(
    createAuditEvent({
      action: "autonomous_cycle",
      entity: "growth_engine",
      actor: { id: actorAuditId, role: "superadmin" },
      source: "system",
      after: {
        executed: result.executed,
        skipped: result.skipped,
        decisionCount: result.decisions.length,
        lastRunAt: result.lastRunAt,
        systemConfidence: result.systemConfidence,
        aggregateRisk: result.aggregateRisk,
      },
    }),
  );
  for (const d of result.decisions.slice(0, 50)) {
    void logAudit(
      createAuditEvent({
        action: "ai_decision",
        entity: "growth_engine",
        entityId: d.id,
        actor: { id: actorAuditId, role: "superadmin" },
        source: "ai",
        metadata: {
          decision: d.type,
          confidence: d.confidence,
          reason: d.reason,
          riskLevel: d.riskLevel,
        },
      }),
    );
  }

  return {
    ok: true as const,
    postsJson: result.postsJson,
    cycle: {
      decisions: result.decisions,
      executed: result.executed,
      skipped: result.skipped,
      skippedReasons: result.skippedReasons,
      lowConfidenceSkips: result.lowConfidenceSkips,
      duplicateSkips: result.duplicateSkips,
      cappedSkips: result.cappedSkips,
      predictiveSkips: result.predictiveSkips,
      riskPolicySkips: result.riskPolicySkips,
      reinforcementScalingCapSkips: result.reinforcementScalingCapSkips,
      reinforcementSuppressionCapSkips: result.reinforcementSuppressionCapSkips,
      lastRunAt: result.lastRunAt,
      systemConfidence: result.systemConfidence,
      aggregateRisk: result.aggregateRisk,
      reinforcement: result.reinforcement,
    },
  };
}

export async function socialEngineRevertDecisionAction(postsJson: string, decisionRaw: unknown) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const parsed = parseDecisionForRevert(decisionRaw);
  if (parsed.ok === false) return { ok: false as const, error: parsed.error };

  const r = revertDecision(parsed.decision, postsJson || "[]");
  if (r.ok === false) {
    logSocial("social_engine_revert_denied", gate.auth.userId, {
      decisionId: parsed.decision.id,
      type: parsed.decision.type,
      error: r.error,
    });
    return { ok: false as const, error: r.error };
  }

  logDecisionReverted(gate.auth.userId, parsed.decision, { revertOk: true });
  logSocial("social_engine_revert", gate.auth.userId, {
    decisionId: parsed.decision.id,
    type: parsed.decision.type,
  });

  return { ok: true as const, postsJson: r.postsJson };
}

export async function socialEngineDemoTrackAction(postsJson: string, postId: string) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const posts = parseCalendar(postsJson || "[]");
  const post = posts.find((p) => p.id === postId);
  const patch: PostPerformancePatch = { clicks: 1 };
  if (post?.socialMedia?.imageUrl) {
    patch.imageClicks = 1;
  }
  const { posts: next, clicks } = trackPostPerformance(posts, postId, patch);
  logSocial("social_engine_performance_demo", gate.auth.userId, {
    postId,
    clicks,
    imageTracked: Boolean(post?.socialMedia?.imageUrl),
    mediaItemId: post?.socialMedia?.itemId ?? null,
  });
  return { ok: true as const, postsJson: serializeCalendar(next), clicks };
}
