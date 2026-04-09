"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AiTreeNav } from "../AiTreeNav";
import {
  AiMotorDemoCoreSection,
  AiMotorDemoTopLinks,
  buildAiDemoQuery,
  formatPct01,
  formatSignedRelPct,
  formatUsd,
  STRATEGY_LABELS_NB,
  STRATEGY_SOURCE_NB,
  type DecisionExplanationPayload,
  type StrategyMode,
} from "@/components/ai-motor/AiMotorDemoShared";

type AiApplyOption = {
  option_id: string;
  label: string;
  action: string;
  payload: Record<string, unknown>;
  requires_confirmation?: boolean;
};

type ApplyResultPayload = {
  summary?: string;
  dry_run?: boolean;
  confirmation_required?: boolean;
  idempotent_replay?: boolean;
  history_id?: string;
  inverse?: { action: string; payload: Record<string, unknown> } | null;
  snapshot_before?: unknown;
  snapshot_after?: unknown;
};

type AiRecommendation = {
  id: string;
  kind:
    | "margin_risk"
    | "downgrade_model"
    | "block_tool"
    | "upsell_plan"
    | "billing_flag_followup"
    | "revenue_config";
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  refs?: {
    company_id?: string;
    company_name?: string | null;
    tool?: string;
  };
  apply_options?: AiApplyOption[];
};

type BusinessEnginePayload = {
  strategy_override?: StrategyMode | null;
} | null;

type StrategyTimelineEntryPayload = {
  at: string;
  period: string;
  mode: StrategyMode;
  source: "executor" | "dashboard";
  /** Basis-gap ved hendelsen (0–1). */
  margin_gap_base?: number;
  growth_gap_base?: number;
  score?: number;
};

type ObjectivePayload = {
  score: number;
  stress: number;
  strategy_mode: StrategyMode;
  strategy_forced: boolean;
  strategy_override_source: "dashboard" | "env" | null;
  margin_gap_base: number;
  growth_gap_base: number;
  targets: { target_margin_usd: number; target_growth_rel: number };
  base_targets: { target_margin_usd: number; target_growth_rel: number };
  base_weights: { w_margin: number; w_revenue: number; w_growth: number };
  effective_weights: { w_margin: number; w_revenue: number; w_growth: number };
  margin_gap_stress: number;
  growth_gap_stress: number;
  achieved_growth_rel: number | null;
  checkpoint_period: string | null;
  strategy_state: {
    active_mode: StrategyMode;
    switch_count: number;
    last_period: string | null;
    timeline: StrategyTimelineEntryPayload[];
    by_mode?: Partial<
      Record<StrategyMode, { samples: number; score_ema: number }>
    >;
  };
};

type PlatformOverview = {
  scope: "platform";
  period: string;
  period_bounds_utc: { start: string; end: string };
  totals: {
    total_ai_cost_usd: number;
    total_list_mrr_usd: number | null;
    margin_usd: number | null;
    total_runs: number;
    revenue_partial: boolean;
  };
  by_tool: {
    tool: string;
    runs: number;
    prompt_tokens: number;
    completion_tokens: number;
    cost_estimate_usd: number;
  }[];
  top_companies: {
    company_id: string;
    name: string | null;
    plan: string;
    runs: number;
    cost_estimate_usd: number;
    list_mrr_usd: number | null;
    margin_vs_cost_usd: number | null;
    ai_billing_flagged: boolean;
    ai_billing_flag_reason: string | null;
  }[];
  flagged_companies: {
    company_id: string;
    name: string | null;
    ai_billing_flag_reason: string | null;
  }[];
  alerts: {
    margin_below_threshold: boolean;
    min_margin_usd: number;
    any_company_flagged: boolean;
  };
  recommendations?: AiRecommendation[];
  business_engine?: BusinessEnginePayload;
  decision_explanation?: DecisionExplanationPayload;
  objective?: ObjectivePayload;
};

function unwrapApiData(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "data" in raw) {
    const d = (raw as { data: unknown }).data;
    if (d && typeof d === "object" && "data" in d) {
      return (d as { data: unknown }).data;
    }
    return d;
  }
  return raw;
}

function isPlatformOverview(v: unknown): v is PlatformOverview {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.scope === "platform" && typeof o.period === "string" && o.totals != null && typeof o.totals === "object";
}

type PosUiSnapshot = {
  lastRunAt: number | null;
  lastSource: string | null;
  signalPriority: string | null;
  skippedLowConfidence: number | null;
  suppressedDuplicates: number | null;
  cappedSurfaces: number | null;
  activeSurfaces: number | null;
  lastSurfacesAffected: string[];
  lastExecutionKinds: string[];
  cyclesCompleted: number;
  effectiveMinConfidence: number | null;
  effectiveMaxActive: number | null;
};

const TIMELINE_SOURCE_NB: Record<StrategyTimelineEntryPayload["source"], string> = {
  dashboard: "Dashboard",
  executor: "Auto-kjøring",
};

const KIND_LABELS: Record<AiRecommendation["kind"], string> = {
  margin_risk: "Marginrisiko",
  downgrade_model: "Modell",
  block_tool: "Verktøy",
  upsell_plan: "Oppsalg",
  billing_flag_followup: "Fakturering",
  revenue_config: "Oppsett",
};

function severityCardClass(sev: AiRecommendation["severity"]): string {
  switch (sev) {
    case "critical":
      return "border-red-300 bg-red-50/90";
    case "warn":
      return "border-amber-200 bg-amber-50/80";
    default:
      return "border-slate-200 bg-slate-50";
  }
}

export default function AiProfitOverviewPage() {
  const [month, setMonth] = useState("");
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyBusyKey, setApplyBusyKey] = useState<string | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<unknown[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [strategyBusy, setStrategyBusy] = useState(false);
  const [engineMessage, setEngineMessage] = useState<string | null>(null);
  const [posSnapshot, setPosSnapshot] = useState<PosUiSnapshot | null>(null);
  const idempotencyKeysRef = useRef<Map<string, string>>(new Map());
  const pathname = usePathname() ?? "/backoffice/ai/overview";
  const demoDeepLinkHref = `${pathname}?${buildAiDemoQuery(month, false)}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ billing: "1" });
      if (month.trim() && /^\d{4}-\d{2}$/.test(month.trim())) {
        qs.set("month", month.trim());
      }
      const [res, resPos] = await Promise.all([
        fetch(`/api/ai/usage?${qs.toString()}`),
        fetch("/api/backoffice/ai/status", { cache: "no-store" }),
      ]);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof json?.message === "string" ? json.message : `Feil ${res.status}`;
        throw new Error(msg);
      }
      const payload = unwrapApiData(json);
      if (!isPlatformOverview(payload)) {
        throw new Error("Uventet svar fra API.");
      }
      if (resPos.ok) {
        const jPos = await resPos.json().catch(() => ({}));
        const rawStatus = unwrapApiData(jPos) as Record<string, unknown> | null;
        const p =
          rawStatus && typeof rawStatus === "object" && rawStatus.pos != null ? rawStatus.pos : null;
        if (p && typeof p === "object") {
          const o = p as Record<string, unknown>;
          setPosSnapshot({
            lastRunAt: typeof o.lastRunAt === "number" ? o.lastRunAt : null,
            lastSource: typeof o.lastSource === "string" ? o.lastSource : null,
            signalPriority: typeof o.signalPriority === "string" ? o.signalPriority : null,
            skippedLowConfidence: typeof o.skippedLowConfidence === "number" ? o.skippedLowConfidence : null,
            suppressedDuplicates: typeof o.suppressedDuplicates === "number" ? o.suppressedDuplicates : null,
            cappedSurfaces: typeof o.cappedSurfaces === "number" ? o.cappedSurfaces : null,
            activeSurfaces: typeof o.activeSurfaces === "number" ? o.activeSurfaces : null,
            lastSurfacesAffected: Array.isArray(o.lastSurfacesAffected)
              ? o.lastSurfacesAffected.map((x) => String(x))
              : [],
            lastExecutionKinds: Array.isArray(o.lastExecutionKinds)
              ? o.lastExecutionKinds.map((x) => String(x))
              : [],
            cyclesCompleted: typeof o.cyclesCompleted === "number" ? o.cyclesCompleted : 0,
            effectiveMinConfidence:
              typeof o.effectiveMinConfidence === "number" ? o.effectiveMinConfidence : null,
            effectiveMaxActive: typeof o.effectiveMaxActive === "number" ? o.effectiveMaxActive : null,
          });
        } else {
          setPosSnapshot(null);
        }
      } else {
        setPosSnapshot(null);
      }
      setEngineMessage(null);
      setData(payload);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Kunne ikke laste oversikt");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/ai/recommendation/history?limit=20");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json?.message === "string" ? json.message : `Feil ${res.status}`);
      const payload = unwrapApiData(json) as { rows?: unknown[] };
      setHistoryRows(Array.isArray(payload?.rows) ? payload.rows : []);
    } catch {
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const formatApplyResult = useCallback((p: ApplyResultPayload): string => {
    const parts: string[] = [];
    if (typeof p.summary === "string") parts.push(p.summary);
    if (p.dry_run) parts.push("(simulering — ingen endring i DB)");
    if (p.idempotent_replay) parts.push("(idempotent gjentakelse — ingen ny endring)");
    if (p.confirmation_required) parts.push("Server krever bekreftelse: send på nytt med confirmed=true.");
    if (typeof p.history_id === "string") parts.push(`Historikk-ID: ${p.history_id}`);
    if (p.inverse?.action) {
      parts.push(`Inverse: ${p.inverse.action} ${JSON.stringify(p.inverse.payload)}`);
    }
    return parts.join(" ");
  }, []);

  const postApply = useCallback(
    async (body: Record<string, unknown>, busyKey: string) => {
      setApplyBusyKey(busyKey);
      setApplyFeedback(null);
      try {
        const res = await fetch("/api/ai/recommendation/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = typeof json?.message === "string" ? json.message : `Feil ${res.status}`;
          throw new Error(msg);
        }
        const payload = unwrapApiData(json) as ApplyResultPayload;
        setApplyFeedback(formatApplyResult(payload));
        await load();
        void loadHistory();
      } catch (e) {
        setApplyFeedback(e instanceof Error ? e.message : "Kunne ikke utføre handling");
      } finally {
        setApplyBusyKey(null);
      }
    },
    [formatApplyResult, load, loadHistory],
  );

  const handleApplyDryRun = useCallback(
    async (recommendationId: string, opt: AiApplyOption) => {
      await postApply(
        {
          action: opt.action,
          payload: opt.payload,
          recommendation_id: recommendationId,
          dry_run: true,
          confirmed: false,
        },
        `${opt.option_id}-dry`,
      );
    },
    [postApply],
  );

  const handleApply = useCallback(
    async (recommendationId: string, opt: AiApplyOption) => {
      const needsConfirm = opt.requires_confirmation !== false;
      if (needsConfirm) {
        const ok = window.confirm(
          "Bekreft governance-endring: denne handlingen kan påvirke AI-kjøring og faktureringsflagg. Vil du fortsette?",
        );
        if (!ok) return;
      }
      let key = idempotencyKeysRef.current.get(opt.option_id);
      if (!key) {
        key =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        idempotencyKeysRef.current.set(opt.option_id, key);
      }
      await postApply(
        {
          action: opt.action,
          payload: opt.payload,
          recommendation_id: recommendationId,
          dry_run: false,
          confirmed: opt.requires_confirmation === false ? false : true,
          idempotency_key: key,
        },
        opt.option_id,
      );
    },
    [postApply],
  );

  const handleRollback = useCallback(
    async (historyId: string) => {
      if (
        !window.confirm(
          "Rollback gjenoppretter snapshot før valgt apply (fra governance-historikk). Bekreft at du vil fortsette.",
        )
      ) {
        return;
      }
      const key =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `rb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await postApply(
        {
          action: "rollback_governance_apply",
          payload: { history_id: historyId },
          dry_run: false,
          confirmed: true,
          idempotency_key: key,
        },
        `rollback-${historyId}`,
      );
    },
    [postApply],
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const patchStrategyOverride = useCallback(
    async (strategy_override: "profit" | "growth" | "balance" | "auto" | null) => {
      setStrategyBusy(true);
      setEngineMessage(null);
      try {
        const res = await fetch("/api/ai/business-engine", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategy_override }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof json?.message === "string" ? json.message : `Feil ${res.status}`);
        }
        await load();
        setEngineMessage("Strategi oppdatert.");
      } catch (e) {
        setEngineMessage(e instanceof Error ? e.message : "Kunne ikke oppdatere strategi");
      } finally {
        setStrategyBusy(false);
      }
    },
    [load],
  );

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-slate-900">AI-inntjening & forretningsmotor</h1>
      <p className="mt-1 text-sm text-slate-600">
        Optimalisering aktiv i styrt modus — forslag og varianter går via CMS og manuell bekreftelse.{" "}
        Sanntidsbilde av kostnad, margin og list MRR, pluss synlig strategi, mål mot faktisk utfall og
        begrunnelse for auto-tiltak (kun superadmin). API:{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">GET /api/ai/usage?billing=1</code>{" "}
        og overstyring via{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">PATCH /api/ai/business-engine</code>.
      </p>

      {posSnapshot && posSnapshot.lastRunAt != null ? (
        <div
          className="mt-3 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs text-slate-700"
          role="status"
          aria-live="polite"
        >
          <span className="font-semibold text-slate-900">Produktsystem (POS)</span>
          {" · "}
          Siste syklus {new Date(posSnapshot.lastRunAt).toLocaleString("nb-NO")}
          {posSnapshot.signalPriority ? ` · prioritet ${posSnapshot.signalPriority}` : ""}
          {typeof posSnapshot.activeSurfaces === "number" ? ` · ${posSnapshot.activeSurfaces} aktive flater` : ""}
          {typeof posSnapshot.suppressedDuplicates === "number" && posSnapshot.suppressedDuplicates > 0
            ? ` · ${posSnapshot.suppressedDuplicates} duplikater undertrykt`
            : ""}
          {typeof posSnapshot.skippedLowConfidence === "number" && posSnapshot.skippedLowConfidence > 0
            ? ` · ${posSnapshot.skippedLowConfidence} under konfidenssterskel`
            : ""}
          {typeof posSnapshot.effectiveMinConfidence === "number"
            ? ` · terskel ${posSnapshot.effectiveMinConfidence.toFixed(3)}`
            : ""}
          {typeof posSnapshot.effectiveMaxActive === "number"
            ? ` · maks ${posSnapshot.effectiveMaxActive} aktive`
            : ""}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500" role="status">
          Produktsystem (POS): ingen fullført syklus registrert på denne instansen ennå.
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <AiTreeNav />

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <label htmlFor="ai-overview-month" className="block text-xs font-medium text-slate-600">
                Måned (YYYY-MM, tom = pågående måned)
              </label>
              <input
                id="ai-overview-month"
                type="text"
                inputMode="numeric"
                placeholder="2025-03"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="mt-1 w-40 rounded border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded border border-slate-200 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {loading ? "Laster…" : "Oppdater"}
            </button>
            <Link
              href="/backoffice/ai"
              className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Tilbake til AI Command Center
            </Link>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}

          {data && (
            <>
              {data.objective && data.decision_explanation && (
                <section className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-slate-800">Forretningsmotor (AI)</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Forretningsscore, mål mot faktisk utfall og tydelig forklaring på hva som skjer nå og hva dere kan
                    forvente. Overstyring lagres i plattformstyring (superadmin).
                  </p>
                  <AiMotorDemoTopLinks demoDeepLinkHref={demoDeepLinkHref} variant="live" />
                  <AiMotorDemoCoreSection
                    decision={data.decision_explanation}
                    objective={data.objective}
                    totals={{
                      margin_usd: data.totals.margin_usd,
                      revenue_partial: data.totals.revenue_partial,
                    }}
                    periodLabel={data.period}
                    monthForLink={month}
                    variant="live"
                    belowCtaNotice={engineMessage}
                  />
                  {data.objective.strategy_state?.by_mode &&
                  (["profit", "growth", "balance"] as const).some(
                    (m) => data.objective?.strategy_state?.by_mode?.[m]?.samples,
                  ) ? (
                    <div className="mt-4 rounded-md border border-slate-100 bg-white px-3 py-2">
                      <h3 className="text-xs font-semibold text-slate-700">Strategiutfall over tid</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Akkumulert Forretningsscore (EMA) per modus når modus har vært aktiv.
                      </p>
                      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                        {(["profit", "growth", "balance"] as const).map((m) => {
                          const b = data.objective?.strategy_state?.by_mode?.[m];
                          if (!b || b.samples < 1) return null;
                          return (
                            <li key={m} className="rounded border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-sm">
                              <span className="font-medium text-slate-800">{STRATEGY_LABELS_NB[m]}</span>
                              <p className="text-xs text-slate-600">
                                {b.samples} observasjon{b.samples !== 1 ? "er" : ""} · Forretningsscore EMA{" "}
                                {formatPct01(b.score_ema, 1)}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs font-medium text-slate-600">Manuell strategi-overstyring</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Velg modus eller «Automatikk» for å fjerne dashboard-lås (miljø og auto gjelder igjen).
                      {data.business_engine?.strategy_override != null ? (
                        <span className="block pt-1 font-medium text-slate-700">
                          Aktiv dashboard-lås: {STRATEGY_LABELS_NB[data.business_engine.strategy_override]}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["profit", "growth", "balance"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          disabled={strategyBusy}
                          onClick={() => void patchStrategyOverride(m)}
                          className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {STRATEGY_LABELS_NB[m]}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={strategyBusy}
                        onClick={() => void patchStrategyOverride("auto")}
                        className="min-h-[44px] rounded-md border border-slate-800 bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                      >
                        {strategyBusy ? "…" : "Automatikk"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <h3 className="text-xs font-semibold text-slate-700">Strategi-tidslinje</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Logges når strategi endres (auto-kjøring eller dashboard). Nyeste først.
                    </p>
                    {data.objective.strategy_state?.timeline?.length ? (
                      <ul className="mt-2 space-y-2">
                        {data.objective.strategy_state.timeline.map((e, idx) => (
                          <li
                            key={`${e.at}-${e.period}-${idx}`}
                            className="rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm break-words"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium text-slate-900">{STRATEGY_LABELS_NB[e.mode]}</span>
                              <span className="text-xs text-slate-500">
                                {TIMELINE_SOURCE_NB[e.source]} · {e.period}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-600">
                              {e.at ? new Date(e.at).toLocaleString("nb-NO") : "–"}
                              {e.score != null && Number.isFinite(e.score)
                                ? ` · Forretningsscore ${formatPct01(e.score, 1)}`
                                : ""}
                              {e.margin_gap_base != null && Number.isFinite(e.margin_gap_base)
                                ? ` · margin-gap ${formatPct01(e.margin_gap_base, 0)}`
                                : ""}
                              {e.growth_gap_base != null && Number.isFinite(e.growth_gap_base)
                                ? ` · vekst-gap ${formatPct01(e.growth_gap_base, 0)}`
                                : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        Ingen hendelser ennå — kjør auto-governance eller bruk overstyring over for å opprette
                        historikk.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {(data.alerts.margin_below_threshold || data.alerts.any_company_flagged || data.totals.revenue_partial) && (
                <div className="space-y-2" role="status">
                  {data.totals.revenue_partial && (
                    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      Delvis inntektsbilde: minst ett selskap mangler list MRR (sjekk{" "}
                      <code className="text-xs">SAAS_LIST_MRR_*_USD</code>). Margin vises ikke før alle planer er
                      konfigurert.
                    </div>
                  )}
                  {data.alerts.margin_below_threshold && (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                      Margin under terskel: aggregert margin {formatUsd(data.totals.margin_usd)} er lavere enn{" "}
                      {formatUsd(data.alerts.min_margin_usd)} (miljøvariabel{" "}
                      <code className="text-xs">AI_DASHBOARD_MIN_MARGIN_USD</code>).
                    </div>
                  )}
                  {data.alerts.any_company_flagged && (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                      <p className="font-medium">Selskap markert for AI-fakturering</p>
                      <ul className="mt-1 list-inside list-disc text-red-800">
                        {data.flagged_companies.map((f) => (
                          <li key={f.company_id}>
                            {f.name ?? f.company_id.slice(0, 8)}
                            {f.ai_billing_flag_reason ? ` — ${f.ai_billing_flag_reason}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-800">AI anbefalinger</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Én idempotensnøkkel per knapp (gjentatt kall uten duplikat-endring), forhåndsvisning uten skriving, bekreftelse
                  for høyrisiko, inverse i API-svar, rader i{" "}
                  <code className="text-[11px]">ai_governance_apply_log</code> og audit_logs.
                </p>
                {applyFeedback && (
                  <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-sm text-emerald-900">
                    {applyFeedback}
                  </p>
                )}
                {!data.recommendations || data.recommendations.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">Ingen anbefalinger for valgt periode.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {data.recommendations.map((r) => (
                      <li
                        key={r.id}
                        className={[
                          "rounded-lg border px-3 py-2.5 text-sm",
                          severityCardClass(r.severity),
                        ].join(" ")}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {KIND_LABELS[r.kind]}
                          </span>
                          <span
                            className={[
                              "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                              r.severity === "critical"
                                ? "bg-red-200 text-red-950"
                                : r.severity === "warn"
                                  ? "bg-amber-200 text-amber-950"
                                  : "bg-slate-200 text-slate-800",
                            ].join(" ")}
                          >
                            {r.severity === "critical" ? "Kritisk" : r.severity === "warn" ? "Varsel" : "Info"}
                          </span>
                        </div>
                        <p className="mt-1 font-medium text-slate-900">{r.title}</p>
                        <p className="mt-0.5 text-slate-700">{r.detail}</p>
                        {(r.refs?.company_id || r.refs?.tool) && (
                          <p className="mt-1 font-mono text-[11px] text-slate-500">
                            {r.refs.company_id ? <>company_id: {r.refs.company_id}</> : null}
                            {r.refs.company_id && r.refs.tool ? " · " : null}
                            {r.refs.tool ? <>tool: {r.refs.tool}</> : null}
                          </p>
                        )}
                        {Array.isArray(r.apply_options) && r.apply_options.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {r.apply_options.map((opt) => (
                              <div key={opt.option_id} className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  disabled={applyBusyKey === `${opt.option_id}-dry`}
                                  onClick={() => void handleApplyDryRun(r.id, opt)}
                                  className="min-h-[44px] rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {applyBusyKey === `${opt.option_id}-dry` ? "…" : `Forhåndsvis · ${opt.label}`}
                                </button>
                                <button
                                  type="button"
                                  disabled={applyBusyKey === opt.option_id}
                                  onClick={() => void handleApply(r.id, opt)}
                                  className="min-h-[44px] rounded-md border border-slate-800 bg-slate-800 px-3 py-2 text-left text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                                >
                                  {applyBusyKey === opt.option_id ? "…" : `Utfør · ${opt.label}`}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-800">Governance-historikk</h2>
                  <button
                    type="button"
                    onClick={() => void loadHistory()}
                    disabled={historyLoading}
                    className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {historyLoading ? "Laster…" : "Oppdater"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Siste apply/dry-run/rollback med snapshot_before / snapshot_after (JSON). API:{" "}
                  <code className="text-[11px]">GET /api/ai/recommendation/history</code>
                </p>
                {!historyRows || historyRows.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    {historyRows === null ? "Laster historikk…" : "Ingen rader (kjør migrasjon eller utfør en handling)."}
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="py-2 pr-2 font-medium text-slate-700">Tid</th>
                          <th className="py-2 pr-2 font-medium text-slate-700">Handling</th>
                          <th className="py-2 pr-2 font-medium text-slate-700">Dry-run</th>
                          <th className="py-2 pr-2 font-medium text-slate-700">Inverse</th>
                          <th className="py-2 pr-2 font-medium text-slate-700">Rollback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRows.map((row) => {
                          const h = row as Record<string, unknown>;
                          const id = typeof h.id === "string" ? h.id : "";
                          const created = typeof h.created_at === "string" ? h.created_at : "";
                          const act = typeof h.action === "string" ? h.action : "";
                          const dry = h.dry_run === true;
                          const inv = typeof h.inverse_action === "string" ? h.inverse_action : "–";
                          const rolled = h.rolled_back_at != null;
                          return (
                            <tr key={id || created} className="border-b border-slate-100 align-top">
                              <td className="py-2 pr-2 whitespace-nowrap text-xs text-slate-600">
                                {created ? new Date(created).toLocaleString("nb-NO") : "–"}
                              </td>
                              <td className="py-2 pr-2 font-mono text-[11px] text-slate-800">{act}</td>
                              <td className="py-2 pr-2">{dry ? "Ja" : "Nei"}</td>
                              <td className="py-2 pr-2 font-mono text-[10px] text-slate-600">{inv}</td>
                              <td className="py-2 pr-2">
                                {!dry && !rolled && act !== "rollback_governance_apply" ? (
                                  <button
                                    type="button"
                                    disabled={applyBusyKey === `rollback-${id}`}
                                    onClick={() => void handleRollback(id)}
                                    className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                                  >
                                    Angre
                                  </button>
                                ) : rolled ? (
                                  <span className="text-xs text-slate-400">Rullet tilbake</span>
                                ) : (
                                  <span className="text-xs text-slate-400">–</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-800">Sammendrag (MTD / {data.period})</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  UTC: {new Date(data.period_bounds_utc.start).toLocaleString("nb-NO")} –{" "}
                  {new Date(data.period_bounds_utc.end).toLocaleString("nb-NO")}
                </p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md bg-slate-50 px-3 py-2">
                    <dt className="text-xs font-medium text-slate-500">AI-kostnad</dt>
                    <dd className="text-lg font-semibold tabular-nums text-slate-900">
                      {formatUsd(data.totals.total_ai_cost_usd)}
                    </dd>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2">
                    <dt className="text-xs font-medium text-slate-500">List MRR (sum)</dt>
                    <dd className="text-lg font-semibold tabular-nums text-slate-900">
                      {formatUsd(data.totals.total_list_mrr_usd)}
                    </dd>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2">
                    <dt className="text-xs font-medium text-slate-500">Margin</dt>
                    <dd className="text-lg font-semibold tabular-nums text-slate-900">
                      {formatUsd(data.totals.margin_usd)}
                    </dd>
                  </div>
                  <div className="rounded-md bg-slate-50 px-3 py-2">
                    <dt className="text-xs font-medium text-slate-500">Kjøringer (runner)</dt>
                    <dd className="text-lg font-semibold tabular-nums text-slate-900">{data.totals.total_runs}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-800">Bruk per verktøy</h2>
                <p className="mt-1 text-xs text-slate-500">Rader med action <code className="text-[11px]">batch</code> i aktivitetslogg.</p>
                {data.by_tool.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Ingen kjøringer i perioden.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="py-2 pr-3 font-medium text-slate-700">Verktøy</th>
                          <th className="py-2 pr-3 font-medium text-slate-700">Kjøringer</th>
                          <th className="py-2 pr-3 font-medium text-slate-700">Kostnad (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.by_tool.map((t) => (
                          <tr key={t.tool} className="border-b border-slate-100">
                            <td className="py-2 pr-3 font-mono text-xs text-slate-800">{t.tool}</td>
                            <td className="py-2 pr-3 tabular-nums text-slate-700">{t.runs}</td>
                            <td className="py-2 pr-3 tabular-nums text-slate-700">{formatUsd(t.cost_estimate_usd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-800">Topp selskaper etter kostnad</h2>
                {data.top_companies.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Ingen selskapsdata.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="py-2 pr-3 font-medium text-slate-700">Selskap</th>
                          <th className="py-2 pr-3 font-medium text-slate-700">Plan</th>
                          <th className="py-2 pr-3 font-medium text-slate-700">Kostnad</th>
                          <th className="py-2 pr-3 font-medium text-slate-700">MRR</th>
                          <th className="py-2 pr-3 font-medium text-slate-700">Margin</th>
                          <th className="py-2 pr-3 font-medium text-slate-700">Flagget</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_companies.map((c) => (
                          <tr key={c.company_id} className="border-b border-slate-100">
                            <td className="py-2 pr-3 text-slate-800">{c.name ?? `${c.company_id.slice(0, 8)}…`}</td>
                            <td className="py-2 pr-3 text-slate-600">{c.plan}</td>
                            <td className="py-2 pr-3 tabular-nums text-slate-700">{formatUsd(c.cost_estimate_usd)}</td>
                            <td className="py-2 pr-3 tabular-nums text-slate-700">{formatUsd(c.list_mrr_usd)}</td>
                            <td className="py-2 pr-3 tabular-nums text-slate-700">
                              {formatUsd(c.margin_vs_cost_usd)}
                            </td>
                            <td className="py-2 pr-3 text-slate-700">{c.ai_billing_flagged ? "Ja" : "Nei"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
