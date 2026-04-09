"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { logDecision, getDecisions } from "@/lib/ai/decisionLog";
import { detectOpportunities, opportunityImpact, type Opportunity } from "@/lib/ai/opportunities";
import { detectSignals } from "@/lib/ai/marketSignals";
import { getTopOpportunities } from "@/lib/ai/prioritization";
import { suggestPricing, type DemandSignal } from "@/lib/ai/pricing";
import { simulateChange, type SimulationOutcome } from "@/lib/ai/simulator";
import { generateStrategy, type StrategyRecommendation } from "@/lib/ai/strategyEngine";
import { generateSocialPlan, type SocialProductRef } from "@/lib/ai/socialStrategy";
import { countWordsInBlocks, type PageSummary } from "@/lib/ai/siteAnalysis";
import { evaluatePage, hasEffectiveCta } from "@/lib/ai/pageScore";
import { generatePostFromStrategy, type GeneratedSocialPost } from "@/lib/social/generateFromStrategy";
import { publishSocialPost } from "@/lib/social/publish";
import {
  canAutoSocialPostToday,
  getAutoSocialCountToday,
  getAutoSocialUserEnabled,
  incrementAutoSocialPostToday,
  setAutoSocialUserEnabled,
} from "@/lib/social/autoSocialQuota";
import { buildRevenueLiftRecommendation } from "@/lib/growth/growthAttributionInsights";
import { calculateObjectionInsights } from "@/lib/ai/objectionInsights";
import { mergeOutboundLearningSlice } from "@/lib/outbound/outboundGrowthMerge";
import { getOutboundObjectionSnapshot } from "@/lib/outbound/objectionMetrics";
import { readCalendarPostsFromLocalStorage } from "@/lib/social/calendarBrowserStorage";
import { defaultSocialLocation, type Location } from "@/lib/social/location";
import { SocialPreview } from "./SocialPreview";
import { SocialContentCalendar } from "./SocialContentCalendar";
import { SocialGrowthLocationSection } from "./SocialGrowthLocationSection";

export type AiCeoPanelProps = {
  enabled: boolean;
  pageId: string;
  title: string;
  blocks: Block[];
  meta: Record<string, unknown>;
  socialProducts?: SocialProductRef[];
  daysSinceLastSocialPost?: number;
};

function impactEmoji(impact: StrategyRecommendation["impact"]): string {
  if (impact === "high") return "\uD83D\uDD25 ";
  if (impact === "medium") return "\u26A0\uFE0F ";
  return "\u2139\uFE0F ";
}

type SocialRowState = {
  item: ReturnType<typeof generateSocialPlan>[number];
  draft: GeneratedSocialPost;
};

export function AiCeoPanel(props: AiCeoPanelProps) {
  const { enabled, pageId, title, blocks, meta, socialProducts = [], daysSinceLastSocialPost } = props;

  const [traffic, setTraffic] = useState(0);
  const [conversions, setConversions] = useState(0);
  const [listPrice, setListPrice] = useState(999);
  const [demandSignal, setDemandSignal] = useState<DemandSignal>("neutral");
  const [simulation, setSimulation] = useState<{ id: string; outcome: SimulationOutcome } | null>(null);
  const [pendingApproval, setPendingApproval] = useState<StrategyRecommendation | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [logTick, setLogTick] = useState(0);

  const [autoSocialEnabled, setAutoSocialEnabled] = useState(false);
  const [autoSocialNonce, setAutoSocialNonce] = useState(0);
  const [socialPreview, setSocialPreview] = useState<SocialRowState | null>(null);
  const [socialSimByProduct, setSocialSimByProduct] = useState<Record<string, SimulationOutcome>>({});
  const [pendingSocialPublish, setPendingSocialPublish] = useState<SocialRowState | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [socialLocation, setSocialLocation] = useState<Location>(defaultSocialLocation);
  const [revenueInsight, setRevenueInsight] = useState<string | null>(null);
  const [outboundObjTick, setOutboundObjTick] = useState(0);

  const onSocialLocationResolved = useCallback((loc: Location) => {
    setSocialLocation(loc);
  }, []);

  const pageScore = useMemo(() => evaluatePage({ title, blocks, meta }), [title, blocks, meta]);
  const wordCount = useMemo(() => countWordsInBlocks(blocks), [blocks]);

  const summaries: PageSummary[] = useMemo(
    () =>
      pageId
        ? [
            {
              id: pageId,
              title,
              score: pageScore.score,
              hasCTA: hasEffectiveCta(blocks),
              wordCount,
            },
          ]
        : [],
    [pageId, title, pageScore.score, blocks, wordCount],
  );

  const market = useMemo(() => detectSignals({ traffic, conversions }), [traffic, conversions]);
  const opportunities = useMemo(() => detectOpportunities(summaries), [summaries]);
  const topOpportunities = useMemo(() => getTopOpportunities(opportunities, 5), [opportunities]);

  const socialContext = useMemo(
    () => ({
      productCount: socialProducts.length,
      daysSinceLastPost: daysSinceLastSocialPost,
    }),
    [socialProducts.length, daysSinceLastSocialPost],
  );

  const strategies = useMemo(
    () => generateStrategy({ pages: summaries, opportunities, market, socialContext }),
    [summaries, opportunities, market, socialContext],
  );

  const socialRows = useMemo(() => {
    const plan = generateSocialPlan({ products: socialProducts, pages: summaries });
    return plan.map((item) => ({
      item,
      draft: generatePostFromStrategy(
        {
          id: item.productId,
          name: item.productName,
          url: item.productUrl,
        },
        socialLocation,
      ),
    }));
  }, [socialProducts, summaries, socialLocation]);

  const pricingHint = useMemo(() => suggestPricing(listPrice, demandSignal), [listPrice, demandSignal]);

  const recentDecisions = getDecisions().slice(0, 8);

  const bumpLog = useCallback(() => setLogTick((n) => n + 1), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const posts = readCalendarPostsFromLocalStorage(pageId || "default");
    setRevenueInsight(buildRevenueLiftRecommendation(posts));
  }, [pageId, logTick]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fn = () => setOutboundObjTick((n) => n + 1);
    window.addEventListener("lp-outbound-metrics", fn);
    window.addEventListener("lp-outbound-followup", fn);
    return () => {
      window.removeEventListener("lp-outbound-metrics", fn);
      window.removeEventListener("lp-outbound-followup", fn);
    };
  }, []);

  const outboundObjectionDash = useMemo(() => getOutboundObjectionSnapshot(), [outboundObjTick, logTick, pageId]);

  const objectionRates = useMemo(
    () =>
      calculateObjectionInsights({
        total: outboundObjectionDash.analysisRuns,
        hasCanteen: outboundObjectionDash.canteenDetections,
        cateringConverted: outboundObjectionDash.cateringConversions,
      }),
    [outboundObjectionDash],
  );

  const bestObjectionPivotLine = useMemo(() => {
    if (typeof window === "undefined") return "";
    const lines = mergeOutboundLearningSlice().bestObjectionPivot;
    return lines.slice(0, 4).join(" · ") || "—";
  }, [outboundObjTick, logTick]);

  useEffect(() => {
    const on = getAutoSocialUserEnabled();
    setAutoSocialEnabled(on);
    if (on) setAutoSocialNonce((n) => (n < 1 ? 1 : n));
  }, []);

  const onToggleAutoSocial = (on: boolean) => {
    setAutoSocialUserEnabled(on);
    setAutoSocialEnabled(on);
    if (on) setAutoSocialNonce((n) => n + 1);
  };

  useEffect(() => {
    if (autoSocialNonce === 0) return;
    if (!autoSocialEnabled) return;
    if (socialProducts.length === 0) {
      setToast("Auto-modus krever minst ett produkt i listen.");
      window.setTimeout(() => setToast(null), 5000);
      return;
    }
    if (!canAutoSocialPostToday(2)) {
      setToast("Auto-modus: maks 2 trygge innlegg per døgn er brukt.");
      window.setTimeout(() => setToast(null), 5000);
      return;
    }

    const run = async () => {
      const first = generateSocialPlan({ products: socialProducts })[0];
      if (!first) return;
      const draft = generatePostFromStrategy(
        {
          id: first.productId,
          name: first.productName,
          url: first.productUrl,
        },
        socialLocation,
      );
      const r = await publishSocialPost({
        caption: draft.text,
        hashtags: draft.hashtags,
        platforms: draft.platforms,
        productId: first.productId,
        productName: first.productName,
        via: "auto_safe",
      });
      if (r.ok) {
        incrementAutoSocialPostToday();
        logDecision({
          action: "social_post_auto_safe",
          approved: true,
          decisionType: "social_post",
          context: first.productName,
          socialPost: {
            productId: first.productId,
            productName: first.productName,
            platforms: [...draft.platforms],
            captionSnippet: draft.text.slice(0, 140),
            via: "auto_safe",
            simulated: r.simulated,
            rid: r.rid,
          },
        });
        bumpLog();
        setToast(
          `Auto (trygg): dry-run for «${first.productName}». Kvote: ${getAutoSocialCountToday()}/2 per døgn. Ekte API ikke koblet.`,
        );
        window.setTimeout(() => setToast(null), 8000);
      }
    };
    void run();
  }, [autoSocialNonce, autoSocialEnabled, socialProducts, socialLocation, bumpLog]);

  const onIgnore = (rec: StrategyRecommendation) => {
    logDecision({
      action: "ignore_recommendation",
      approved: false,
      context: rec.title,
      decisionType: "other",
    });
    bumpLog();
    setToast(`Ignorert: «${rec.title}» er logget.`);
    window.setTimeout(() => setToast(null), 4000);
  };

  const onConfirmApply = () => {
    if (!pendingApproval) return;
    logDecision({
      action: "approve_intent_manual_execution",
      approved: true,
      context: pendingApproval.title,
      decisionType: "strategy_intent",
    });
    bumpLog();
    setPendingApproval(null);
    setToast(
      "Godkjent som intensjon — ingen auto-endring. Utfør i redigerer (f.eks. Diagnose-fanen) og lagre selv.",
    );
    window.setTimeout(() => setToast(null), 6000);
  };

  const onSocialSim = (productId: string) => {
    const out = simulateChange("social_post");
    setSocialSimByProduct((prev) => ({ ...prev, [productId]: out }));
  };

  const onSocialIgnore = (row: SocialRowState) => {
    logDecision({
      action: "social_ignore",
      approved: false,
      decisionType: "social_ignore",
      context: row.item.productName,
    });
    bumpLog();
    setToast(`SoMe-forslag ignorert: ${row.item.productName}`);
    window.setTimeout(() => setToast(null), 4000);
  };

  const onSocialSchedule = (row: SocialRowState) => {
    logDecision({
      action: "social_schedule_placeholder",
      approved: true,
      decisionType: "social_schedule",
      context: row.item.productName,
      socialPost: {
        productId: row.item.productId,
        productName: row.item.productName,
        platforms: [...row.draft.platforms],
        captionSnippet: row.draft.text.slice(0, 120),
        via: "manual_approve",
        simulated: true,
      },
    });
    bumpLog();
    setToast("Planlegging logget — koble ekstern kalender/verktøy for faktisk publisering.");
    window.setTimeout(() => setToast(null), 6000);
  };

  const confirmSocialPublish = async () => {
    if (!pendingSocialPublish) return;
    setPublishing(true);
    try {
      const { item, draft } = pendingSocialPublish;
      const r = await publishSocialPost({
        caption: draft.text,
        hashtags: draft.hashtags,
        platforms: draft.platforms,
        productId: item.productId,
        productName: item.productName,
        via: "manual_approve",
        explicitUserConfirmed: true,
      });
      logDecision({
        action: r.ok ? "social_post_manual" : "social_post_blocked",
        approved: r.ok,
        decisionType: "social_post",
        context: item.productName,
        socialPost: {
          productId: item.productId,
          productName: item.productName,
          platforms: [...draft.platforms],
          captionSnippet: draft.text.slice(0, 140),
          via: "manual_approve",
          simulated: r.simulated,
          rid: r.rid,
        },
      });
      bumpLog();
      setPendingSocialPublish(null);
      setToast(r.ok ? r.message : r.message);
      window.setTimeout(() => setToast(null), 8000);
    } finally {
      setPublishing(false);
    }
  };

  if (!enabled) {
    return (
      <p className="text-xs text-[rgb(var(--lp-muted))]">AI CEO er tilgjengelig når du redigerer en side med blokker.</p>
    );
  }

  return (
    <div className="space-y-4" aria-label="AI CEO — rådgiver">
      <p className="text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
        Strategi + SoMe + simulator. Pris og publisering endres ikke skjult. Manuell publisering krever bekreftelsesmodal; auto-modus er begrenset
        (maks 2 produkt-dry-runs per døgn) og kjører kun når du slår det på.
      </p>

      {toast ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-950" role="status">
          {toast}
        </div>
      ) : null}

      {revenueInsight ? (
        <div
          className="rounded-lg border border-pink-200/60 bg-pink-50/50 px-2 py-2 text-[11px] text-[rgb(var(--lp-text))]"
          role="status"
        >
          <span className="font-semibold text-pink-800">Attributjon:</span> {revenueInsight}
        </div>
      ) : null}

      <div
        className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-2 text-[11px] text-[rgb(var(--lp-text))]"
        role="status"
      >
        <div>
          <span className="font-semibold text-[rgb(var(--lp-text))]">Utgående — innvendinger:</span>{" "}
          {outboundObjectionDash.analysisRuns > 0 ? (
            <>
              🚫 {Math.round(objectionRates.canteenRate * 100)}% har kantine · 🍰{" "}
              {Math.round(objectionRates.cateringConversion * 100)}% konvertert til catering{" "}
              <span className="text-[rgb(var(--lp-muted))]">
                ({outboundObjectionDash.analysisRuns} analyser, {outboundObjectionDash.canteenDetections} kantine-treff)
              </span>
            </>
          ) : (
            <span className="text-[rgb(var(--lp-muted))]">Ingen analyser ennå — bruk «Analyser svar» i utgående-panelet.</span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
          Pivot-læring: <span className="text-[rgb(var(--lp-text))]">{bestObjectionPivotLine}</span>
        </p>
      </div>

      <section className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Markedssignaler (manuelt)</h3>
        <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
          Legg inn tall du stoler på. Uten tall: ingen skjult antakelse.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="grid gap-0.5 text-[11px] text-[rgb(var(--lp-text))]">
            Trafikk / visninger
            <input
              type="number"
              min={0}
              value={traffic || ""}
              onChange={(e) => setTraffic(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            />
          </label>
          <label className="grid gap-0.5 text-[11px] text-[rgb(var(--lp-text))]">
            Konverteringer
            <input
              type="number"
              min={0}
              value={conversions || ""}
              onChange={(e) => setConversions(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-xs">
          <div className="font-semibold text-[rgb(var(--lp-text))]">📊 {market.headline}</div>
          <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">{market.detail}</p>
        </div>
      </section>

      <section className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          📊 Strategi (CRO → SoMe → SEO → pris)
        </h3>
        <ul className="mt-2 space-y-3">
          {strategies.map((rec) => (
            <li key={rec.id} className="rounded-lg border border-[rgb(var(--lp-border))]/80 bg-slate-50/80 p-2.5">
              <div className="text-[11px] font-semibold text-[rgb(var(--lp-text))]">
                {impactEmoji(rec.impact)}
                {rec.title}
              </div>
              <p className="mt-1 text-xs text-[rgb(var(--lp-text))]">{rec.description}</p>
              <dl className="mt-2 space-y-1 text-[11px] text-[rgb(var(--lp-muted))]">
                <div>
                  <dt className="font-medium text-[rgb(var(--lp-text))]">Hvorfor</dt>
                  <dd>{rec.why}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[rgb(var(--lp-text))]">Hva skjer</dt>
                  <dd>{rec.whatHappens}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[rgb(var(--lp-text))]">Risiko</dt>
                  <dd className="capitalize">{rec.risk}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[rgb(var(--lp-text))]">Område</dt>
                  <dd className="uppercase">{rec.area}</dd>
                </div>
              </dl>
              {simulation?.id === rec.id ? (
                <div className="mt-2 rounded border border-pink-200/60 bg-pink-50/50 px-2 py-1.5 text-[11px] text-[rgb(var(--lp-text))]">
                  <div className="font-medium">📈 Simulering</div>
                  <p className="mt-0.5">Effekt (illustrativ): {simulation.outcome.expectedImpact}</p>
                  <p>Risiko: {simulation.outcome.risk}</p>
                  <p className="text-[rgb(var(--lp-muted))]">{simulation.outcome.notes}</p>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-[11px] font-medium"
                  onClick={() => setSimulation({ id: rec.id, outcome: simulateChange(rec.simulationType) })}
                >
                  Se simulering
                </button>
                <button
                  type="button"
                  className="min-h-9 rounded-lg border border-pink-500/30 bg-pink-50/80 px-2 text-[11px] font-semibold text-pink-700"
                  onClick={() => setPendingApproval(rec)}
                >
                  Anvend
                </button>
                <button
                  type="button"
                  className="min-h-9 rounded-lg border border-transparent px-2 text-[11px] text-[rgb(var(--lp-muted))] underline"
                  onClick={() => onIgnore(rec)}
                >
                  Ignorer
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <SocialGrowthLocationSection onLocationResolved={onSocialLocationResolved} />

      <section className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">📱 SoMe-forslag</h3>
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[rgb(var(--lp-text))]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[rgb(var(--lp-border))]"
              checked={autoSocialEnabled}
              onChange={(e) => onToggleAutoSocial(e.target.checked)}
            />
            Auto-publiser trygge innlegg
          </label>
        </div>
        <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
          Maks 2 produkt-dry-runs per døgn, kun når modus er på. Ekte Instagram/Facebook krever senere API-kobling.
        </p>
        {socialRows.length === 0 ? (
          <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
            Ingen produkter i panelet — koble `socialProducts` fra katalog for forslag, eller bruk strategien over for manuell plan.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {socialRows.map((row) => (
              <li
                key={row.item.productId}
                className="rounded-lg border border-[rgb(var(--lp-border))]/80 bg-slate-50/80 p-2.5 text-xs"
              >
                <div className="font-semibold text-[rgb(var(--lp-text))]">
                  📱 Postforslag · {row.item.productName}
                </div>
                <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">{row.item.reason}</p>
                <p className="mt-1 text-[11px]">
                  Plattform: <span className="font-medium">{row.draft.platforms.join(", ")}</span>
                </p>
                {socialSimByProduct[row.item.productId] ? (
                  <div className="mt-2 rounded border border-pink-200/50 bg-pink-50/40 px-2 py-1 text-[11px]">
                    <span className="font-medium">Forventet effekt:</span>{" "}
                    {socialSimByProduct[row.item.productId].expectedImpact}
                    <br />
                    <span className="font-medium">Risiko:</span> {socialSimByProduct[row.item.productId].risk}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-[11px] font-medium"
                    onClick={() => setSocialPreview(row)}
                  >
                    Se preview
                  </button>
                  <button
                    type="button"
                    className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-[11px] font-medium"
                    onClick={() => onSocialSim(row.item.productId)}
                  >
                    Se simulering
                  </button>
                  <button
                    type="button"
                    className="min-h-9 rounded-lg border border-pink-500/30 bg-pink-50/80 px-2 text-[11px] font-semibold text-pink-700"
                    onClick={() => setPendingSocialPublish(row)}
                  >
                    Publiser
                  </button>
                  <button
                    type="button"
                    className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-[11px] font-medium"
                    onClick={() => onSocialSchedule(row)}
                  >
                    Planlegg
                  </button>
                  <button
                    type="button"
                    className="min-h-9 rounded-lg border border-transparent px-2 text-[11px] text-[rgb(var(--lp-muted))] underline"
                    onClick={() => onSocialIgnore(row)}
                  >
                    Ignorer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          📅 AI-innholdskalender (21 dager)
        </h3>
        <div className="mt-2">
          <SocialContentCalendar pageId={pageId || "default"} products={socialProducts} location={socialLocation} />
        </div>
      </section>

      <section className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Toppmuligheter (denne siden)</h3>
        <ul className="mt-2 space-y-2">
          {topOpportunities.length === 0 ? (
            <li className="text-xs text-[rgb(var(--lp-muted))]">Ingen registrerte muligheter.</li>
          ) : (
            topOpportunities.map((o: Opportunity) => (
              <li key={`${o.pageId}-${o.intent}`} className="rounded-lg border border-[rgb(var(--lp-border))]/70 px-2 py-1.5 text-xs">
                <span className="font-medium text-[rgb(var(--lp-text))]">
                  {opportunityImpact(o.priority) === "high" ? "\uD83D\uDD25 " : ""}
                  {o.description}
                </span>
                <p className="mt-0.5 text-[11px] text-[rgb(var(--lp-muted))]">Fordi: {o.because}</p>
              </li>
            ))
          )}
        </ul>
        <Link
          href="/backoffice/content"
          className="mt-2 inline-block text-[11px] font-semibold text-pink-600 underline decoration-pink-400/50 underline-offset-4"
        >
          Åpne vekstkontrolltårn (flere sider)
        </Link>
      </section>

      <section className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">💰 Prisforslag (kun innspill)</h3>
        <div className="mt-2 grid gap-2">
          <label className="grid gap-0.5 text-[11px]">
            Listepris (eksempel)
            <input
              type="number"
              min={0}
              step={1}
              value={listPrice}
              onChange={(e) => setListPrice(Math.max(0, parseFloat(e.target.value) || 0))}
              className="h-9 rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm"
            />
          </label>
          <label className="grid gap-0.5 text-[11px]">
            Etterspørselssignal
            <select
              value={demandSignal}
              onChange={(e) => setDemandSignal(e.target.value as DemandSignal)}
              className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            >
              <option value="neutral">Nøytral</option>
              <option value="high">Høy</option>
              <option value="low">Lav</option>
            </select>
          </label>
        </div>
        {pricingHint ? (
          <div className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-2 py-2 text-xs">
            <div className="font-semibold text-[rgb(var(--lp-text))]">
              💰 Forslag: {pricingHint.action === "increase" ? "Øk" : pricingHint.action === "decrease" ? "Senk" : "Hold"}{" "}
              {pricingHint.suggestion != null ? `(ca. ${pricingHint.suggestion})` : ""}
            </div>
            <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">{pricingHint.reason}</p>
            <p className="mt-1 text-[11px] font-medium text-amber-900">{pricingHint.riskNote}</p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-[rgb(var(--lp-muted))]">Ingen prisforslag ved nøytralt signal.</p>
        )}
      </section>

      <section
        key={logTick}
        className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 p-3"
      >
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Beslutningslogg (økt)</h3>
        <ul className="mt-2 space-y-1 text-[11px] text-[rgb(var(--lp-muted))]">
          {recentDecisions.length === 0 ? (
            <li>Ingen hendelser ennå.</li>
          ) : (
            recentDecisions.map((d) => (
              <li key={d.id}>
                {new Date(d.timestamp).toLocaleString("nb-NO")} —{" "}
                {d.decisionType === "social_post"
                  ? `SoMe (${d.socialPost?.via === "auto_safe" ? "auto" : "manuell"})`
                  : d.approved
                    ? "Godkjent"
                    : "Avvist"}{" "}
                {d.socialPost?.captionSnippet ? `«${d.socialPost.captionSnippet.slice(0, 48)}…»` : null}
                {d.context && !d.socialPost?.captionSnippet ? `«${d.context}»` : null}
                {!d.context && !d.socialPost ? d.action : null}
              </li>
            ))
          )}
        </ul>
      </section>

      {socialPreview ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Forhåndsvisning sosialt innlegg"
          onClick={() => setSocialPreview(null)}
        >
          <div
            className="max-h-[90vh] overflow-y-auto rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Forhåndsvisning</h2>
            <div className="mt-3">
              <SocialPreview
                productName={socialPreview.item.productName}
                caption={socialPreview.draft.text}
                hashtags={socialPreview.draft.hashtags}
                platforms={socialPreview.draft.platforms}
              />
            </div>
            <button
              type="button"
              className="mt-4 min-h-10 w-full rounded-lg border border-[rgb(var(--lp-border))] text-xs font-medium"
              onClick={() => setSocialPreview(null)}
            >
              Lukk
            </button>
          </div>
        </div>
      ) : null}

      {pendingSocialPublish ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-ceo-social-publish-title"
          onClick={() => !publishing && setPendingSocialPublish(null)}
        >
          <div
            className="max-w-md rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ai-ceo-social-publish-title" className="text-sm font-semibold text-[rgb(var(--lp-text))]">
              Bekreft publisering
            </h2>
            <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
              Dette vil forsøke publisering til <strong>{pendingSocialPublish.draft.platforms.join(" og ")}</strong> for produktet{" "}
              <strong>{pendingSocialPublish.item.productName}</strong>. I denne bygget kjøres kun{" "}
              <strong>dry-run</strong> — ingen ekte API-kall før integrasjon er på plass.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={publishing}
                className="min-h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-xs font-medium disabled:opacity-50"
                onClick={() => setPendingSocialPublish(null)}
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={publishing}
                className="min-h-10 rounded-lg bg-[rgb(var(--lp-text))] px-3 text-xs font-semibold text-white disabled:opacity-50"
                onClick={() => void confirmSocialPublish()}
              >
                {publishing ? "…" : "Bekreft"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingApproval ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-ceo-confirm-title"
          onClick={() => setPendingApproval(null)}
        >
          <div
            className="max-w-md rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ai-ceo-confirm-title" className="text-sm font-semibold text-[rgb(var(--lp-text))]">
              Bekreft intensjon
            </h2>
            <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
              Du godkjenner strategiintensjonen «{pendingApproval.title}». Dette påvirker typisk{" "}
              <strong>{pendingApproval.affectedPages}</strong> side(r) i planlegging — men{" "}
              <strong>ingen endringer utføres automatisk</strong>. Du må lagre og publisere i eksisterende flyt.
            </p>
            <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Risiko: {pendingApproval.risk}. Område: {pendingApproval.area}.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="min-h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-xs font-medium"
                onClick={() => setPendingApproval(null)}
              >
                Avbryt
              </button>
              <button
                type="button"
                className="min-h-10 rounded-lg bg-[rgb(var(--lp-text))] px-3 text-xs font-semibold text-white"
                onClick={onConfirmApply}
              >
                Bekreft (kun logg)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
