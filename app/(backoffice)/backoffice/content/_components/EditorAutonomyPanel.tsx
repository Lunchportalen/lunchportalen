"use client";

import type { DecisionResult } from "@/lib/ai/decisionEngine";

export type DashboardMetricsPayload = {
  conversionRate: number | null;
  traffic: number | null;
  engagement: number | null;
  revenueProxy: number | null;
};

export type DashboardInsightsPayload = {
  trends: string[];
  anomalies: string[];
  opportunities: string[];
};

export type DashboardDecisionPayload = {
  decision: DecisionResult;
  policy: { allowed: boolean; requiresApproval: boolean; explain: string };
  preview: { executed: boolean; actionPreview: string; explain: string };
};

export type EditorAutonomyPanelProps = {
  enabled: boolean;
  busy: boolean;
  error: string | null;
  metrics: DashboardMetricsPayload | null;
  insights: DashboardInsightsPayload | null;
  decisionRow: DashboardDecisionPayload | null;
  automationResult: string | null;
  onRefreshDashboard: () => void;
  onPreviewAutomation: (decision: DecisionResult) => void;
  onApproveExecute: (decision: DecisionResult) => void;
};

function fmtPct(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(2)} %`;
}

function fmtNum(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n >= 1000 ? n.toLocaleString("nb-NO") : String(n);
}

/**
 * AI business OS (read + gated automation): metrics, insights, decisions, preview/approve.
 */
export function EditorAutonomyPanel({
  enabled,
  busy,
  error,
  metrics,
  insights,
  decisionRow,
  automationResult,
  onRefreshDashboard,
  onPreviewAutomation,
  onApproveExecute,
}: EditorAutonomyPanelProps) {
  if (!enabled) return null;

  const d = decisionRow?.decision;

  return (
    <section
      aria-label="AI innsikt og beslutninger"
      className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI innsikt</p>
        <button
          type="button"
          disabled={busy}
          onClick={onRefreshDashboard}
          className="min-h-[36px] rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-2.5 text-[11px] font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50"
        >
          {busy ? "Laster…" : "Oppdater dashboard"}
        </button>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-[rgb(var(--lp-muted))]">
        Beslutninger er forklarbare. Ingen auto-publisering, ingen annonsebudsjett. Utførelse er kun trygg
        akseptering — faktiske endringer gjør du manuelt.
      </p>

      {error ? (
        <p className="mt-2 text-xs text-red-700" aria-live="polite">
          {error}
        </p>
      ) : null}

      {metrics ? (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 p-2 text-[11px]">
          <div>
            <span className="text-[rgb(var(--lp-muted))]">Konvertering</span>
            <div className="font-semibold tabular-nums text-[rgb(var(--lp-text))]">{fmtPct(metrics.conversionRate)}</div>
          </div>
          <div>
            <span className="text-[rgb(var(--lp-muted))]">Trafikk (proxy)</span>
            <div className="font-semibold tabular-nums text-[rgb(var(--lp-text))]">{fmtNum(metrics.traffic)}</div>
          </div>
          <div>
            <span className="text-[rgb(var(--lp-muted))]">Engasjement</span>
            <div className="font-semibold tabular-nums text-[rgb(var(--lp-text))]">{fmtPct(metrics.engagement)}</div>
          </div>
          <div>
            <span className="text-[rgb(var(--lp-muted))]">Omsetningsproxy</span>
            <div className="font-semibold tabular-nums text-[rgb(var(--lp-text))]">{fmtNum(metrics.revenueProxy)}</div>
          </div>
        </div>
      ) : null}

      {insights ? (
        <div className="mt-3 space-y-2 text-[11px] text-[rgb(var(--lp-text))]">
          {insights.trends.length > 0 ? (
            <div>
              <p className="font-semibold text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">Trender</p>
              <ul className="mt-0.5 list-inside list-disc space-y-0.5">
                {insights.trends.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {insights.anomalies.length > 0 ? (
            <div>
              <p className="font-semibold text-[10px] uppercase tracking-wide text-amber-800">Anomalier</p>
              <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-amber-950">
                {insights.anomalies.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {insights.opportunities.length > 0 ? (
            <div>
              <p className="font-semibold text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">Muligheter</p>
              <ul className="mt-0.5 list-inside list-disc space-y-0.5">
                {insights.opportunities.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {decisionRow && d ? (
        <div className="mt-3 rounded-lg border border-[rgb(var(--lp-border))] bg-slate-50/90 p-2.5">
          <p className="text-[10px] font-semibold uppercase text-[rgb(var(--lp-muted))]">Anbefalt handling</p>
          <p className="mt-1 text-xs font-medium text-[rgb(var(--lp-text))]">{d.recommendation}</p>
          <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
            <span className="font-medium text-[rgb(var(--lp-text))]">{d.decisionType}</span> · tillit{" "}
            {(d.confidence * 100).toFixed(0)} %
          </p>
          <p className="mt-1 text-[11px] text-[rgb(var(--lp-text))]">{d.reason}</p>
          <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
            Basert på: {d.basedOn.join(", ") || "—"}
          </p>
          <div className="mt-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700">
            <span className="font-semibold">Policy:</span> {decisionRow.policy.explain}
            <div className="mt-0.5">
              tillatt automasjon: {decisionRow.policy.allowed ? "ja" : "nei"} · krever godkjenning:{" "}
              {decisionRow.policy.requiresApproval ? "ja" : "nei"}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onPreviewAutomation(d)}
              className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 disabled:opacity-50"
            >
              Forhåndsvis automatisering
            </button>
            <button
              type="button"
              disabled={busy || !decisionRow.policy.allowed}
              onClick={() => onApproveExecute(d)}
              className="min-h-[40px] rounded-lg px-3 text-xs font-semibold text-pink-600 underline decoration-pink-500/50 underline-offset-4 hover:underline disabled:opacity-40"
              title={
                !decisionRow.policy.allowed
                  ? "Blokkert av policy"
                  : "Registrerer trygg akseptering — ingen CMS/publisering"
              }
            >
              Godkjenn og kjør (trygt)
            </button>
          </div>
        </div>
      ) : null}

      {automationResult ? (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 p-2 text-[10px] text-[rgb(var(--lp-text))]">
          {automationResult}
        </pre>
      ) : null}
    </section>
  );
}
