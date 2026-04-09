"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { calendarPostPerformanceScore } from "@/lib/growth/scoring";
import type { CalendarPost } from "@/lib/social/calendar";
import { parseCalendar, rollingDayKeys } from "@/lib/social/calendar";
import { classifyPostInBatch } from "@/lib/social/classifier";
import type { AutonomyAggressiveness, Decision } from "@/lib/social/decisionEngine";
import type { ReinforcementCycleSummary } from "@/lib/social/reinforcement";
import { scorePostPerformance } from "@/lib/social/scoring";
import { attachAttributionToLink } from "@/lib/revenue/attribution";
import { aggregateRevenueByPost, aggregateRevenueByProduct, totalAttributedRevenue } from "@/lib/social/performance";
import { AUTO_PUBLISH } from "@/lib/social/scheduler";

import type { BuiltAdCampaign } from "@/lib/ads/campaign";
import { classifyCampaign } from "@/lib/ads/classifier";
import { computeNextBudgetWithGuardrails } from "@/lib/ads/execution";
import { calculateROAS } from "@/lib/ads/roas";
import { evaluateProfitFirstAll } from "@/lib/ads/profitExecution";
import type { ProfitUiBand } from "@/lib/ads/profitExecution";
import { runPortfolioPlanner } from "@/lib/ads/portfolioPlanner";
import type { PortfolioPlannerInput } from "@/lib/ads/portfolioPlanner";
import { buildDemandMenuPlan } from "@/lib/forecast/controlTowerPlan";
import { demoSuppliersForProduct } from "@/lib/procurement/demoSuppliers";
import { buildProcurementPlan } from "@/lib/procurement/plan";
import { buildProductPricingSuggestionRows, buildProductPrioritizationRows } from "@/lib/product/growthProductViews";
import { buildPriceOptimizationRows, buildSupplierNegotiationRows } from "@/lib/pricing/superadminViews";
import { summarizeClosedLoopEngine } from "@/lib/revenue/engineView";
import { buildRevenueEventsFromCalendarPosts } from "@/lib/revenue/pipeline";
import { SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS } from "@/lib/social/superadminEngineSeed";
import type { AbVariantStats } from "@/lib/social/abAnalytics";
import type { SocialRecommendation } from "@/lib/social/recommendations";
import { generateUnifiedPost } from "@/lib/social/unifiedGeneratorClient";

import DataTrustBadge from "@/components/superadmin/DataTrustBadge";

import {
  socialEngineApproveAdCampaignAction,
  socialEngineApproveRoasBudgetChangeAction,
  socialEngineApplyRoasBudgetChangeAction,
  socialEngineAutonomousRunAction,
  socialEngineBuildAdCampaignAction,
  socialEngineDemoTrackAction,
  socialEngineFillCalendarAction,
  socialEngineGenerateDraftAction,
  socialEngineGenerateVideoAction,
  socialEngineLearnAction,
  socialEngineLogRoasHistoryAction,
  socialEnginePauseCampaignRoasAction,
  socialEngineProfitControlEvaluateAction,
  socialEnginePortfolioPlannerLogAction,
  socialEnginePricingStrategyDecisionAction,
  socialEngineProcurementDecisionAction,
  socialEnginePublishAdCampaignAction,
  socialEngineRevenueEngineLogAction,
  socialEngineRevertAdApprovalAction,
  socialEngineRevertDecisionAction,
  socialEngineSchedulerAction,
  socialEngineSupplierNegotiationIntentAction,
} from "./actions";

type VideoEnginePreview = {
  productId: string;
  productName: string;
  hooks: string[];
  selectedHook: string;
  alternatives: string[];
  conversionVideoId: string;
  conversion: {
    hookRanking: Array<{ hook: string; type: string; strength: number }>;
    selectedHookType: string;
    selectedHookStrength: number;
    aggregateHookRetentionPct: number | null;
    aggregateCompletionPct: number | null;
    aggregateVideoConversionRatePct: number | null;
    bestHookFromData: string | null;
    worstHookFromData: string | null;
    dropOffDiagnosis: string | null;
    improvementsSuggested: string[];
    abVariants: Array<{ id: string; hook: string }>;
  };
  script: { hook: string; middle: string; cta: string; fullText: string };
  structure: Array<{
    type: string;
    duration: number;
    text?: string;
    media?: string | null;
    label?: string;
  }>;
  media: { images: string[]; videos: string[] };
  missingAssets: { images: boolean; videos: boolean };
  totalDurationSec: number;
  captions: Array<{ text: string; start: number; end: number; emphasis: string }>;
  voice: {
    voice: string;
    toneProfile: string;
    directionNotes: string;
    audioUrl: string | null;
  };
  providerStatus: { name: string | null; used: boolean; kind: string };
  previewUrl: string | null;
  videoUrl: string | null;
  previewFrames: string[];
  localRender:
    | { engine: "ffmpeg"; durationSec: number; relativePath: string }
    | { engine: "none"; reason: string };
};

type AdCampaignUiRow = {
  localId: string;
  campaign: BuiltAdCampaign;
  budgetDraft: number;
  spendDraft: number;
  roasPaused: boolean;
  roasProof: string | null;
  roasProofExpiresAt: number | null;
  uiStatus: "pending" | "approved" | "published";
  approvalProof: string | null;
  expiresAt: number | null;
  publishResult: Record<string, unknown> | null;
  lastError: string | null;
};

function isDecisionRevertible(d: Decision): boolean {
  const t = d.type;
  if (t === "generate_post" || t === "generate" || t === "publish") return false;
  return (
    t === "schedule_post" ||
    t === "schedule" ||
    t === "adjust_timing" ||
    t === "promote_product" ||
    t === "promote" ||
    t === "boost_existing" ||
    t === "deprioritize"
  );
}

type AiGrowthApiData = {
  patterns: { totalWinners: number; avgScore: number; commonType: string };
  generated: Array<{ title: string; content: string; strategy: string; postId?: string }>;
  actions: Array<{ type: string; message: string }>;
  recommendations?: SocialRecommendation[];
};

type AbVariantWinner = { id: string; clicks: number; leads: number; score: number };
type AbScaleAction = { type: string; postId: string; message: string };
type AbDecisionsPayload = { winners: AbVariantWinner[]; actions: AbScaleAction[] };

type RevenueBrainPayload = {
  revenue: number;
  leads: unknown[];
  actions: Array<{ type: string; message: string }>;
  socialLeadEventCount?: number | null;
  dataAvailability?: {
    leadPipeline?: boolean;
    socialEvents?: boolean;
  };
};

type AutopilotPayload = {
  forecast: number;
  prioritized: Array<Record<string, unknown> & { priority?: number }>;
  playbook: string[];
  closing: Array<{ id: string; message: string }>;
  disclaimer?: string;
};

type CeoBrainPayload = {
  snapshot: {
    revenue: number;
    leads: number;
    forecast: number;
    actions: string[];
  };
  priorities: string[];
  strategy: string[];
};

type AutonomyCycleSummary = {
  decisions: Decision[];
  executed: number;
  skipped: number;
  skippedReasons: string[];
  lowConfidenceSkips: number;
  duplicateSkips: number;
  cappedSkips: number;
  predictiveSkips: number;
  riskPolicySkips: number;
  reinforcementScalingCapSkips: number;
  reinforcementSuppressionCapSkips: number;
  lastRunAt: string;
  systemConfidence: number | null;
  aggregateRisk: Decision["riskLevel"] | null;
  reinforcement: ReinforcementCycleSummary;
};

function statusNb(s: CalendarPost["status"]): string {
  if (s === "planned") return "planlagt";
  if (s === "ready") return "klar";
  if (s === "published") return "publisert";
  return "kansellert";
}

function profitStatusPresentation(band: ProfitUiBand): { emoji: string; label: string } {
  if (band === "profitable") return { emoji: "🟢", label: "Lønnsom" };
  if (band === "breakeven") return { emoji: "🟡", label: "Break-even" };
  return { emoji: "🔴", label: "Taper penger" };
}

export default function SocialEngineClient() {
  const [postsJson, setPostsJson] = useState("[]");
  const [message, setMessage] = useState<string | null>(null);
  const [draftPreview, setDraftPreview] = useState<string | null>(null);
  const [draftImage, setDraftImage] = useState<{ url: string; alt: string } | null>(null);
  const [draftTrackingPath, setDraftTrackingPath] = useState<string | null>(null);
  const [learningPreview, setLearningPreview] = useState<string | null>(null);
  const [aiPaused, setAiPaused] = useState(false);
  const [aggressiveness, setAggressiveness] = useState<AutonomyAggressiveness>("medium");
  const [maxActionsPerRun, setMaxActionsPerRun] = useState(3);
  const [lastCycle, setLastCycle] = useState<AutonomyCycleSummary | null>(null);
  const [showAutonomyLog, setShowAutonomyLog] = useState(false);
  const [revertBusyId, setRevertBusyId] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<VideoEnginePreview | null>(null);
  const [adCampaignRows, setAdCampaignRows] = useState<AdCampaignUiRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [recommendations, setRecommendations] = useState<SocialRecommendation[]>([]);
  const [dbScoreByPostId, setDbScoreByPostId] = useState<Record<string, number>>({});
  const [aiData, setAiData] = useState<AiGrowthApiData | null>(null);
  const [abData, setAbData] = useState<AbDecisionsPayload | null>(null);
  const [abAnalyticsByGroup, setAbAnalyticsByGroup] = useState<Record<string, AbVariantStats[]> | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueBrainPayload | null>(null);
  const [autoData, setAutoData] = useState<AutopilotPayload | null>(null);
  const [ceoData, setCeoData] = useState<CeoBrainPayload | null>(null);
  const [unifiedPreview, setUnifiedPreview] = useState<{
    text: string;
    hashtags: string[];
    images: string[];
    source: string;
    platform: string;
    saved: boolean;
    savedId: string | null;
    clientFallback?: boolean;
  } | null>(null);
  const [unifiedBusy, setUnifiedBusy] = useState(false);

  const runUnifiedGenerate = useCallback(async (mode: "ai" | "deterministic") => {
    setUnifiedBusy(true);
    setUnifiedPreview(null);
    try {
      const result = await generateUnifiedPost({
        mode,
        persist: true,
        input: { platform: "linkedin" },
      });
      setUnifiedPreview({
        text: result.text,
        hashtags: result.hashtags,
        images: Array.isArray(result.images) ? result.images : [],
        source: result.source,
        platform: result.platform,
        saved: result.saved,
        savedId: result.savedId,
        clientFallback: result.clientFallback === true,
      });
    } finally {
      setUnifiedBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/revenue/brain")
      .then((res) => res.json())
      .then((j: { ok?: boolean; data?: RevenueBrainPayload }) => {
        if (cancelled) return;
        if (j?.ok === true && j.data && typeof j.data === "object") {
          setRevenueData(j.data);
        } else {
          setRevenueData(null);
        }
      })
      .catch(() => {
        if (!cancelled) setRevenueData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/revenue/autopilot")
      .then((res) => res.json())
      .then((j: { ok?: boolean; data?: AutopilotPayload }) => {
        if (cancelled) return;
        if (j?.ok === true && j.data && typeof j.data === "object") {
          setAutoData(j.data);
        } else {
          setAutoData(null);
        }
      })
      .catch(() => {
        if (!cancelled) setAutoData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/ceo/brain")
      .then((res) => res.json())
      .then((j: { ok?: boolean; data?: CeoBrainPayload }) => {
        if (cancelled) return;
        if (j?.ok === true && j.data && typeof j.data === "object") {
          setCeoData(j.data);
        } else {
          setCeoData(null);
        }
      })
      .catch(() => {
        if (!cancelled) setCeoData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/social/ai")
      .then((res) => res.json())
      .then((j: { ok?: boolean; data?: AiGrowthApiData }) => {
        if (cancelled) return;
        if (j?.ok === true && j.data && typeof j.data === "object") {
          setAiData(j.data);
        } else {
          setAiData(null);
        }
      })
      .catch(() => {
        if (!cancelled) setAiData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/social/ab/decisions")
      .then((res) => res.json())
      .then((j: { ok?: boolean; data?: AbDecisionsPayload }) => {
        if (cancelled) return;
        if (j?.ok === true && j.data && typeof j.data === "object") {
          setAbData(j.data);
        } else {
          setAbData(null);
        }
      })
      .catch(() => {
        if (!cancelled) setAbData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/social/ab/analytics")
      .then((res) => res.json())
      .then((j: { ok?: boolean; data?: Record<string, AbVariantStats[]> }) => {
        if (cancelled) return;
        if (j?.ok === true && j.data && typeof j.data === "object" && j.data !== null) {
          setAbAnalyticsByGroup(j.data);
        } else {
          setAbAnalyticsByGroup(null);
        }
      })
      .catch(() => {
        if (!cancelled) setAbAnalyticsByGroup(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [recRes, anaRes] = await Promise.all([
          fetch("/api/social/recommendations"),
          fetch("/api/social/analytics"),
        ]);
        const recJ = (await recRes.json()) as { ok?: boolean; data?: { recommendations?: SocialRecommendation[] } };
        const anaJ = (await anaRes.json()) as { ok?: boolean; data?: Array<{ id: string; score: number }> };
        if (cancelled) return;
        setRecommendations(Array.isArray(recJ?.data?.recommendations) ? recJ.data!.recommendations! : []);
        const rows = Array.isArray(anaJ?.data) ? anaJ.data : [];
        const next: Record<string, number> = {};
        for (const row of rows) {
          if (row && typeof row.id === "string" && typeof row.score === "number") {
            next[row.id] = row.score;
          }
        }
        setDbScoreByPostId(next);
      } catch {
        if (!cancelled) {
          setRecommendations([]);
          setDbScoreByPostId({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const posts = useMemo(() => parseCalendar(postsJson), [postsJson]);
  const revenueByProductId = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of aggregateRevenueByProduct(posts)) {
      m.set(r.productId, r.revenue);
    }
    return m;
  }, [posts]);
  const windowKeys = useMemo(() => rollingDayKeys(), []);

  const revenueSummary = useMemo(() => {
    const total = totalAttributedRevenue(posts);
    const byPost = aggregateRevenueByPost(posts);
    const bestPost = byPost[0] ?? null;
    const byProduct = aggregateRevenueByProduct(posts);
    const bestProduct = byProduct[0] ?? null;
    return { total, bestPost, bestProduct };
  }, [posts]);

  const productPrioritizationRows = useMemo(
    () => buildProductPrioritizationRows(SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS, posts),
    [posts],
  );
  const productPricingRows = useMemo(
    () => buildProductPricingSuggestionRows(SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS),
    [],
  );

  const demandMenuPlan = useMemo(
    () => buildDemandMenuPlan(posts, SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS, { horizonDays: 7, menuMaxItems: 8 }),
    [posts],
  );

  const procurementPlan = useMemo(
    () =>
      buildProcurementPlan(demandMenuPlan, SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS, (productId) =>
        demoSuppliersForProduct(productId),
      ),
    [demandMenuPlan],
  );

  const priceOptimizationRows = useMemo(
    () =>
      buildPriceOptimizationRows(SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS, posts, (productId) =>
        demoSuppliersForProduct(productId),
      ),
    [posts],
  );

  const supplierNegotiationRows = useMemo(
    () => buildSupplierNegotiationRows(SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS, (id) => demoSuppliersForProduct(id)),
    [],
  );

  const profitControlInputs = useMemo(
    () =>
      adCampaignRows.map((row) => ({
        name: row.campaign.name,
        budget: row.budgetDraft,
        spend: Math.max(0, Math.floor(row.spendDraft)),
        revenue: revenueByProductId.get(row.campaign.productId) ?? 0,
      })),
    [adCampaignRows, revenueByProductId],
  );

  const profitControl = useMemo(
    () => evaluateProfitFirstAll(profitControlInputs),
    [profitControlInputs],
  );

  const portfolioBundle = useMemo(() => {
    const byProduct = new Map<string, AdCampaignUiRow[]>();
    for (const row of adCampaignRows) {
      const pid = row.campaign.productId;
      if (!byProduct.has(pid)) byProduct.set(pid, []);
      byProduct.get(pid)!.push(row);
    }
    const accounts = [...byProduct.entries()].map(([id, rows]) => ({
      id: `acc_${id}`,
      name: rows[0]?.campaign.productName ?? id,
      spend: rows.reduce((s, r) => s + Math.max(0, Math.floor(r.spendDraft)), 0),
      budget: rows.reduce((s, r) => s + Math.max(0, r.budgetDraft), 0),
      status: (rows.some((r) => r.roasPaused) ? "paused" : "active") as "active" | "paused",
    }));

    const campaigns = adCampaignRows.map((row) => {
      const revenue = revenueByProductId.get(row.campaign.productId) ?? 0;
      const spend = Math.max(0, Math.floor(row.spendDraft));
      const roas = calculateROAS({ spend, revenue });
      return {
        id: row.localId,
        accountId: `acc_${row.campaign.productId}`,
        budget: row.budgetDraft,
        spend,
        revenue,
        roas,
      };
    });

    const creatives: PortfolioPlannerInput["creatives"] = adCampaignRows.map((row) => {
      const revenue = revenueByProductId.get(row.campaign.productId) ?? 0;
      const spend = Math.max(0, Math.floor(row.spendDraft));
      const roas = calculateROAS({ spend, revenue });
      return {
        id: `cr_${row.localId}`,
        videoUrl: row.campaign.creative ?? "",
        hook: row.campaign.text,
        performance: { roas, conversions: 0 },
      };
    });
    if (videoPreview) {
      const revenue = revenueByProductId.get(videoPreview.productId) ?? 0;
      creatives.push({
        id: `cr_preview_${videoPreview.conversionVideoId}`,
        videoUrl: videoPreview.videoUrl ?? videoPreview.previewUrl ?? "",
        hook: videoPreview.script.hook,
        performance: { roas: calculateROAS({ spend: 0, revenue }), conversions: 0 },
      });
    }

    const input: PortfolioPlannerInput = { accounts, campaigns, creatives };
    const plan = runPortfolioPlanner(input);
    return { input, plan, accounts, campaigns };
  }, [adCampaignRows, revenueByProductId, videoPreview]);

  const revenueEngine = useMemo(() => {
    const events = buildRevenueEventsFromCalendarPosts(posts);
    const spendBindings = adCampaignRows.map((r) => ({
      id: r.campaign.postId?.trim() || r.localId,
      spend: Math.max(0, Math.floor(r.spendDraft)),
      budget: Math.max(0, r.budgetDraft),
    }));
    return summarizeClosedLoopEngine(events, spendBindings);
  }, [posts, adCampaignRows]);

  const reinforcementClassByPostId = useMemo(() => {
    const m = new Map<string, "winner" | "loser" | "neutral">();
    const published = posts.filter((p) => p.status === "published" && p.performance);
    if (published.length === 0) return m;
    const linearScores = published.map((p) => scorePostPerformance(p).score);
    const minL = Math.min(...linearScores);
    const maxL = Math.max(...linearScores);
    for (const p of published) {
      m.set(p.id, classifyPostInBatch(p, minL, maxL));
    }
    return m;
  }, [posts]);

  const run = useCallback(
    (fn: () => Promise<{ ok: boolean; error?: string; postsJson?: string; [k: string]: unknown }>) => {
      startTransition(() => {
        void (async () => {
          setMessage(null);
          const r = await fn();
          if (!r.ok) {
            setMessage(r.error ?? "Ukjent feil");
            return;
          }
          if (typeof r.postsJson === "string") {
            setPostsJson(r.postsJson);
            try {
              const parsedPosts = JSON.parse(r.postsJson);
              await fetch("/api/social/posts/save", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ posts: parsedPosts }),
              });
            } catch (e) {
              console.error("Save posts failed", e);
            }
          }
          if (typeof r.promotedCount === "number") {
            setMessage(`Planlegger: ${r.promotedCount} post(er) satt til «klar». AUTO_PUBLISH=${String(AUTO_PUBLISH)}.`);
          } else if (typeof r.totalPosts === "number") {
            setMessage(`Kalender oppdatert: ${r.totalPosts} post(er) i vinduet.`);
          } else if (typeof r.clicks === "number") {
            setMessage(`Ytelse (demo): klikk registrert (totalt ${r.clicks} på posten).`);
          } else {
            setMessage("OK");
          }
        })();
      });
    },
    [],
  );

  return (
    <div className="space-y-6">
      {ceoData ? (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
          <h3 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">
            <span aria-hidden>🧠</span> CEO View
          </h3>
          <p className="mt-2 text-sm text-[rgb(var(--lp-text))]">
            Omsetning: {ceoData.snapshot.revenue} kr · Forecast: {ceoData.snapshot.forecast} kr · Leads:{" "}
            {ceoData.snapshot.leads}
          </p>
          <div className="mt-3 text-sm text-[rgb(var(--lp-text))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">
              <span aria-hidden>📌</span> Prioriteter
            </p>
            <ul className="mt-1 list-none space-y-1">
              {ceoData.priorities.map((p, i) => (
                <li key={`${p}-${i}`}>
                  <span aria-hidden>→</span> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 text-sm text-[rgb(var(--lp-text))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">
              <span aria-hidden>🚀</span> Strategi
            </p>
            <ul className="mt-1 list-none space-y-1">
              {ceoData.strategy.map((s, i) => (
                <li key={`${s}-${i}`}>
                  <span aria-hidden>→</span> {s}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
            Kun forslag — ingen automatisk utførelse eller dataendringer.
          </p>
        </div>
      ) : null}

      {aiData ? (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
          <h3 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">AI Growth Engine</h3>
          <p className="mt-2 text-sm text-[rgb(var(--lp-text))]">
            <span aria-hidden>🔥</span> Vinnende innlegg: {aiData.patterns.totalWinners}{" "}
            <span className="text-[rgb(var(--lp-muted))]">
              · snittscore {aiData.patterns.avgScore.toFixed(2)} · statusfokus {aiData.patterns.commonType}
            </span>
          </p>
          <div className="mt-3 text-sm text-[rgb(var(--lp-text))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">
              <span aria-hidden>⚡</span> Neste handlinger
            </p>
            <ul className="mt-1 list-none space-y-1">
              {(Array.isArray(aiData.actions) ? aiData.actions : []).map((a, i) => (
                <li key={`${a.type}-${i}`}>
                  <span aria-hidden>→</span> {a.message}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 text-sm text-[rgb(var(--lp-text))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">
              <span aria-hidden>🧠</span> Generert innhold (utkast)
            </p>
            <ul className="mt-1 list-none space-y-2">
              {(Array.isArray(aiData.generated) ? aiData.generated : []).map((g, i) => (
                <li key={`${g.title}-${i}`} className="rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white/60 p-2">
                  <span className="font-medium">{g.title}</span>
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs text-[rgb(var(--lp-muted))]">{g.content}</p>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            disabled={unifiedBusy}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() => void runUnifiedGenerate("ai")}
          >
            {unifiedBusy ? "Genererer…" : "Generer nye innlegg fra AI"}
          </button>
        </div>
      ) : null}

      <div className="mb-5 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">AI-anbefalinger</h3>
          <button
            type="button"
            disabled={unifiedBusy}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() => void runUnifiedGenerate("ai")}
          >
            {unifiedBusy ? "Genererer…" : "Generer AI innlegg"}
          </button>
        </div>
        {recommendations.length === 0 ? (
          <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Ingen anbefalinger akkurat nå (eller data mangler).</p>
        ) : (
          <ul className="mt-2 list-none space-y-1 text-sm text-[rgb(var(--lp-text))]">
            {recommendations.map((r, i) => (
              <li key={`${r.type}-${i}`}>
                <span aria-hidden>⚡</span> {r.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {unifiedPreview ? (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
          <h3 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">Siste genererte utkast</h3>
          <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
            Kilde: {unifiedPreview.source} · plattform: {unifiedPreview.platform}
            {unifiedPreview.saved ? ` · lagret (id: ${unifiedPreview.savedId ?? "—"})` : " · ikke lagret"}
          </p>
          {unifiedPreview.clientFallback ? (
            <p className="mt-2 text-xs text-amber-800">
              Nettverksfallback — prøv «Generer» igjen for å lagre utkast i databasen.
            </p>
          ) : null}
          {unifiedPreview.images.length > 0 ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {unifiedPreview.images.map((url, i) => (
                <img
                  key={`${url.slice(0, 80)}-${i}`}
                  src={url}
                  alt=""
                  className="max-h-28 max-w-full rounded-lg border border-[rgb(var(--lp-border))] object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          ) : null}
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-[rgb(var(--lp-text))]">{unifiedPreview.text}</p>
          {unifiedPreview.hashtags.length > 0 ? (
            <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">{unifiedPreview.hashtags.join(" ")}</p>
          ) : null}
        </div>
      ) : null}

      {abData ? (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
          <h3 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">
            <span aria-hidden>🔥</span> Vinnere (A/B per gruppe)
          </h3>
          <ul className="mt-2 list-none space-y-1 text-sm text-[rgb(var(--lp-text))]">
            {(Array.isArray(abData.winners) ? abData.winners : []).map((w, i) => (
              <li key={`${w.id}-${i}`}>
                Post <span className="font-mono">{w.id}</span> – score {w.score}{" "}
                <span className="text-[rgb(var(--lp-muted))]">
                  (klikk {w.clicks}, leads {w.leads})
                </span>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">
            <span aria-hidden>⚡</span> Skalering
          </h3>
          <ul className="mt-2 list-none space-y-1 text-sm text-[rgb(var(--lp-text))]">
            {(Array.isArray(abData.actions) ? abData.actions : []).map((a, i) => (
              <li key={`${a.postId}-${a.type}-${i}`}>
                <span aria-hidden>→</span> {a.message}{" "}
                <span className="font-mono text-[10px] text-[rgb(var(--lp-muted))]">({a.postId})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {abAnalyticsByGroup && Object.keys(abAnalyticsByGroup).length > 0 ? (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
          <h3 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">
            <span aria-hidden>📊</span> A/B-gruppert ytelse (variantgruppe)
          </h3>
          <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
            Gruppert på variant_group_id (samme datagrunnlag som A/B-beslutninger).
          </p>
          <ul className="mt-2 list-none space-y-3 text-sm text-[rgb(var(--lp-text))]">
            {Object.entries(abAnalyticsByGroup).map(([gid, rows]) => (
              <li key={gid}>
                <span className="font-mono text-xs">{gid}</span>
                <ul className="mt-1 list-none space-y-0.5 pl-2 text-[rgb(var(--lp-muted))]">
                  {(Array.isArray(rows) ? rows : []).slice(0, 8).map((r) => (
                    <li key={r.id}>
                      Post <span className="font-mono">{r.id}</span> · klikk {r.clicks} · leads {r.leads} · score {r.score}
                    </li>
                  ))}
                  {(Array.isArray(rows) ? rows : []).length > 8 ? (
                    <li className="text-[10px]">… og {(rows as AbVariantStats[]).length - 8} til</li>
                  ) : null}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {revenueData ? (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
          <h3 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">
            <span aria-hidden>💰</span> Revenue Brain
          </h3>
          <p className="mt-2 text-sm text-[rgb(var(--lp-text))]">
            Total estimat (lukket): <strong>{revenueData.revenue.toFixed(0)}</strong> kr
          </p>
          <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
            Forslag kun — ingen automatisk lukking eller prisendring. Pipeline:{" "}
            {Array.isArray(revenueData.leads) ? revenueData.leads.length : 0} rader.
            {typeof revenueData.socialLeadEventCount === "number"
              ? ` · SoMe lead-events (social_posts): ${revenueData.socialLeadEventCount}`
              : null}
          </p>
          <div className="mt-3 text-sm text-[rgb(var(--lp-text))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">
              <span aria-hidden>⚡</span> Handlinger
            </p>
            <ul className="mt-1 list-none space-y-1">
              {(Array.isArray(revenueData.actions) ? revenueData.actions : []).map((a, i) => (
                <li key={`${a.type}-${i}`}>
                  <span aria-hidden>→</span> {a.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {autoData ? (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
          <h3 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">
            <span aria-hidden>🚀</span> Autopilot
          </h3>
          <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
            {autoData.disclaimer ??
              "Kun forslag — ingen automatisk utsending, ingen auto-close. Kopier manuelt ved behov."}
          </p>
          <p className="mt-2 text-sm text-[rgb(var(--lp-text))]">
            Forecast (vektet): <strong>{autoData.forecast}</strong> kr
          </p>
          <div className="mt-3 text-sm text-[rgb(var(--lp-text))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">
              <span aria-hidden>📌</span> Prioriterte leads (topp 3)
            </p>
            <ul className="mt-1 list-none space-y-1">
              {(Array.isArray(autoData.prioritized) ? autoData.prioritized : [])
                .slice(0, 3)
                .map((l, i) => (
                  <li key={`${String(l.id ?? i)}-prio`}>
                    Lead <span className="font-mono">{String(l.id ?? "—")}</span> –{" "}
                    <span className="text-[rgb(var(--lp-muted))]">{String(l.status ?? "—")}</span>
                    {typeof l.priority === "number" ? (
                      <span className="text-[10px] text-[rgb(var(--lp-muted))]"> · prio {l.priority}</span>
                    ) : null}
                  </li>
                ))}
            </ul>
          </div>
          <div className="mt-3 text-sm text-[rgb(var(--lp-text))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">
              <span aria-hidden>🧠</span> Dagens plan
            </p>
            <ul className="mt-1 list-none space-y-1">
              {(Array.isArray(autoData.playbook) ? autoData.playbook : []).map((t, i) => (
                <li key={`${t}-${i}`}>
                  <span aria-hidden>→</span> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 text-sm text-[rgb(var(--lp-text))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">
              <span aria-hidden>💬</span> Closing-forslag (kladd)
            </p>
            <ul className="mt-1 list-none space-y-2">
              {(Array.isArray(autoData.closing) ? autoData.closing : []).map((c, i) => (
                <li key={`${c.id}-${i}`} className="rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white/60 p-2 text-xs">
                  <span className="font-mono text-[10px] text-[rgb(var(--lp-muted))]">{c.id}</span>
                  <p className="mt-1 whitespace-pre-wrap text-[rgb(var(--lp-text))]">{c.message}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
          {message}
        </p>
      ) : null}

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Inntekt fra AI</h2>
          <DataTrustBadge kind="REAL" />
        </div>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Tallene er kun fra registrerte performance-felt i kalenderen og valgfri ordreattributjon (<code className="text-[10px]">src=ai_social</code> +{" "}
          <code className="text-[10px]">postId</code>). Ingen antatte klikk eller omsetning.
        </p>
        <dl className="mt-3 grid gap-2 text-sm text-[rgb(var(--lp-text))] sm:grid-cols-3">
          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-center">
            <dt className="text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">Total registrert</dt>
            <dd className="font-heading text-lg font-semibold">{revenueSummary.total.toFixed(0)} kr</dd>
          </div>
          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-center">
            <dt className="text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">Beste post (omsetning)</dt>
            <dd className="text-xs font-medium">
              {revenueSummary.bestPost ? (
                <>
                  <span className="font-mono">{revenueSummary.bestPost.postId}</span>
                  <span className="block text-[rgb(var(--lp-muted))]">{revenueSummary.bestPost.revenue.toFixed(0)} kr</span>
                </>
              ) : (
                <span className="text-[rgb(var(--lp-muted))]">—</span>
              )}
            </dd>
          </div>
          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-center">
            <dt className="text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">Beste produkt (omsetning)</dt>
            <dd className="text-xs font-medium">
              {revenueSummary.bestProduct && revenueSummary.bestProduct.revenue > 0 ? (
                <>
                  <span className="font-mono">{revenueSummary.bestProduct.productId}</span>
                  <span className="block text-[rgb(var(--lp-muted))]">
                    {revenueSummary.bestProduct.revenue.toFixed(0)} kr · {revenueSummary.bestProduct.conversions} konv.
                  </span>
                </>
              ) : (
                <span className="text-[rgb(var(--lp-muted))]">—</span>
              )}
            </dd>
          </div>
        </dl>
        {posts[0] ? (
          <p className="mt-3 break-all text-[10px] text-[rgb(var(--lp-muted))]">
            Sporingslenke (mal):{" "}
            <span className="font-mono">{attachAttributionToLink(posts[0].id, posts[0].productId)}</span>
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Produktprioritering</h2>
          <DataTrustBadge kind="DEMO" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Margin-, lager- og etterspørselsscore (demo-katalog). Trygge produkter (margin ≥ 20 %, lager ≠ 0) kan prioriteres for vekst; ingen
          prisendring skjer automatisk.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[rgb(var(--lp-border))] bg-white/90">
          <table className="w-full min-w-[320px] border-collapse text-left text-xs text-[rgb(var(--lp-text))]">
            <thead>
              <tr className="border-b border-[rgb(var(--lp-border))] text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                <th className="px-3 py-2 font-medium">Produkt</th>
                <th className="px-3 py-2 font-medium text-right">Margin %</th>
                <th className="px-3 py-2 font-medium text-right">DB/enhet</th>
                <th className="px-3 py-2 font-medium text-right">Lager</th>
                <th className="px-3 py-2 font-medium text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {productPrioritizationRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-center text-[rgb(var(--lp-muted))]">
                    Ingen produktdata.
                  </td>
                </tr>
              ) : (
                productPrioritizationRows.map((row) => (
                  <tr key={row.productId} className="border-b border-[rgb(var(--lp-border))]/80">
                    <td className="px-3 py-2">
                      <span className="font-medium text-[rgb(var(--lp-fg))]">{row.name}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-[rgb(var(--lp-muted))]">{row.productId}</span>
                      <span
                        className={
                          row.safeForPromotion
                            ? "mt-1 block text-[10px] text-emerald-800"
                            : "mt-1 block text-[10px] text-amber-900"
                        }
                      >
                        {row.safeForPromotion ? "Trygg for promotering" : "Ikke trygg (margin/lager)"} · lager: {row.inventorySignal}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{row.marginPct.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.profitPerUnit.toFixed(0)} kr</td>
                    <td className="px-3 py-2 text-right font-mono">{row.stock ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.score.toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Prisforslag</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Beregnede forslag kun for visning — systemet endrer aldri pris automatisk. Vurder manuelt mot marked og avtaler.
        </p>
        <div className="mt-3 space-y-2">
          {productPricingRows.length === 0 ? (
            <p className="text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">Ingen prisforslag (mangler kost/pris i katalog).</p>
          ) : (
            productPricingRows.map((row) => (
              <div
                key={row.productId}
                className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-xs text-[rgb(var(--lp-text))]"
              >
                <p className="font-medium text-[rgb(var(--lp-fg))]">{row.name}</p>
                <p className="mt-1 font-mono text-[rgb(var(--lp-muted))]">
                  Nå: {row.currentPrice.toFixed(0)} kr → Forslag: {row.suggestedPrice.toFixed(0)} kr · Δ {row.delta.toFixed(0)} kr (
                  {(row.deltaPct * 100).toFixed(1)} %)
                </p>
                <p className="mt-1 text-[rgb(var(--lp-muted))]">{row.rationale}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Prisoptimalisering</h2>
          <DataTrustBadge kind="DEMO" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Margin-, etterspørsel- og elastisitetsbaserte forslag. Systemet endrer aldri pris automatisk — knappene logger kun godkjenning/avvisning
          for sporbarhet (ingen katalogoppdatering).
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[rgb(var(--lp-border))] bg-white/90">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs text-[rgb(var(--lp-text))]">
            <thead>
              <tr className="border-b border-[rgb(var(--lp-border))] text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                <th className="px-3 py-2 font-medium">Produkt</th>
                <th className="px-3 py-2 font-medium text-right">Nåpris</th>
                <th className="px-3 py-2 font-medium text-right">Forslag</th>
                <th className="px-3 py-2 font-medium text-right">Margin %</th>
                <th className="px-3 py-2 font-medium text-right">Etterspørsel</th>
                <th className="px-3 py-2 font-medium">Elastisitet</th>
                <th className="px-3 py-2 font-medium">Handling</th>
              </tr>
            </thead>
            <tbody>
              {priceOptimizationRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-3 text-center text-[rgb(var(--lp-muted))]">
                    Ingen prisrader (mangler kost/pris i demo-katalog).
                  </td>
                </tr>
              ) : (
                priceOptimizationRows.map((row) => (
                  <tr key={row.productId} className="border-b border-[rgb(var(--lp-border))]/80 align-top">
                    <td className="px-3 py-2">
                      <span className="font-medium text-[rgb(var(--lp-fg))]">{row.productName}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-[rgb(var(--lp-muted))]">{row.productId}</span>
                      {row.procurementUnitCost != null ? (
                        <span className="mt-1 block text-[10px] text-[rgb(var(--lp-muted))]">
                          Innkjøp ref.: {row.procurementUnitCost.toFixed(2)} kr/enh.
                        </span>
                      ) : null}
                      {row.notes.length > 0 ? (
                        <ul className="mt-1 list-disc pl-4 text-[10px] text-[rgb(var(--lp-muted))]">
                          {row.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{row.currentPrice.toFixed(0)} kr</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {row.suggestedPrice.toFixed(0)} kr
                      {row.rawSuggested !== row.suggestedPrice ? (
                        <span className="mt-0.5 block text-[10px] text-[rgb(var(--lp-muted))]">
                          Rå: {row.rawSuggested.toFixed(0)} kr
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[10px]">
                      {row.marginBeforePct.toFixed(1)} → {row.marginAfterPct.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {row.demandLabel}
                      <span className="mt-0.5 block text-[10px] text-[rgb(var(--lp-muted))]">({row.demandScore})</span>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-[rgb(var(--lp-muted))]">
                      <span className="font-mono text-[rgb(var(--lp-text))]">{row.elasticity}</span>
                      <span className="mt-0.5 block">{row.elasticityNb}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
                        <button
                          type="button"
                          disabled={isPending || row.currentPrice <= 0}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-[10px] font-medium text-[rgb(var(--lp-fg))] disabled:opacity-40"
                          onClick={() =>
                            startTransition(() => {
                              void (async () => {
                                setMessage(null);
                                const r = await socialEnginePricingStrategyDecisionAction({
                                  decision: "approve",
                                  productId: row.productId,
                                  productName: row.productName,
                                  oldPrice: row.currentPrice,
                                  suggestedPrice: row.suggestedPrice,
                                  rawSuggested: row.rawSuggested,
                                  marginBeforePct: row.marginBeforePct,
                                  marginAfterPct: row.marginAfterPct,
                                  elasticity: row.elasticity,
                                  demandScore: row.demandScore,
                                  guardPassed: row.guardPassed,
                                });
                                if (!r.ok) {
                                  setMessage(r.error ?? "Kunne ikke logge");
                                  return;
                                }
                                setMessage(
                                  `Prisforslag logget som godkjent (kun audit) for «${row.productName}». Ingen pris er endret i systemet.`,
                                );
                              })();
                            })
                          }
                        >
                          Godkjenn pris
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-[10px] font-medium text-[rgb(var(--lp-fg))] disabled:opacity-40"
                          onClick={() =>
                            startTransition(() => {
                              void (async () => {
                                setMessage(null);
                                const r = await socialEnginePricingStrategyDecisionAction({
                                  decision: "reject",
                                  productId: row.productId,
                                  productName: row.productName,
                                  oldPrice: row.currentPrice,
                                  suggestedPrice: row.suggestedPrice,
                                  rawSuggested: row.rawSuggested,
                                  marginBeforePct: row.marginBeforePct,
                                  marginAfterPct: row.marginAfterPct,
                                  elasticity: row.elasticity,
                                  demandScore: row.demandScore,
                                  guardPassed: row.guardPassed,
                                });
                                if (!r.ok) {
                                  setMessage(r.error ?? "Kunne ikke logge");
                                  return;
                                }
                                setMessage(`Prisforslag avvist (logget) for «${row.productName}».`);
                              })();
                            })
                          }
                        >
                          Avvis
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Leverandørforhandling</h2>
          <DataTrustBadge kind="DEMO" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Sammenligning mot enkel peer-median blant demo-leverandører. Ingen automatisk henvendelse — «Send forespørsel» logger kun intensjon for
          oppfølging utenfor portalen.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[rgb(var(--lp-border))] bg-white/90">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs text-[rgb(var(--lp-text))]">
            <thead>
              <tr className="border-b border-[rgb(var(--lp-border))] text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                <th className="px-3 py-2 font-medium">Produkt</th>
                <th className="px-3 py-2 font-medium">Leverandør</th>
                <th className="px-3 py-2 font-medium text-right">Kr/enhet</th>
                <th className="px-3 py-2 font-medium text-right">Markedsref.</th>
                <th className="px-3 py-2 font-medium">Forslag</th>
                <th className="px-3 py-2 font-medium">Handling</th>
              </tr>
            </thead>
            <tbody>
              {supplierNegotiationRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-[rgb(var(--lp-muted))]">
                    Ingen leverandørrader (demo).
                  </td>
                </tr>
              ) : (
                supplierNegotiationRows.map((row) => (
                  <tr key={`${row.productId}-${row.supplierId}`} className="border-b border-[rgb(var(--lp-border))]/80 align-top">
                    <td className="px-3 py-2">
                      <span className="font-medium text-[rgb(var(--lp-fg))]">{row.productName}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-[rgb(var(--lp-muted))]">{row.productId}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{row.supplierName}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-[rgb(var(--lp-muted))]">{row.supplierId}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{row.supplierPricePerUnit.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {row.marketReference > 0 ? row.marketReference.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-[rgb(var(--lp-muted))]">
                      <span className="font-medium text-[rgb(var(--lp-fg))]">
                        {row.negotiation.action === "negotiate_down" ? "Forhandle ned" : "OK"}
                      </span>
                      <span className="mt-0.5 block">{row.negotiation.message}</span>
                      {row.negotiation.action === "negotiate_down" ? (
                        <span className="mt-0.5 block font-mono">
                          Målpris: {row.negotiation.targetPrice.toFixed(2)} kr/enhet
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
                        <button
                          type="button"
                          disabled={isPending}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-[10px] font-medium text-[rgb(var(--lp-fg))] disabled:opacity-40"
                          onClick={() =>
                            startTransition(() => {
                              void (async () => {
                                setMessage(null);
                                const r = await socialEngineSupplierNegotiationIntentAction({
                                  productId: row.productId,
                                  productName: row.productName,
                                  supplierId: row.supplierId,
                                  supplierName: row.supplierName,
                                  negotiationAction: "send_supplier_request",
                                  targetPrice:
                                    row.negotiation.action === "negotiate_down" ? row.negotiation.targetPrice : null,
                                  marketReference: row.marketReference > 0 ? row.marketReference : null,
                                  message: row.negotiation.message,
                                });
                                if (!r.ok) {
                                  setMessage(r.error ?? "Kunne ikke logge");
                                  return;
                                }
                                setMessage(
                                  `Leverandørforespørsel logget (intensjon) for «${row.supplierName}» / «${row.productName}».`,
                                );
                              })();
                            })
                          }
                        >
                          Send forespørsel leverandør
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-[10px] font-medium text-[rgb(var(--lp-fg))] disabled:opacity-40"
                          onClick={() =>
                            startTransition(() => {
                              void (async () => {
                                setMessage(null);
                                const r = await socialEngineSupplierNegotiationIntentAction({
                                  productId: row.productId,
                                  productName: row.productName,
                                  supplierId: row.supplierId,
                                  supplierName: row.supplierName,
                                  negotiationAction: "decline_negotiation_follow_up",
                                  targetPrice:
                                    row.negotiation.action === "negotiate_down" ? row.negotiation.targetPrice : null,
                                  marketReference: row.marketReference > 0 ? row.marketReference : null,
                                  message: row.negotiation.message,
                                });
                                if (!r.ok) {
                                  setMessage(r.error ?? "Kunne ikke logge");
                                  return;
                                }
                                setMessage(`Avvist forhandlingsoppfølging logget for «${row.supplierName}».`);
                              })();
                            })
                          }
                        >
                          Avvis
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Etterspørsel & Meny</h2>
          <DataTrustBadge kind="DEMO" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Glidende snitt, enkel trend og ukedagslift fra kalenderens dokumenterte konverterings-/lead-felter. Forslag til innkjøp og ukesmeny er
          kun beslutningsstøtte — ingen auto-bestilling eller menybytte.
        </p>
        {!demandMenuPlan.ok ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-center text-xs text-amber-950 sm:text-left">
            {demandMenuPlan.message}
          </p>
        ) : (
          <>
            <p className="mt-2 text-center text-[10px] text-[rgb(var(--lp-muted))] sm:text-left">{demandMenuPlan.message}</p>
            <p className="mt-1 text-center text-[10px] text-[rgb(var(--lp-muted))] sm:text-left">
              Horisont: {demandMenuPlan.horizonDays} dager · observasjonspunkter: {demandMenuPlan.totalSalesPoints}
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-[rgb(var(--lp-border))] bg-white/90">
              <table className="w-full min-w-[360px] border-collapse text-left text-xs text-[rgb(var(--lp-text))]">
                <thead>
                  <tr className="border-b border-[rgb(var(--lp-border))] text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                    <th className="px-3 py-2 font-medium">Produkt</th>
                    <th className="px-3 py-2 font-medium text-right">Enheter/dag</th>
                    <th className="px-3 py-2 font-medium text-right">Konfidens</th>
                    <th className="px-3 py-2 font-medium text-center">Trend</th>
                    <th className="px-3 py-2 font-medium">Ukedag</th>
                    <th className="px-3 py-2 font-medium text-right">Sikker lager</th>
                    <th className="px-3 py-2 font-medium text-right">Innkjøp (forslag)</th>
                  </tr>
                </thead>
                <tbody>
                  {demandMenuPlan.products.map((row) => (
                    <tr
                      key={row.productId}
                      className={
                        row.insufficientData
                          ? "border-b border-[rgb(var(--lp-border))]/80 bg-amber-50/40"
                          : "border-b border-[rgb(var(--lp-border))]/80"
                      }
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium text-[rgb(var(--lp-fg))]">{row.name}</span>
                        <span className="mt-0.5 block font-mono text-[10px] text-[rgb(var(--lp-muted))]">{row.productId}</span>
                        {row.insufficientData ? (
                          <span className="mt-1 block text-[10px] text-amber-900">Begrenset historikk (&lt; 3 punkter)</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{row.forecastPerDay.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono">{(row.confidence * 100).toFixed(0)} %</td>
                      <td className="px-3 py-2 text-center font-mono" title={row.trend.dir}>
                        {row.trendArrow} {row.trend.strength > 0 ? row.trend.strength.toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-[rgb(var(--lp-muted))]">
                        {row.weekdayLift.length === 0
                          ? "—"
                          : row.weekdayLift.map((w) => `${w.label}×${w.multiplier}`).join(" · ")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{row.safetyUnits}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-mono">{row.suggestedPurchase.suggestedUnits}</span>
                        <span className="mt-0.5 block text-[10px] text-[rgb(var(--lp-muted))]">{row.suggestedPurchase.note}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-3">
              <p className="text-xs font-medium text-[rgb(var(--lp-fg))]">Optimalisert ukesmeny (kun produkter med lager &gt; 0)</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-[rgb(var(--lp-text))]">
                {demandMenuPlan.weeklyMenu.length === 0 ? (
                  <li className="text-[rgb(var(--lp-muted))]">Ingen kandidater med lager.</li>
                ) : (
                  demandMenuPlan.weeklyMenu.map((m) => {
                    const label =
                      demandMenuPlan.products.find((p) => p.productId === m.productId)?.name ?? m.productId;
                    return (
                      <li key={m.productId}>
                        <span className="font-medium">{label}</span>
                        <span className="font-mono text-[rgb(var(--lp-muted))]">
                          {" "}
                          · score {m.score.toFixed(1)} · margin {(m.margin * 100).toFixed(1)} % · forecast {m.forecast.toFixed(2)}/dag
                        </span>
                      </li>
                    );
                  })
                )}
              </ol>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Innkjøp</h2>
          <DataTrustBadge kind="DEMO" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Etterspørsel/meny → rangert leverandør og mengdeforslag. Ingen auto-bestilling: knappene logger kun beslutningsintensjon for sporbarhet;
          faktisk ordre må gjøres i egen innkjøpsprosess med manuell godkjenning.
        </p>
        {!procurementPlan.ok ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-center text-xs text-amber-950 sm:text-left">
            {procurementPlan.message}
          </p>
        ) : (
          <>
            <p className="mt-2 text-center text-[10px] text-[rgb(var(--lp-muted))] sm:text-left">{procurementPlan.message}</p>
            <p className="mt-1 text-center text-[10px] font-mono text-[rgb(var(--lp-muted))] sm:text-left">
              Gyldige forslag (passerer kosttak): {procurementPlan.totalSuggestedQtyValid} enheter ·{" "}
              {procurementPlan.totalSuggestedCostValid.toFixed(0)} kr · horisont {procurementPlan.horizonDays} d
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-[rgb(var(--lp-border))] bg-white/90">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs text-[rgb(var(--lp-text))]">
                <thead>
                  <tr className="border-b border-[rgb(var(--lp-border))] text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                    <th className="px-3 py-2 font-medium">Produkt</th>
                    <th className="px-3 py-2 font-medium">Meny</th>
                    <th className="px-3 py-2 font-medium">Leverandør</th>
                    <th className="px-3 py-2 font-medium text-right">Kr/enhet</th>
                    <th className="px-3 py-2 font-medium text-right">Antall</th>
                    <th className="px-3 py-2 font-medium text-right">Total</th>
                    <th className="px-3 py-2 font-medium text-right">Levering</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {procurementPlan.rows.map((row) => {
                    const s = row.suggestion;
                    return (
                      <tr
                        key={row.productId}
                        className={
                          row.menuPriority
                            ? "border-b border-[rgb(var(--lp-border))]/80 bg-amber-50/50"
                            : "border-b border-[rgb(var(--lp-border))]/80"
                        }
                      >
                        <td className="px-3 py-2">
                          <span className="font-medium text-[rgb(var(--lp-fg))]">{row.productName}</span>
                          <span className="mt-0.5 block font-mono text-[10px] text-[rgb(var(--lp-muted))]">{row.productId}</span>
                        </td>
                        <td className="px-3 py-2 text-[rgb(var(--lp-muted))]">{row.menuPriority ? "Ja" : "—"}</td>
                        <td className="px-3 py-2">
                          {s ? (
                            <>
                              <span className="font-medium">{s.supplierName}</span>
                              <span className="mt-0.5 block font-mono text-[10px] text-[rgb(var(--lp-muted))]">{s.supplierId}</span>
                            </>
                          ) : (
                            <span className="text-[rgb(var(--lp-muted))]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{s ? s.pricePerUnit.toFixed(2) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{s ? s.suggestedQty : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{s ? `${Math.round(s.estimatedCost)} kr` : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{s ? `${s.deliveryDays} d` : "—"}</td>
                        <td className="px-3 py-2 text-[10px] text-[rgb(var(--lp-muted))]">
                          {row.skipReason ? (
                            <span className="text-amber-900">{row.skipReason}</span>
                          ) : row.valid ? (
                            <span className="text-emerald-800">OK for vurdering</span>
                          ) : (
                            <span className="text-amber-900">{row.blockReason ?? "Blokkert"}</span>
                          )}
                          <span className="mt-1 block text-[9px]">
                            Godkjenning: {row.approval.approved ? "Ja" : "Nei"} — {row.approval.reason}
                          </span>
                          {s && s.ranking.length > 0 ? (
                            <span className="mt-1 block break-all text-[9px]">
                              Rang:{" "}
                              {s.ranking
                                .slice(0, 4)
                                .map((r) => `${r.name} (${r.score})`)
                                .join(" · ")}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          {s ? (
                            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
                              <button
                                type="button"
                                disabled={isPending || !row.valid}
                                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-[10px] font-medium text-[rgb(var(--lp-fg))] disabled:opacity-40"
                                onClick={() =>
                                  startTransition(() => {
                                    void (async () => {
                                      setMessage(null);
                                      const r = await socialEngineProcurementDecisionAction({
                                        decision: "approve",
                                        productId: row.productId,
                                        productName: row.productName,
                                        supplierId: s.supplierId,
                                        supplierName: s.supplierName,
                                        suggestedQty: s.suggestedQty,
                                        estimatedCost: s.estimatedCost,
                                        deliveryDays: s.deliveryDays,
                                        valid: row.valid,
                                        blockReason: row.blockReason,
                                      });
                                      if (!r.ok) {
                                        setMessage(r.error ?? "Kunne ikke logge");
                                        return;
                                      }
                                      setMessage(
                                        `Innkjøp logget (godkjenningsintensjon for «${row.productName}»). Ingen ordre er opprettet automatisk.`,
                                      );
                                    })();
                                  })
                                }
                              >
                                Godkjenn innkjøp
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-[10px] font-medium text-[rgb(var(--lp-fg))] disabled:opacity-40"
                                onClick={() =>
                                  startTransition(() => {
                                    void (async () => {
                                      setMessage(null);
                                      const r = await socialEngineProcurementDecisionAction({
                                        decision: "reject",
                                        productId: row.productId,
                                        productName: row.productName,
                                        supplierId: s?.supplierId,
                                        supplierName: s?.supplierName,
                                        suggestedQty: s?.suggestedQty,
                                        estimatedCost: s?.estimatedCost,
                                        deliveryDays: s?.deliveryDays,
                                        valid: row.valid,
                                        blockReason: row.blockReason,
                                      });
                                      if (!r.ok) {
                                        setMessage(r.error ?? "Kunne ikke logge");
                                        return;
                                      }
                                      setMessage(`Avvisning logget for «${row.productName}».`);
                                    })();
                                  })
                                }
                              >
                                Avvis
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[rgb(var(--lp-muted))]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Forsterkning</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Omsetningsdrevet klassifisering av publiserte poster (batch-normalisert score). Vinnere kan skaleres, tapere deprioriteres — med
          tak per kjøring og policy.
        </p>
        <dl className="mt-3 grid gap-2 text-center text-sm text-[rgb(var(--lp-text))] sm:grid-cols-2">
          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">Vinnere (nå)</dt>
            <dd className="font-heading text-lg font-semibold">
              {[...reinforcementClassByPostId.values()].filter((c) => c === "winner").length}
            </dd>
          </div>
          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">Tapere (nå)</dt>
            <dd className="font-heading text-lg font-semibold">
              {[...reinforcementClassByPostId.values()].filter((c) => c === "loser").length}
            </dd>
          </div>
        </dl>
        {lastCycle ? (
          <div className="mt-3 rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-white/70 px-3 py-2 text-center text-xs text-[rgb(var(--lp-text))] sm:text-left">
            <p className="font-medium text-[rgb(var(--lp-fg))]">Siste syklus — handlinger</p>
            <p className="mt-1 text-[rgb(var(--lp-muted))]">
              Skalering utført: <strong>{lastCycle.reinforcement.scalingExecuted}</strong> (foreslått{" "}
              {lastCycle.reinforcement.scalingProposed}) · Undertrykking utført:{" "}
              <strong>{lastCycle.reinforcement.suppressionExecuted}</strong> (foreslått{" "}
              {lastCycle.reinforcement.suppressionProposed}) · Vinnere/tapere i batch:{" "}
              <strong>{lastCycle.reinforcement.winnersCount}</strong> / <strong>{lastCycle.reinforcement.losersCount}</strong>
            </p>
            {(lastCycle.reinforcement.winnerIds.length > 0 || lastCycle.reinforcement.loserIds.length > 0) && (
              <p className="mt-2 break-all font-mono text-[10px] text-[rgb(var(--lp-muted))]">
                Vinner-ID: {lastCycle.reinforcement.winnerIds.join(", ") || "—"} · Taper-ID:{" "}
                {lastCycle.reinforcement.loserIds.join(", ") || "—"}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
            Kjør «Kjør AI nå» for å se utførte forsterkningshandlinger i siste syklus.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">AI Video Studio</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Kort annonsevideo (5–20 s): hook først (2–3 s), CMS-bilder/video, norsk stemmeprofil (varm, lett trøndersk), undertekster synket til
          tidslinje. Leverandør er adapter-basert — uten registrert provider faller vi trygt tilbake til struktur + manus (ingen hard API-avhengighet).
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <button
            type="button"
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() =>
              startTransition(() => {
                void (async () => {
                  setMessage(null);
                  const r = await socialEngineGenerateVideoAction(postsJson);
                  if (!r.ok) {
                    setMessage(r.error ?? "Feil");
                    setVideoPreview(null);
                    return;
                  }
                  setVideoPreview({
                    productId: r.productId,
                    productName: r.productName,
                    hooks: r.hooks,
                    selectedHook: r.selectedHook,
                    alternatives: r.alternatives,
                    conversionVideoId: r.conversionVideoId,
                    conversion: r.conversion,
                    script: r.script,
                    structure: r.structure,
                    media: r.media,
                    missingAssets: r.missingAssets,
                    totalDurationSec: r.totalDurationSec,
                    captions: r.captions,
                    voice: {
                      voice: r.voice.voice,
                      toneProfile: r.voice.toneProfile,
                      directionNotes: r.voice.directionNotes,
                      audioUrl: r.voice.audioUrl,
                    },
                    providerStatus: {
                      name: r.providerStatus.name,
                      used: r.providerStatus.used,
                      kind: r.providerStatus.kind,
                    },
                    previewUrl: r.previewUrl,
                    videoUrl: r.videoUrl,
                    previewFrames: r.previewFrames,
                    localRender: r.localRender,
                  });
                  const prov =
                    r.providerStatus.used && r.providerStatus.name
                      ? `Provider: ${r.providerStatus.name}.`
                      : "Ingen ekstern video-provider registrert.";
                  const local =
                    r.videoUrl != null
                      ? `Lokal MP4: ${r.videoUrl}.`
                      : `Lokal render: ${r.localRender.engine}${r.localRender.engine === "none" ? ` (${r.localRender.reason})` : ""}.`;
                  const aud = r.voice.audioUrl ? "TTS-URL mottatt." : "TTS: tekst-only fallback (ingen ekstern stemme ennå).";
                  setMessage(
                    `«${r.productName}» · ${r.totalDurationSec}s · ${prov} ${local} ${aud} ${r.missingAssets.images ? "Mangler CMS-bilder. " : ""}${r.missingAssets.videos ? "Ingen CMS-video-URL. " : ""}`.trim(),
                  );
                })();
              })
            }
          >
            Generer video
          </button>
          <button
            type="button"
            disabled={
              isPending ||
              !videoPreview ||
              !(videoPreview.videoUrl || videoPreview.previewUrl)
            }
            className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() =>
              startTransition(() => {
                void (async () => {
                  if (!videoPreview) return;
                  setMessage(null);
                  const r = await socialEngineBuildAdCampaignAction(postsJson, {
                    productId: videoPreview.productId,
                    productName: videoPreview.productName,
                    videoUrl: videoPreview.videoUrl,
                    previewUrl: videoPreview.previewUrl,
                    hook: videoPreview.script.hook,
                    cta: videoPreview.script.cta,
                    conversionVideoId: videoPreview.conversionVideoId,
                  });
                  if (!r.ok) {
                    setMessage(r.error ?? "Kunne ikke opprette annonseutkast");
                    return;
                  }
                  setAdCampaignRows((prev) => [
                    ...prev,
                    {
                      localId:
                        typeof crypto !== "undefined" && crypto.randomUUID
                          ? crypto.randomUUID()
                          : `ad_${Date.now()}`,
                      campaign: r.campaign,
                      budgetDraft: 0,
                      spendDraft: 0,
                      roasPaused: false,
                      roasProof: null,
                      roasProofExpiresAt: null,
                      uiStatus: "pending",
                      approvalProof: null,
                      expiresAt: null,
                      publishResult: null,
                      lastError: null,
                    },
                  ]);
                  const lowStock =
                    r.ok && "economicsHint" in r && r.economicsHint?.lowStockPriorityReduction
                      ? " Lavt lager: lavere annonseprioritet i modellen (ingen auto-budsjett)."
                      : "";
                  setMessage(
                    `Annonseutkast: ${r.campaign.name}. Sett dagsbudsjett (NOK) over 0, deretter «Godkjenn» → «Publiser». Ingen auto-spend.${lowStock}`,
                  );
                })();
              })
            }
          >
            Opprett annonse
          </button>
        </div>
        {videoPreview ? (
          <div className="mt-4 space-y-3 text-center text-sm text-[rgb(var(--lp-text))] sm:text-left">
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Produkt: <span className="font-mono text-[rgb(var(--lp-fg))]">{videoPreview.productId}</span> ·{" "}
              {videoPreview.productName}
            </p>
            <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-xs">
              <p className="font-medium text-[rgb(var(--lp-fg))]">Leverandørstatus</p>
              <p className="mt-1 text-[rgb(var(--lp-muted))]">
                Modus: <span className="font-mono">{videoPreview.providerStatus.kind}</span>
                {videoPreview.providerStatus.name ? (
                  <>
                    {" "}
                    · <span className="font-mono">{videoPreview.providerStatus.name}</span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-xs">
              <p className="font-medium text-[rgb(var(--lp-fg))]">Konvertering (målt / prioritert)</p>
              <dl className="mt-2 grid gap-1 text-left text-[11px] text-[rgb(var(--lp-muted))] sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-[rgb(var(--lp-text))]">Hook-styrke (score)</dt>
                  <dd className="font-mono">{videoPreview.conversion.selectedHookStrength}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[rgb(var(--lp-text))]">Hook-type</dt>
                  <dd className="font-mono">{videoPreview.conversion.selectedHookType}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[rgb(var(--lp-text))]">Snitt hook-retention %</dt>
                  <dd className="font-mono">
                    {videoPreview.conversion.aggregateHookRetentionPct != null
                      ? `${videoPreview.conversion.aggregateHookRetentionPct.toFixed(1)} %`
                      : "— (ingen video-data)"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[rgb(var(--lp-text))]">Snitt video-konv. %</dt>
                  <dd className="font-mono">
                    {videoPreview.conversion.aggregateVideoConversionRatePct != null
                      ? `${videoPreview.conversion.aggregateVideoConversionRatePct.toFixed(1)} %`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[rgb(var(--lp-text))]">Snitt fullføring %</dt>
                  <dd className="font-mono">
                    {videoPreview.conversion.aggregateCompletionPct != null
                      ? `${videoPreview.conversion.aggregateCompletionPct.toFixed(1)} %`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[rgb(var(--lp-text))]">Drop-off diagnose</dt>
                  <dd className="font-mono">{videoPreview.conversion.dropOffDiagnosis ?? "—"}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[10px] text-[rgb(var(--lp-muted))]">
                <span className="font-medium text-[rgb(var(--lp-fg))]">Beste hook (data):</span>{" "}
                {videoPreview.conversion.bestHookFromData ?? "—"}
              </p>
              <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
                <span className="font-medium text-[rgb(var(--lp-fg))]">Dårligste hook (data):</span>{" "}
                {videoPreview.conversion.worstHookFromData ?? "—"}
              </p>
              {videoPreview.conversion.improvementsSuggested.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-left text-[10px] text-[rgb(var(--lp-muted))]">
                  {videoPreview.conversion.improvementsSuggested.map((line, i) => (
                    <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 break-all font-mono text-[10px] text-[rgb(var(--lp-muted))]">
                A/B-ID: {videoPreview.conversionVideoId} · {videoPreview.conversion.abVariants.length} varianter
              </p>
            </div>
            {videoPreview.videoUrl || videoPreview.previewUrl ? (
              <div className="mx-auto max-w-sm sm:mx-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Video</p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption -- undertekster vises under */}
                <video
                  src={videoPreview.videoUrl ?? videoPreview.previewUrl ?? undefined}
                  controls
                  className="mt-2 max-h-64 w-full rounded-lg border border-[rgb(var(--lp-border))] object-contain"
                  playsInline
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-white/70 px-3 py-2 text-xs text-[rgb(var(--lp-muted))]">
                <p className="font-medium text-[rgb(var(--lp-fg))]">Struktur (ingen avspillbar video ennå)</p>
                <p className="mt-1">
                  Lokal ffmpeg er ikke tilgjengelig eller rendering feilet — tidslinje og manus vises under. Installer ffmpeg på serveren for MP4-output.
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Valgt hook (første scene)</p>
              <p className="mt-1 font-medium text-[rgb(var(--lp-fg))]">{videoPreview.selectedHook}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Stemme</p>
              <p className="mt-1 font-mono text-[11px] text-[rgb(var(--lp-text))]">{videoPreview.voice.voice}</p>
              <p className="mt-0.5 text-[11px] text-[rgb(var(--lp-muted))]">Profil: {videoPreview.voice.toneProfile}</p>
              <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">{videoPreview.voice.directionNotes}</p>
              <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
                Lyd: {videoPreview.voice.audioUrl ? "URL tilgjengelig" : "null (fallback)"}
              </p>
              {videoPreview.voice.audioUrl ? (
                <audio controls src={videoPreview.voice.audioUrl} className="mt-2 w-full max-w-sm" />
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Undertekster (synket)</p>
              <ul className="mt-1 space-y-1 text-left text-[11px] text-[rgb(var(--lp-muted))]">
                {videoPreview.captions.map((c, i) => (
                  <li key={`${i}-${c.start}`}>
                    <span className="font-mono">
                      {c.start.toFixed(1)}–{c.end.toFixed(1)}s
                    </span>
                    {c.emphasis === "hook" ? (
                      <span className="ml-2 font-semibold text-[rgb(var(--lp-fg))]">{c.text}</span>
                    ) : (
                      <span className="ml-2">{c.text}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                Hook-rangering (konverteringsmotor)
              </p>
              <ul className="mt-1 space-y-1.5 text-left text-[11px] text-[rgb(var(--lp-muted))]">
                {videoPreview.conversion.hookRanking.map((row, i) => (
                  <li
                    key={`${i}-${row.hook.slice(0, 28)}`}
                    className={i === 0 ? "font-semibold text-[rgb(var(--lp-fg))]" : ""}
                  >
                    <span className="font-mono text-[10px]">
                      #{i + 1} · {row.type} · styrke {row.strength}
                    </span>
                    <span className="mt-0.5 block">{row.hook}</span>
                  </li>
                ))}
              </ul>
              {videoPreview.alternatives.length > 0 ? (
                <p className="mt-2 text-[10px] text-[rgb(var(--lp-muted))]">
                  <span className="font-medium text-[rgb(var(--lp-fg))]">Alternativer (øvrige):</span>{" "}
                  {videoPreview.alternatives.length} stk.
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">CMS-media (URL)</p>
              <p className="mt-1 break-all font-mono text-[10px] text-[rgb(var(--lp-muted))]">
                Bilder: {videoPreview.media.images.length ? videoPreview.media.images.join(" | ") : "—"}{" "}
              </p>
              <p className="mt-1 break-all font-mono text-[10px] text-[rgb(var(--lp-muted))]">
                Video: {videoPreview.media.videos.length ? videoPreview.media.videos.join(" | ") : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                Manus + struktur (JSON)
                {videoPreview.videoUrl || videoPreview.previewUrl ? (
                  <span className="ml-2 font-normal normal-case text-[rgb(var(--lp-muted))]">— detaljer</span>
                ) : null}
              </p>
              <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[rgb(var(--lp-border))] bg-white/80 p-2 text-left text-[10px] text-[rgb(var(--lp-muted))]">
                {JSON.stringify({ script: videoPreview.script, structure: videoPreview.structure }, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
            Ingen forhåndsvisning ennå — trykk «Generer video».
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Annonser</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Koblet til AI-video: forhåndsvisning, kampanjenavn, sporbar postId og registrert omsetning per produkt. Godkjenning (server-HMAC) og positivt budsjett kreves før «Publiser». Uten ads-provider returneres trygt «no_provider» — ingen pengebruk.
        </p>
        {adCampaignRows.length === 0 ? (
          <p className="mt-3 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
            Ingen annonseutkast — generer video og bruk «Opprett annonse».
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {adCampaignRows.map((row) => {
              const creative = row.campaign.creative;
              const rev = revenueByProductId.get(row.campaign.productId) ?? 0;
              const statusNb =
                row.uiStatus === "published"
                  ? "publisert / forsøkt"
                  : row.uiStatus === "approved"
                    ? "godkjent"
                    : "venter godkjenning";
              return (
                <li
                  key={row.localId}
                  className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-3 text-sm text-[rgb(var(--lp-text))]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="mx-auto max-w-xs sm:mx-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                        Video (creativ)
                      </p>
                      {creative ? (
                        /* eslint-disable-next-line jsx-a11y/media-has-caption -- hook-tekst under */
                        <video
                          src={creative}
                          controls
                          className="mt-1 max-h-40 w-full rounded-lg border border-[rgb(var(--lp-border))] object-contain"
                          playsInline
                        />
                      ) : (
                        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Mangler URL</p>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                      <p className="font-medium text-[rgb(var(--lp-fg))]">{row.campaign.name}</p>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">{row.campaign.text}</p>
                      <p className="font-mono text-[10px] text-[rgb(var(--lp-muted))]">
                        postId: {row.campaign.postId ?? "—"} · produkt: {row.campaign.productId} · registrert omsetning:{" "}
                        {rev.toFixed(0)} kr
                      </p>
                      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
                        <label className="flex items-center gap-2 text-xs">
                          <span className="text-[rgb(var(--lp-muted))]">Budsjett (NOK)</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={row.uiStatus === "published" || isPending}
                            value={row.budgetDraft}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setAdCampaignRows((prev) =>
                                prev.map((x) =>
                                  x.localId === row.localId
                                    ? {
                                        ...x,
                                        budgetDraft: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0,
                                        approvalProof: null,
                                        expiresAt: null,
                                        roasProof: null,
                                        roasProofExpiresAt: null,
                                        uiStatus: x.uiStatus === "published" ? x.uiStatus : "pending",
                                        lastError:
                                          x.approvalProof != null
                                            ? "Budsjett endret — godkjenn på nytt."
                                            : x.lastError,
                                      }
                                    : x,
                                ),
                              );
                            }}
                            className="w-28 rounded-lg border border-[rgb(var(--lp-border))] px-2 py-1 font-mono text-sm"
                          />
                        </label>
                        <span className="rounded-full border border-[rgb(var(--lp-border))] px-2 py-0.5 text-[10px] text-[rgb(var(--lp-muted))]">
                          Status: {statusNb}
                        </span>
                      </div>
                      {row.lastError ? (
                        <p className="text-xs text-rose-800">{row.lastError}</p>
                      ) : null}
                      {row.publishResult ? (
                        <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded border border-dashed border-[rgb(var(--lp-border))] bg-white/80 p-2 text-left text-[10px] text-[rgb(var(--lp-muted))]">
                          {JSON.stringify(row.publishResult, null, 2)}
                        </pre>
                      ) : null}
                      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                        <button
                          type="button"
                          disabled={
                            isPending ||
                            row.uiStatus === "published" ||
                            row.budgetDraft <= 0
                          }
                          className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
                          onClick={() =>
                            startTransition(() => {
                              void (async () => {
                                setMessage(null);
                                const r = await socialEngineApproveAdCampaignAction(row.campaign, row.budgetDraft);
                                if (!r.ok) {
                                  setAdCampaignRows((prev) =>
                                    prev.map((x) =>
                                      x.localId === row.localId ? { ...x, lastError: r.error } : x,
                                    ),
                                  );
                                  setMessage(r.error);
                                  return;
                                }
                                setAdCampaignRows((prev) =>
                                  prev.map((x) =>
                                    x.localId === row.localId
                                      ? {
                                          ...x,
                                          approvalProof: r.proof,
                                          expiresAt: r.expiresAt,
                                          uiStatus: "approved",
                                          lastError: null,
                                        }
                                      : x,
                                  ),
                                );
                                setMessage("Godkjent — du kan nå «Publiser» (krever ads-provider).");
                              })();
                            })
                          }
                        >
                          Godkjenn
                        </button>
                        <button
                          type="button"
                          disabled={
                            isPending ||
                            row.uiStatus === "published" ||
                            row.budgetDraft <= 0 ||
                            !row.approvalProof
                          }
                          className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
                          onClick={() =>
                            startTransition(() => {
                              void (async () => {
                                if (!row.approvalProof) return;
                                setMessage(null);
                                const r = await socialEnginePublishAdCampaignAction(
                                  row.campaign,
                                  row.budgetDraft,
                                  row.approvalProof,
                                );
                                if (!r.ok) {
                                  setAdCampaignRows((prev) =>
                                    prev.map((x) =>
                                      x.localId === row.localId ? { ...x, lastError: r.error } : x,
                                    ),
                                  );
                                  setMessage(r.error);
                                  return;
                                }
                                setAdCampaignRows((prev) =>
                                  prev.map((x) =>
                                    x.localId === row.localId
                                      ? {
                                          ...x,
                                          uiStatus: "published",
                                          publishResult:
                                            r.result && typeof r.result === "object"
                                              ? (r.result as Record<string, unknown>)
                                              : {},
                                          lastError: null,
                                        }
                                      : x,
                                  ),
                                );
                                setMessage("Publiseringsforsøk fullført — se status i JSON under.");
                              })();
                            })
                          }
                        >
                          Publiser
                        </button>
                        <button
                          type="button"
                          disabled={isPending || row.uiStatus === "published" || !row.approvalProof}
                          className="inline-flex min-h-[44px] items-center rounded-full border border-dashed border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-muted))] disabled:opacity-50"
                          onClick={() =>
                            startTransition(() => {
                              void (async () => {
                                await socialEngineRevertAdApprovalAction(row.campaign.name);
                                setAdCampaignRows((prev) =>
                                  prev.map((x) =>
                                    x.localId === row.localId
                                      ? {
                                          ...x,
                                          approvalProof: null,
                                          expiresAt: null,
                                          uiStatus: "pending",
                                          lastError: null,
                                        }
                                      : x,
                                  ),
                                );
                                setMessage("Godkjenning tilbakestilt.");
                              })();
                            })
                          }
                        >
                          Angre godkjenning
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Profit-kontroll</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Profit-first motor: kun lønnsomme kampanjer får skaleringsforslag (+15 %, maks +25 %/døgn). Tap kappes raskt
          (pause under ROAS 1, reduksjon under 1,5). Harde tak: dagsbudsjett 5 000 kr, kontosum spend 20 000 kr,
          kill-switch ved høy spend og lav ROAS. Kun analyse og logging her — ingen auto-exec.
        </p>
        {adCampaignRows.length === 0 ? (
          <p className="mt-3 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
            Opprett annonseutkast for profit-, margin- og ROAS-status.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {profitControl.accountStatus === "freeze_all" ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-center text-xs text-amber-950 sm:text-left">
                Kontofryst: total spend over grense — ingen skalering til alle kontonivå er innenfor.
              </p>
            ) : null}
            <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
              <span className="font-medium text-[rgb(var(--lp-fg))]">Sammendrag</span>
              <span className="mt-1 block font-mono">
                Netto: {profitControl.profitSummary.totalProfit.toFixed(0)} kr · Spend:{" "}
                {profitControl.profitSummary.totalSpend.toFixed(0)} kr · Omsetning:{" "}
                {profitControl.profitSummary.totalRevenue.toFixed(0)} kr · Beskyttet:{" "}
                {profitControl.profitSummary.campaignsProtected} kampanje(r)
              </span>
            </div>
            <ul className="space-y-3">
              {profitControl.rowResults.map((pr, idx) => {
                const st = profitStatusPresentation(pr.uiBand);
                return (
                  <li
                    key={`profit-${pr.campaignName}-${idx}`}
                    className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-3 text-sm text-[rgb(var(--lp-text))]"
                  >
                    <div className="flex flex-col gap-2 text-center sm:text-left">
                      <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-medium text-[rgb(var(--lp-fg))]">{pr.campaignName}</p>
                        <p className="text-xs font-medium text-[rgb(var(--lp-fg))]">
                          <span aria-hidden="true">{st.emoji}</span> {st.label}
                        </p>
                      </div>
                      <div className="grid gap-2 text-xs sm:grid-cols-2">
                        <p>
                          <span className="text-[rgb(var(--lp-muted))]">Profit</span>
                          <br />
                          <span className="font-mono text-[rgb(var(--lp-fg))]">{pr.profit.toFixed(0)} kr</span>
                        </p>
                        <p>
                          <span className="text-[rgb(var(--lp-muted))]">Margin</span>
                          <br />
                          <span className="font-mono text-[rgb(var(--lp-fg))]">{(pr.margin * 100).toFixed(1)} %</span>
                        </p>
                        <p>
                          <span className="text-[rgb(var(--lp-muted))]">ROAS</span>
                          <br />
                          <span className="font-mono text-[rgb(var(--lp-fg))]">{pr.roas.toFixed(2)}</span>
                        </p>
                        <p>
                          <span className="text-[rgb(var(--lp-muted))]">Budsjett / forslag</span>
                          <br />
                          <span className="font-mono">
                            {Math.round(pr.budget)} kr
                            {pr.proposedBudget != null ? (
                              <>
                                {" "}
                                → <span className="text-[rgb(var(--lp-fg))]">{pr.proposedBudget}</span> kr
                              </>
                            ) : (
                              <span className="text-[rgb(var(--lp-muted))]"> (uendret)</span>
                            )}
                          </span>
                        </p>
                      </div>
                      <p className="text-[10px] text-[rgb(var(--lp-muted))]">
                        Status: {pr.executionHint} · klasse {pr.profitClass} · autonomi {pr.autonomyDecision}
                        {pr.protectedCampaign ? " · beskyttet" : ""}
                      </p>
                      {pr.blockedReasons.length > 0 ? (
                        <ul className="list-inside list-disc text-left text-[11px] text-amber-900">
                          {pr.blockedReasons.map((reason, ri) => (
                            <li key={`${idx}-${ri}-${reason.slice(0, 48)}`}>{reason}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <button
                type="button"
                disabled={isPending || profitControlInputs.length === 0}
                className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
                onClick={() =>
                  startTransition(() => {
                    void (async () => {
                      setMessage(null);
                      const r = await socialEngineProfitControlEvaluateAction(profitControlInputs);
                      if (!r.ok) {
                        setMessage(r.error);
                        return;
                      }
                      setMessage(
                        `Profit-kontroll logget: ${r.profitSummary.campaignsProtected} beskyttet, konto ${r.accountStatus}.`,
                      );
                    })();
                  })
                }
              >
                Logg profit-vurdering (audit)
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Omsetningsmotor</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Lukket sløyfe: registrert omsetning fra publiserte poster kobles til annonse-spend (samme postId der mulig).
          Beslutninger (scale/pause/hold) er kun forslag — ingen budsjettendring uten eksisterende godkjenningsflyt.
          Manglende spend → ingen skalering; ufullstendig attributjon filtreres i ordre-pipeline. Profit og skalering bruker
          kun hendelser med attributjonsscore over terskel — svak attributjon nedgraderes og skaleres ikke.
        </p>
        <div className="mt-4 space-y-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-3 text-center text-sm sm:text-left">
          <p className="text-center text-xs font-medium text-[rgb(var(--lp-fg))] sm:text-left">
            Attributjon:{" "}
            <span
              className={
                revenueEngine.attributionReliabilityLabel === "Høy sikkerhet"
                  ? "text-emerald-800"
                  : "text-amber-900"
              }
            >
              {revenueEngine.attributionReliabilityLabel}
            </span>
            {revenueEngine.excludedWeakAttributionRevenue > 1e-6 ? (
              <span className="block font-normal text-[rgb(var(--lp-muted))] sm:mt-0 sm:inline">
                {" "}
                — Ekskludert (lav sikkerhet): {revenueEngine.excludedWeakAttributionRevenue.toFixed(0)} kr · signal totalt:{" "}
                {revenueEngine.signalRevenueTotal.toFixed(0)} kr
              </span>
            ) : null}
          </p>
          <p className="font-mono text-xs text-[rgb(var(--lp-muted))]">
            Omsetning (pålitelig attributjon): {revenueEngine.totalRevenue.toFixed(0)} kr · Spend (demo):{" "}
            {revenueEngine.totalSpend.toFixed(0)} kr · Profit (grovt): {revenueEngine.totalProfit.toFixed(0)} kr
            {revenueEngine.marginPct != null ? (
              <>
                {" "}
                · Margin {(revenueEngine.marginPct * 100).toFixed(1)} %
              </>
            ) : null}
          </p>
          <p className="font-mono text-xs text-[rgb(var(--lp-muted))]">
            Portefølje-ROAS {revenueEngine.portfolioRoas.toFixed(2)} · Global sikkerhet: {revenueEngine.globalSafety}
          </p>
          {revenueEngine.bestCampaign ? (
            <p className="text-xs text-[rgb(var(--lp-fg))]">
              Beste «kampanje» (omsetning):{" "}
              <span className="font-mono">{revenueEngine.bestCampaign.id.slice(0, 14)}…</span> ·{" "}
              {revenueEngine.bestCampaign.revenue.toFixed(0)} kr
            </p>
          ) : (
            <p className="text-xs text-[rgb(var(--lp-muted))]">Ingen attribuert omsetning ennå.</p>
          )}
          {revenueEngine.worstCampaign &&
          revenueEngine.worstCampaign.id !== revenueEngine.bestCampaign?.id ? (
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Lavest (blant med omsetning):{" "}
              <span className="font-mono">{revenueEngine.worstCampaign.id.slice(0, 14)}…</span> ·{" "}
              {revenueEngine.worstCampaign.revenue.toFixed(0)} kr
            </p>
          ) : null}
          {revenueEngine.decisions.length > 0 ? (
            <div className="max-h-40 overflow-auto text-left">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                Beslutninger (per nøkkel)
              </p>
              <ul className="mt-1 space-y-1 text-[10px] text-[rgb(var(--lp-muted))]">
                {revenueEngine.decisions.slice(0, 12).map((d) => (
                  <li key={d.campaignId} className="font-mono">
                    {d.campaignId.slice(0, 12)}… · rev {d.revenue.toFixed(0)} · spend {d.spend.toFixed(0)} · cap{" "}
                    {d.budgetAfterCap} · {d.optimize} · guard {d.guard}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              type="button"
              disabled={isPending}
              className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
              onClick={() =>
                startTransition(() => {
                  void (async () => {
                    setMessage(null);
                    const r = await socialEngineRevenueEngineLogAction({
                      postsJson,
                      spendBindings: adCampaignRows.map((row) => ({
                        id: row.campaign.postId?.trim() || row.localId,
                        spend: Math.max(0, Math.floor(row.spendDraft)),
                        budget: Math.max(0, row.budgetDraft),
                      })),
                    });
                    if (!r.ok) {
                      setMessage(r.error);
                      return;
                    }
                    setMessage(`Omsetningsmotor logget (${r.eventCount} hendelser).`);
                  })();
                })
              }
            >
              Logg omsetningsmotor (audit)
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Multi-kontokontroll</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Demo-portefølje gruppert per produkt (pseudo-konto). Allokering prioriterer høy ROAS og tildeler aldri til
          kampanjer under profit-first ROAS-krav eller med negativ margin. Portefølje ROAS under 1,5 reduserer planlagte tildelinger;
          over 3 tillates multi-account skalering i plan (ikke auto-spend). Diversifisering: maks ~40 % av totalbudsjett
          per kampanje flagges.
        </p>
        {portfolioBundle.accounts.length === 0 ? (
          <p className="mt-3 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
            Ingen kontoer — opprett annonser for porteføljefordeling.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-center text-xs sm:text-left">
              <span className="font-medium text-[rgb(var(--lp-fg))]">Portefølje</span>
              <p className="mt-1 font-mono text-[rgb(var(--lp-muted))]">
                ROAS {portfolioBundle.plan.metrics.roas.toFixed(2)} · spend{" "}
                {portfolioBundle.plan.metrics.totalSpend.toFixed(0)} kr · omsetning{" "}
                {portfolioBundle.plan.metrics.totalRevenue.toFixed(0)} kr · policy{" "}
                {portfolioBundle.plan.portfolioPolicy.mode}
                {portfolioBundle.plan.portfolioPolicy.mode === "reduce_all"
                  ? ` (×${portfolioBundle.plan.portfolioPolicy.factor})`
                  : ""}{" "}
                · spend-status {portfolioBundle.plan.accountResolution.spendStatus}
              </p>
              {portfolioBundle.plan.failClosedReasons.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-left text-[11px] text-amber-900">
                  {portfolioBundle.plan.failClosedReasons.map((reason, i) => (
                    <li key={`pf-${i}-${reason.slice(0, 40)}`}>{reason}</li>
                  ))}
                </ul>
              ) : null}
              {portfolioBundle.plan.diversified.some((d) => d.capped) ? (
                <p className="mt-2 text-[11px] text-amber-900">
                  Diversifisering: {portfolioBundle.plan.diversified.filter((d) => d.capped).length} kampanje(r) over
                  maks budsjett-andel — vurder å flytte volum.
                </p>
              ) : null}
            </div>
            <ul className="space-y-3">
              {portfolioBundle.accounts.map((acc) => {
                const accCs = portfolioBundle.campaigns.filter((c) => c.accountId === acc.id);
                const ts = accCs.reduce((s, c) => s + c.spend, 0);
                const tr = accCs.reduce((s, c) => s + c.revenue, 0);
                const accRoas = ts > 0 ? tr / ts : 0;
                const alloc = portfolioBundle.plan.allocationFinal.find((a) => a.accountId === acc.id);
                const scale = portfolioBundle.plan.scalingEffective.find((s) => s?.accountId === acc.id);
                return (
                  <li
                    key={acc.id}
                    className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-3 text-sm text-[rgb(var(--lp-text))]"
                  >
                    <p className="font-medium text-[rgb(var(--lp-fg))]">{acc.name}</p>
                    <p className="mt-1 font-mono text-xs text-[rgb(var(--lp-muted))]">
                      Status: {acc.status} · kampanjer: {accCs.length} · konto-ROAS {accRoas.toFixed(2)} · budsjett (sum){" "}
                      {acc.budget} kr · spend (sum) {acc.spend} kr
                    </p>
                    {alloc ? (
                      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                        Planlagt topp-tildeling → kampanje <span className="font-mono">{alloc.campaignId}</span>:{" "}
                        <span className="font-mono">{alloc.budget}</span> kr
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-amber-900">Ingen kvalifisert kampanje for allokering (profit-first).</p>
                    )}
                    {scale ? (
                      <p className="mt-1 text-xs text-[rgb(var(--lp-fg))]">
                        Skaleringsforslag: {scale.action} · kampanje <span className="font-mono">{scale.campaignId}</span>
                      </p>
                    ) : null}
                    <ul className="mt-2 space-y-1 text-left text-[11px] text-[rgb(var(--lp-muted))]">
                      {accCs.map((c) => (
                        <li key={c.id} className="font-mono">
                          {c.id.slice(0, 8)}… · ROAS {c.roas.toFixed(2)} · bud {c.budget} kr
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <button
                type="button"
                disabled={isPending}
                className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
                onClick={() =>
                  startTransition(() => {
                    void (async () => {
                      setMessage(null);
                      const r = await socialEnginePortfolioPlannerLogAction(portfolioBundle.input);
                      if (!r.ok) {
                        setMessage(r.error);
                        return;
                      }
                      setMessage("Porteføljeplan logget (allokering, skalering, varianter).");
                    })();
                  })
                }
              >
                Logg porteføljeplan (audit)
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Creative-rotasjon</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Creatives sorteres etter ROAS (vinnere først). A/B-vekter 60 % / 20 % / 20 % på topp tre slik at svakere
          kreativer fortsatt får utforskning.
        </p>
        {portfolioBundle.plan.rotationOrder.length === 0 ? (
          <p className="mt-3 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
            Ingen aktive creativer — generer video eller opprett annonse.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-[rgb(var(--lp-fg))]">Rangering (best først)</p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-left text-[11px] text-[rgb(var(--lp-muted))]">
                {portfolioBundle.plan.rotationOrder.map((cr, i) => (
                  <li key={cr.id}>
                    <span className="font-mono">{i + 1}</span> · ROAS {(cr.performance?.roas ?? 0).toFixed(2)} ·{" "}
                    {cr.hook.slice(0, 48)}
                    {cr.hook.length > 48 ? "…" : ""}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-xs font-medium text-[rgb(var(--lp-fg))]">Varianter per kampanje</p>
              <ul className="mt-2 space-y-2 text-left text-[11px] text-[rgb(var(--lp-muted))]">
                {portfolioBundle.plan.creativeVariantsByCampaign.map((block) => (
                  <li key={block.campaignId} className="rounded-lg border border-dashed border-[rgb(var(--lp-border))] p-2">
                    <span className="font-mono">{block.campaignId.slice(0, 10)}…</span>
                    <ul className="mt-1 space-y-0.5 pl-2">
                      {block.variants.map((v) => (
                        <li key={v.creativeId}>
                          {v.creativeId}: {(v.weight * 100).toFixed(0)} %
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">ROAS-kontroll</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
          Budsjettforslag fra ROAS med dags-cap (maks +30 % / −20 %), globalt gulv/tak og kill-switch under 0,5 ROAS. Ingen
          endring uten godkjenning; maks én aktivisering per døgn per kampanje. Annonse-godkjenning nullstilles ved nytt
          budsjett.
        </p>
        {adCampaignRows.length === 0 ? (
          <p className="mt-3 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
            Opprett annonseutkast over for å se ROAS og forslag.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {adCampaignRows.map((row) => {
              const revenue = revenueByProductId.get(row.campaign.productId) ?? 0;
              const spend = Math.max(0, Math.floor(row.spendDraft));
              const roas = calculateROAS({ spend, revenue });
              const classification = classifyCampaign({ spend, revenue });
              const guard = computeNextBudgetWithGuardrails({
                budget: row.budgetDraft,
                spend,
                revenue,
                paused: row.roasPaused,
              });
              const suggested = Math.round(guard.nextBudget);
              const currentB = Math.round(row.budgetDraft);
              const canApproveRoas =
                !row.roasPaused &&
                !guard.pauseRecommended &&
                suggested !== currentB &&
                Number.isFinite(roas);
              return (
                <li
                  key={`roas-${row.localId}`}
                  className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-3 text-sm text-[rgb(var(--lp-text))]"
                >
                  <div className="space-y-2 text-center sm:text-left">
                    <p className="font-medium text-[rgb(var(--lp-fg))]">{row.campaign.name}</p>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <p>
                        <span className="text-[rgb(var(--lp-muted))]">Spend (NOK, demo)</span>
                        <br />
                        <input
                          type="number"
                          min={0}
                          step={1}
                          disabled={isPending || row.roasPaused}
                          value={row.spendDraft}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setAdCampaignRows((prev) =>
                              prev.map((x) =>
                                x.localId === row.localId
                                  ? {
                                      ...x,
                                      spendDraft: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0,
                                      roasProof: null,
                                      roasProofExpiresAt: null,
                                    }
                                  : x,
                              ),
                            );
                          }}
                          className="mt-1 w-full max-w-[11rem] rounded-lg border border-[rgb(var(--lp-border))] px-2 py-1 font-mono text-sm sm:max-w-none"
                        />
                      </p>
                      <p>
                        <span className="text-[rgb(var(--lp-muted))]">Omsetning (attributtert)</span>
                        <br />
                        <span className="font-mono text-[rgb(var(--lp-fg))]">{revenue.toFixed(0)} kr</span>
                      </p>
                      <p>
                        <span className="text-[rgb(var(--lp-muted))]">ROAS</span>
                        <br />
                        <span className="font-mono text-[rgb(var(--lp-fg))]">{roas.toFixed(2)}</span>
                        <span className="ml-2 text-[10px] text-[rgb(var(--lp-muted))]">({classification})</span>
                      </p>
                      <p>
                        <span className="text-[rgb(var(--lp-muted))]">Budsjett / forslag</span>
                        <br />
                        <span className="font-mono">
                          {currentB} → <span className="text-[rgb(var(--lp-fg))]">{suggested}</span> kr
                        </span>
                      </p>
                    </div>
                    {guard.pauseRecommended ? (
                      <p className="text-xs text-amber-900">
                        Kill-switch: ROAS under 0,5 — vurder pause; automatisk budsjettøkning er blokkert.
                      </p>
                    ) : null}
                    {row.roasPaused ? (
                      <p className="text-xs text-[rgb(var(--lp-muted))]">Kampanje satt på pause (ROAS).</p>
                    ) : null}
                    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                      <button
                        type="button"
                        disabled={isPending || !canApproveRoas}
                        className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
                        onClick={() =>
                          startTransition(() => {
                            void (async () => {
                              setMessage(null);
                              const r = await socialEngineApproveRoasBudgetChangeAction(
                                row.campaign,
                                spend,
                                revenue,
                                row.budgetDraft,
                                row.roasPaused,
                              );
                              if (!r.ok) {
                                setMessage(r.error);
                                return;
                              }
                              setAdCampaignRows((prev) =>
                                prev.map((x) =>
                                  x.localId === row.localId
                                    ? {
                                        ...x,
                                        roasProof: r.proof,
                                        roasProofExpiresAt: r.expiresAt,
                                        lastError: null,
                                      }
                                    : x,
                                ),
                              );
                              setMessage("ROAS-endring godkjent — trykk «Bruk foreslått budsjett» for å aktivere.");
                            })();
                          })
                        }
                      >
                        Godkjenn endring
                      </button>
                      <button
                        type="button"
                        disabled={isPending || !row.roasProof || row.roasPaused}
                        className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
                        onClick={() =>
                          startTransition(() => {
                            void (async () => {
                              if (!row.roasProof) return;
                              setMessage(null);
                              const r = await socialEngineApplyRoasBudgetChangeAction(
                                row.campaign,
                                spend,
                                revenue,
                                row.budgetDraft,
                                suggested,
                                row.roasPaused,
                                row.roasProof,
                              );
                              if (!r.ok) {
                                setMessage(r.error);
                                return;
                              }
                              void socialEngineLogRoasHistoryAction([
                                {
                                  campaignName: row.campaign.name,
                                  spend,
                                  revenue,
                                  roas,
                                  budget: currentB,
                                  suggestedBudget: r.newBudget,
                                  classification,
                                },
                              ]);
                              setAdCampaignRows((prev) =>
                                prev.map((x) =>
                                  x.localId === row.localId
                                    ? {
                                        ...x,
                                        budgetDraft: r.newBudget,
                                        roasProof: null,
                                        roasProofExpiresAt: null,
                                        approvalProof: null,
                                        expiresAt: null,
                                        uiStatus: x.uiStatus === "published" ? x.uiStatus : "pending",
                                        lastError:
                                          x.approvalProof != null
                                            ? "Budsjett endret via ROAS — godkjenn annonse på nytt."
                                            : x.lastError,
                                      }
                                    : x,
                                ),
                              );
                              setMessage(`Budsjett oppdatert til ${r.newBudget} kr (ROAS-kontroll).`);
                            })();
                          })
                        }
                      >
                        Bruk foreslått budsjett
                      </button>
                      <button
                        type="button"
                        disabled={isPending || row.roasPaused}
                        className="inline-flex min-h-[44px] items-center rounded-full border border-dashed border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-muted))] disabled:opacity-50"
                        onClick={() =>
                          startTransition(() => {
                            void (async () => {
                              setMessage(null);
                              const r = await socialEnginePauseCampaignRoasAction(row.campaign.name);
                              if (!r.ok) {
                                setMessage(r.error);
                                return;
                              }
                              setAdCampaignRows((prev) =>
                                prev.map((x) =>
                                  x.localId === row.localId
                                    ? {
                                        ...x,
                                        roasPaused: true,
                                        roasProof: null,
                                        roasProofExpiresAt: null,
                                      }
                                    : x,
                                ),
                              );
                              setMessage("Kampanje satt på pause (ROAS).");
                            })();
                          })
                        }
                      >
                        Pause kampanje
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">AI Control Panel</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Kontrollert autonomi: policy, kvoter, prognose-hook, duplikatfilter, full logging. Ekstern auto-publisering er av
          (hard lock).
        </p>

        <div className="mt-5 rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 p-4">
          <h3 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">Autonomi</h3>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            AI aktiv / pause, aggressivitet og maks handlinger per kjøring. Fail-closed når pause er på.
          </p>
          <div className="mt-4 flex flex-col items-center gap-4 sm:items-stretch">
            <div className="flex w-full max-w-md flex-col gap-2">
              <span className="text-center text-xs font-medium text-[rgb(var(--lp-text))]">Aggressivitet</span>
              <div className="flex flex-wrap justify-center gap-2">
                {(
                  [
                    { v: "low" as const, label: "Lav" },
                    { v: "medium" as const, label: "Middels" },
                    { v: "high" as const, label: "Høy" },
                  ] as const
                ).map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    disabled={isPending}
                    onClick={() => setAggressiveness(v)}
                    className={`min-h-[44px] min-w-[88px] rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                      aggressiveness === v
                        ? "border-[rgb(var(--lp-accent))] bg-[rgb(var(--lp-accent))]/10 text-[rgb(var(--lp-fg))]"
                        : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-fg))]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-full max-w-md">
              <label className="flex flex-col gap-2 text-center">
                <span className="text-xs font-medium text-[rgb(var(--lp-text))]">
                  Maks handlinger per kjøring: <strong>{maxActionsPerRun}</strong>
                </span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={maxActionsPerRun}
                  disabled={isPending}
                  onChange={(e) => setMaxActionsPerRun(Number(e.target.value))}
                  className="h-11 w-full accent-[rgb(var(--lp-accent))]"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
          <button
            type="button"
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() =>
              startTransition(() => {
                void (async () => {
                  setMessage(null);
                  const r = await socialEngineAutonomousRunAction(postsJson, {
                    paused: aiPaused,
                    aggressiveness,
                    maxActionsPerRun,
                  });
                  if (!r.ok) {
                    setMessage(r.error ?? "Feil");
                    return;
                  }
                  setPostsJson(r.postsJson);
                  setLastCycle(r.cycle);
                  if (aiPaused) {
                    setMessage(
                      `AI er pauset — ingen utførelse. Årsak: ${r.cycle.skippedReasons[0] ?? "paused"}.`,
                    );
                  } else {
                    const conf =
                      r.cycle.systemConfidence != null ? r.cycle.systemConfidence.toFixed(2) : "—";
                    const risk = r.cycle.aggregateRisk ?? "—";
                    setMessage(
                      `Autonom syklus: ${r.cycle.executed} utført, ${r.cycle.skipped} hoppet over. Systemtillit ${conf}, risiko ${risk}. Prognose-hopp: ${r.cycle.predictiveSkips}.`,
                    );
                  }
                })();
              })
            }
          >
            Kjør AI nå
          </button>
          <button
            type="button"
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() => setAiPaused((p) => !p)}
          >
            {aiPaused ? "Gjenoppta AI" : "Pause AI"}
          </button>
          <button
            type="button"
            disabled={!lastCycle}
            className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() => setShowAutonomyLog((s) => !s)}
          >
            Se logg
          </button>
          <button
            type="button"
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() => {
              void fetch("/api/social/autonomous/run", { method: "POST" });
            }}
          >
            Kjør AI automatisk
          </button>
        </div>
        {aiPaused ? (
          <p className="mt-2 text-center text-xs font-medium text-amber-800 sm:text-left">
            Status: pauset (fail-closed ved kjøring).
          </p>
        ) : (
          <p className="mt-2 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">Status: klar til kjøring.</p>
        )}
        {lastCycle ? (
          <div className="mt-3 space-y-2 text-xs text-[rgb(var(--lp-text))]">
            <p className="text-center sm:text-left">
              Siste kjøring: <span className="font-mono">{lastCycle.lastRunAt}</span> · utført{" "}
              <strong>{lastCycle.executed}</strong> · hoppet over <strong>{lastCycle.skipped}</strong> · lav tillit{" "}
              {lastCycle.lowConfidenceSkips} · duplikater {lastCycle.duplicateSkips} · kvote {lastCycle.cappedSkips} ·
              prognose {lastCycle.predictiveSkips} · risiko/policy {lastCycle.riskPolicySkips} · forsterkning skalering-kvote{" "}
              {lastCycle.reinforcementScalingCapSkips} · forsterkning demping-kvote {lastCycle.reinforcementSuppressionCapSkips}
              {lastCycle.systemConfidence != null ? (
                <>
                  {" "}
                  · systemtillit <strong>{lastCycle.systemConfidence.toFixed(2)}</strong>
                </>
              ) : null}
              {lastCycle.aggregateRisk ? (
                <>
                  {" "}
                  · aggr. risiko <strong>{lastCycle.aggregateRisk}</strong>
                </>
              ) : null}
            </p>
            <div className="overflow-x-auto rounded-lg border border-[rgb(var(--lp-border))]">
              <table className="w-full min-w-[280px] text-left text-[11px]">
                <thead className="border-b border-[rgb(var(--lp-border))] bg-white/90 text-[rgb(var(--lp-muted))]">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Type</th>
                    <th className="px-2 py-1.5 font-medium">Tillit</th>
                    <th className="px-2 py-1.5 font-medium">Effekt</th>
                    <th className="px-2 py-1.5 font-medium">Risiko</th>
                    <th className="px-2 py-1.5 font-medium">Godkjent</th>
                    <th className="px-2 py-1.5 font-medium">Utført</th>
                    <th className="px-2 py-1.5 font-medium">Årsak</th>
                  </tr>
                </thead>
                <tbody>
                  {lastCycle.decisions.map((d) => (
                    <tr key={d.id} className="border-b border-[rgb(var(--lp-border))]/60">
                      <td className="px-2 py-1.5 font-mono">{d.type}</td>
                      <td className="px-2 py-1.5">{d.confidence.toFixed(2)}</td>
                      <td className="px-2 py-1.5">
                        {typeof d.expectedImpact === "number" ? d.expectedImpact.toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-1.5">{d.riskLevel}</td>
                      <td className="px-2 py-1.5">{d.approved ? "ja" : "nei"}</td>
                      <td className="px-2 py-1.5">{d.executed ? "ja" : "nei"}</td>
                      <td className="max-w-[140px] truncate px-2 py-1.5 text-[rgb(var(--lp-muted))]" title={d.skipReason}>
                        {d.skipReason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <h3 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">Siste handlinger</h3>
              <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                Kun utførte beslutninger. Tilbakestill er best-effort (kalender-snapshot eller fjern prioritet).
              </p>
              {lastCycle.decisions.filter((d) => d.executed).length === 0 ? (
                <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Ingen utførte handlinger i siste syklus.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {lastCycle.decisions
                    .filter((d) => d.executed)
                    .map((d) => (
                      <li
                        key={d.id}
                        className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-3 text-center sm:text-left"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-mono text-xs font-medium text-[rgb(var(--lp-fg))]">{d.type}</p>
                            <p className="text-[11px] text-[rgb(var(--lp-muted))]">
                              Tillit {d.confidence.toFixed(2)}
                              {typeof d.expectedImpact === "number"
                                ? ` · forventet effekt ${d.expectedImpact.toFixed(2)}`
                                : ""}{" "}
                              · risiko {d.riskLevel}
                            </p>
                            <p className="mt-1 text-[11px] text-[rgb(var(--lp-text))]">
                              Resultat: utført (logget)
                              {!isDecisionRevertible(d) ? " · ikke reversibel fra kalender" : ""}
                            </p>
                          </div>
                          {isDecisionRevertible(d) ? (
                            <button
                              type="button"
                              disabled={isPending || revertBusyId === d.id}
                              className="mx-auto min-h-[44px] shrink-0 rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50 sm:mx-0"
                              onClick={() =>
                                startTransition(() => {
                                  void (async () => {
                                    setMessage(null);
                                    setRevertBusyId(d.id);
                                    const r = await socialEngineRevertDecisionAction(postsJson, d);
                                    setRevertBusyId(null);
                                    if (!r.ok) {
                                      setMessage(`Tilbakestilling avvist: ${r.error}`);
                                      return;
                                    }
                                    setPostsJson(r.postsJson);
                                    setMessage(`Tilbakestilt: ${d.type} (${d.id}).`);
                                  })();
                                })
                              }
                            >
                              Tilbakestill
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-[rgb(var(--lp-muted))] sm:text-left">
            Ingen syklus kjørt ennå — bruk «Kjør AI nå».
          </p>
        )}
        {showAutonomyLog && lastCycle ? (
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white/60 p-3 text-[10px] text-[rgb(var(--lp-muted))]">
            {JSON.stringify(
              {
                ...lastCycle,
                decisions: lastCycle.decisions.map((d) => ({
                  ...d,
                  data:
                    typeof d.data.revertSnapshot === "string"
                      ? { ...d.data, revertSnapshot: `[${(d.data.revertSnapshot as string).length} tegn]` }
                      : d.data,
                })),
              },
              null,
              2,
            )}
          </pre>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Trygg modus: ingen ekstern publisering. Media hentes fra CMS <code className="text-[10px]">media_items</code> (ready)
          når tilgjengelig.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() =>
              run(async () => {
                const r = await socialEngineFillCalendarAction(postsJson);
                return r;
              })
            }
          >
            Fyll 21-dagerskalender
          </button>
          <button
            type="button"
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() =>
              run(async () => {
                const r = await socialEngineSchedulerAction(postsJson);
                return r;
              })
            }
          >
            Kjør planlegger (planned → klar)
          </button>
          <button
            type="button"
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() =>
              startTransition(() => {
                void (async () => {
                  setMessage(null);
                  const r = await socialEngineGenerateDraftAction(postsJson);
                  if (!r.ok) {
                    setMessage(r.error ?? "Feil");
                    setDraftImage(null);
                    setDraftTrackingPath(null);
                    return;
                  }
                  setDraftPreview(`${r.draft.hook}\n\n${r.draft.text.slice(0, 400)}${r.draft.text.length > 400 ? "…" : ""}`);
                  setDraftTrackingPath(r.draft.revenueTrackingPath ?? null);
                  if (r.draft.media.imageUrl) {
                    setDraftImage({ url: r.draft.media.imageUrl, alt: r.draft.media.alt ?? "CMS-media" });
                  } else {
                    setDraftImage(null);
                  }
                  setMessage("Utkast generert (logget).");
                })();
              })
            }
          >
            Generer utkast
          </button>
          <button
            type="button"
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] disabled:opacity-50"
            onClick={() =>
              startTransition(() => {
                void (async () => {
                  setMessage(null);
                  const r = await socialEngineLearnAction(postsJson);
                  if (!r.ok) {
                    setMessage(r.error ?? "Feil");
                    return;
                  }
                  const L = r.learning;
                  setLearningPreview(
                    `Produkter: ${L.bestProducts.slice(0, 5).join(", ") || "—"}\nHooks: ${L.bestHooks.slice(0, 3).join(" | ") || "—"}\nVideo-hooks (videoViews>0): ${L.bestVideoHooks.slice(0, 3).join(" | ") || "—"}\nVideo-åpninger: ${L.bestVideoOpenings.slice(0, 3).join(" | ") || "—"}\nBeste hook-typer (video): ${L.bestHookTypesForVideo.join(", ") || "—"}\nSvakeste hook-typer (video): ${L.worstHookTypesForVideo.join(", ") || "—"}\nVideo-stemmer: ${L.bestVideoVoiceTones.join(", ") || "—"}\nVideo-undertekst-stil: ${L.bestVideoCaptionStyles.join(", ") || "—"}\nMedia-kilder: ${L.bestMediaStyles.join(", ") || "—"}\nTider: ${L.bestTimes.slice(0, 4).join(", ") || "—"}`,
                  );
                  setMessage("Læring oppdatert (logget).");
                })();
              })
            }
          >
            Kjør læring
          </button>
        </div>
      </div>

      {draftPreview ? (
        <div className="rounded-2xl border border-dashed border-[rgb(var(--lp-border))] bg-white/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">Siste utkast</h2>
            <DataTrustBadge kind="REAL" />
          </div>
          {draftImage ? (
            <div className="mt-2 flex justify-center sm:justify-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- CMS URL-arbitrary; superadmin verktøy */}
              <img
                src={draftImage.url}
                alt={draftImage.alt}
                className="max-h-28 max-w-full rounded-lg border border-[rgb(var(--lp-border))] object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Ingen CMS-bilde koblet (tom bibliotek eller ingen treff).</p>
          )}
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-[rgb(var(--lp-muted))]">{draftPreview}</pre>
          {draftTrackingPath ? (
            <p className="mt-2 break-all text-[10px] text-[rgb(var(--lp-muted))]">
              Sporingslenke (utkast): <span className="font-mono">{draftTrackingPath}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {learningPreview ? (
        <div className="rounded-2xl border border-dashed border-[rgb(var(--lp-border))] bg-white/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">Læring (sammendrag)</h2>
            <DataTrustBadge kind="REAL" />
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-[rgb(var(--lp-muted))]">{learningPreview}</pre>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Kalender ({posts.length} poster)</h2>
          <DataTrustBadge kind="REAL" />
        </div>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Vindu: {windowKeys[0]} → {windowKeys[windowKeys.length - 1]}
        </p>
        <ul className="mt-4 max-h-[480px] space-y-2 overflow-y-auto">
          {posts.length === 0 ? (
            <li className="text-sm text-[rgb(var(--lp-muted))]">Ingen poster — bruk «Fyll 21-dagerskalender».</li>
          ) : (
            posts.map((p) => {
              const score = calendarPostPerformanceScore(p);
              const rf = reinforcementClassByPostId.get(p.id);
              const imgUrl = p.socialMedia?.imageUrl ?? null;
              const imgAlt = p.socialMedia?.alt ?? "CMS-media";
              const rev = p.performance?.revenue ?? 0;
              const conv = p.performance?.conversions ?? 0;
              const clk = (p.performance?.clicks ?? 0) + (p.performance?.imageClicks ?? 0);
              const nokPerClick = clk > 0 ? rev / clk : null;
              return (
                <li
                  key={p.id}
                  className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-sm text-[rgb(var(--lp-text))]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {p.slotDay} · {p.productId}
                        </span>
                        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                          {rf === "winner" ? (
                            <span
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-900"
                              title="Vinner (forsterkning)"
                            >
                              🟢 Vinner
                            </span>
                          ) : null}
                          {rf === "loser" ? (
                            <span
                              className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-900"
                              title="Taper (forsterkning)"
                            >
                              🔴 Taper
                            </span>
                          ) : null}
                          {p.reinforcementDeprioritized ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700">
                              dempet
                            </span>
                          ) : null}
                          {p.autonomyPriority ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-900">
                              prioritet
                            </span>
                          ) : null}
                          <span className="rounded-full border border-[rgb(var(--lp-border))] px-2 py-0.5 text-[10px] text-[rgb(var(--lp-muted))]">
                            score {score}/100
                          </span>
                          <span className="rounded-full border border-[rgb(var(--lp-border))] px-2 py-0.5 text-[10px] text-[rgb(var(--lp-muted))]">
                            sporingspoeng {dbScoreByPostId[p.id] ?? 0}
                          </span>
                        </span>
                      </div>
                      <span className="mt-0.5 block text-xs text-[rgb(var(--lp-muted))]">{statusNb(p.status)}</span>
                      <span className="mt-1 block text-[10px] text-[rgb(var(--lp-muted))]">
                        omsetning {rev.toFixed(0)} kr · konverteringer {conv} · klikk {clk}
                        {nokPerClick != null
                          ? ` · indikator: ${nokPerClick.toFixed(2)} kr/klikk (kun fra registrerte tall)`
                          : ""}
                      </span>
                    </div>
                  </div>
                  {imgUrl ? (
                    <div className="mt-2 flex justify-center sm:justify-start">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl}
                        alt={imgAlt}
                        className="max-h-24 max-w-full rounded-md border border-[rgb(var(--lp-border))] object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-[rgb(var(--lp-muted))]">Ingen bilde (CMS-bibliotek tomt eller ingen treff).</p>
                  )}
                  {p.hook ? <p className="mt-2 text-xs font-medium text-[rgb(var(--lp-text))]">{p.hook}</p> : null}
                  {p.status === "published" ? (
                    <button
                      type="button"
                      disabled={isPending}
                      className="mt-2 min-h-8 rounded border border-dashed border-slate-300 px-2 text-[10px] disabled:opacity-50"
                      onClick={() =>
                        run(async () => {
                          const r = await socialEngineDemoTrackAction(postsJson, p.id);
                          return r;
                        })
                      }
                    >
                      +1 klikk (demo spor)
                    </button>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
