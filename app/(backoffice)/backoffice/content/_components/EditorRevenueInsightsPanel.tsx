"use client";

import { useCallback, useState } from "react";

import type { BlockAttributionSummary } from "@/lib/analytics/attribution";

type WeakPoint = { blockId?: string; issue: string; evidence: string };
type RevenueAction = {
  type: string;
  target: string;
  change: string;
  reason: string;
  blockId?: string;
};

export type EditorRevenueInsightsPanelProps = {
  enabled: boolean;
  pageId: string;
  blocks: Array<{ id: string; type: string }>;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function fmtCtr(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

/**
 * Revenue Insights — read-only analysis from content_analytics_events + deterministic actions.
 * Design apply: bruk eksisterende design-optimizer med patch fra applyPlan.design.
 */
export function EditorRevenueInsightsPanel({ enabled, pageId, blocks }: EditorRevenueInsightsPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sampleOk, setSampleOk] = useState<boolean | null>(null);
  const [pageMetrics, setPageMetrics] = useState<{
    views: number;
    ctaClicks: number;
    conversions: number;
    ctr: number | null;
    avgScrollPct: number | null;
  } | null>(null);
  const [best, setBest] = useState<BlockAttributionSummary[]>([]);
  const [worst, setWorst] = useState<BlockAttributionSummary[]>([]);
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [actions, setActions] = useState<RevenueAction[]>([]);
  const [applyPlanJson, setApplyPlanJson] = useState<string | null>(null);
  const [autoOptimize, setAutoOptimize] = useState(false);

  const onRun = useCallback(async () => {
    if (!enabled || !pageId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/backoffice/revenue/insights", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, blocks, hoursBack: 168, autoOptimize }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: Record<string, unknown>;
        message?: string;
      } | null;
      if (!res.ok || json?.ok === false) {
        setError(json?.message ?? `Innsikt feilet (HTTP ${res.status}).`);
        return;
      }
      const d = json?.data && isPlainObject(json.data) ? json.data : null;
      if (!d) {
        setError("Tom respons.");
        return;
      }
      setSampleOk(typeof d.sampleOk === "boolean" ? d.sampleOk : null);
      setMessage(typeof d.message === "string" ? d.message : null);
      const pm = d.pageMetrics;
      if (isPlainObject(pm)) {
        setPageMetrics({
          views: typeof pm.views === "number" ? pm.views : 0,
          ctaClicks: typeof pm.ctaClicks === "number" ? pm.ctaClicks : 0,
          conversions: typeof pm.conversions === "number" ? pm.conversions : 0,
          ctr: typeof pm.ctr === "number" ? pm.ctr : null,
          avgScrollPct: typeof pm.avgScrollPct === "number" ? pm.avgScrollPct : null,
        });
      } else {
        setPageMetrics(null);
      }
      setBest(Array.isArray(d.blocksBest) ? (d.blocksBest as BlockAttributionSummary[]) : []);
      setWorst(Array.isArray(d.blocksWorst) ? (d.blocksWorst as BlockAttributionSummary[]) : []);
      setWeakPoints(Array.isArray(d.weakPoints) ? (d.weakPoints as WeakPoint[]) : []);
      setActions(Array.isArray(d.actions) ? (d.actions as RevenueAction[]) : []);
      const plan = d.applyPlan;
      setApplyPlanJson(plan != null ? JSON.stringify(plan, null, 2) : null);
    } catch {
      setError("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  }, [enabled, pageId, blocks, autoOptimize]);

  if (!enabled) return null;

  return (
    <section aria-label="Revenue insights" className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue Insights</p>
      <p className="mt-2 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
        Bygger på faktiske hendelser (<code className="text-[10px]">content_analytics_events</code>) med{" "}
        <code className="text-[10px]">metadata.cms_block_id</code> for blokk-attribusjon. Ingen endringer uten egen
        utførelse — auto-modus filtrerer til trygge designgrep og krever egen kjøring i pipeline.
      </p>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-[rgb(var(--lp-text))]">
        <input
          type="checkbox"
          checked={autoOptimize}
          onChange={(e) => setAutoOptimize(e.target.checked)}
          className="h-4 w-4 rounded border-[rgb(var(--lp-border))]"
        />
        Auto-modus (filtrer forslag til trygge design-endringer)
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={() => void onRun()}
        className="mt-3 min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? "Henter…" : "Kjør innsikt"}
      </button>

      {error ? (
        <p className="mt-2 text-xs text-red-700" aria-live="polite">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">{message}</p> : null}
      {sampleOk === false ? (
        <p className="mt-2 text-xs text-amber-800">Sample ikke tilstrekkelig — ingen skjulte anbefalinger.</p>
      ) : null}

      {pageMetrics ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
          <div className="rounded border border-[rgb(var(--lp-border))] p-2">
            <div className="text-[rgb(var(--lp-muted))]">Visninger</div>
            <div className="font-semibold tabular-nums">{pageMetrics.views}</div>
          </div>
          <div className="rounded border border-[rgb(var(--lp-border))] p-2">
            <div className="text-[rgb(var(--lp-muted))]">CTA-klikk</div>
            <div className="font-semibold tabular-nums">{pageMetrics.ctaClicks}</div>
          </div>
          <div className="rounded border border-[rgb(var(--lp-border))] p-2">
            <div className="text-[rgb(var(--lp-muted))]">CTR</div>
            <div className="font-semibold tabular-nums">{fmtCtr(pageMetrics.ctr)}</div>
          </div>
          <div className="rounded border border-[rgb(var(--lp-border))] p-2 sm:col-span-2">
            <div className="text-[rgb(var(--lp-muted))]">Snitt scroll %</div>
            <div className="font-semibold tabular-nums">
              {pageMetrics.avgScrollPct != null ? `${pageMetrics.avgScrollPct.toFixed(1)}%` : "—"}
            </div>
          </div>
        </div>
      ) : null}

      {best.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Beste blokker (attribuert)</p>
          <ul className="mt-1 space-y-1 text-[11px] text-[rgb(var(--lp-text))]">
            {best.map((b) => (
              <li key={b.blockId}>
                <span className="font-mono">{b.blockId}</span> — CTR {fmtCtr(b.ctr)} — omsetning {b.revenueCents} øre
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {worst.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Svakeste blokker (attribuert)</p>
          <ul className="mt-1 space-y-1 text-[11px] text-[rgb(var(--lp-text))]">
            {worst.map((b) => (
              <li key={`w-${b.blockId}`}>
                <span className="font-mono">{b.blockId}</span> — CTR {fmtCtr(b.ctr)} — klikk {b.ctaClicks}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {weakPoints.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-2">
          <p className="text-[10px] font-semibold uppercase text-amber-900">Konverteringsfunn</p>
          <ul className="mt-1 space-y-1.5 text-[11px] text-amber-950">
            {weakPoints.map((w, i) => (
              <li key={`${w.issue}-${i}`}>
                {w.blockId ? <span className="font-mono">{w.blockId}</span> : null}{" "}
                <span className="font-medium">{w.issue}</span>: {w.evidence}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Foreslåtte tiltak (maks 2)</p>
          <ul className="mt-1 space-y-2 text-[11px] text-[rgb(var(--lp-text))]">
            {actions.map((a, i) => (
              <li key={`${a.type}-${a.target}-${i}`} className="rounded border border-[rgb(var(--lp-border))] p-2">
                <span className="font-semibold">{a.type}</span> · {a.target} → {a.change}
                <p className="mt-1 text-[rgb(var(--lp-muted))]">{a.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {applyPlanJson ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Apply-plan (tørrkjøring)</p>
          <pre className="mt-1 max-h-48 overflow-auto rounded-md border border-[rgb(var(--lp-border))] bg-slate-50 p-2 text-[10px]">
            {applyPlanJson}
          </pre>
          <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
            Design: bruk <code className="text-[10px]">/api/backoffice/ai/design-optimizer/apply</code> med{" "}
            <code className="text-[10px]">applyPlan.design.patch</code>. Innhold: rediger blokk i CMS (ingen stille
            skriving).
          </p>
        </div>
      ) : null}
    </section>
  );
}
