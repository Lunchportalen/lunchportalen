"use client";

import { useState } from "react";

type Funnel = {
  clicks: number;
  leads: number;
  orders: number;
  clickToLead: number;
  leadToOrder: number;
  explain: string;
};

type Issue = {
  type: string;
  stage: string;
  severity: string;
  message: string;
  metrics: Record<string, number>;
};

type RoadmapItem = {
  priority: number;
  action: string;
  impactEstimate: number;
  effort: string;
  reason: string;
  formula: string;
};

export default function StrategyClient() {
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [meta, setMeta] = useState<{ rid?: string; dataExplain?: string; windowDays?: number } | null>(null);

  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/strategy/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ windowDays }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { funnel: Funnel; issues: Issue[]; roadmap: RoadmapItem[]; meta?: typeof meta };
        message?: string;
      };
      if (!json.ok || !json.data) {
        setErr(json.message ?? "Kunne ikke kjøre analyse.");
        setFunnel(null);
        setIssues([]);
        setRoadmap([]);
        setMeta(null);
        return;
      }
      setFunnel(json.data.funnel);
      setIssues(json.data.issues ?? []);
      setRoadmap(json.data.roadmap ?? []);
      setMeta(json.data.meta ?? null);
    } catch {
      setErr("Nettverksfeil.");
      setFunnel(null);
      setIssues([]);
      setRoadmap([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Strategi</h1>
        <p className="mt-1 text-sm text-slate-600">
          Data fra ordre, lead_pipeline og ai_activity_log. Anbefalinger krever menneskelig godkjenning — ingenting
          implementeres automatisk.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Vindu (dager)
          <input
            type="number"
            min={7}
            max={90}
            className="w-32 rounded-lg border border-slate-200 px-3 py-2"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="rounded-full border border-slate-900 bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Kjører…" : "Kjør analyse"}
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {meta?.rid && (
        <p className="text-xs text-slate-500">
          Kjøring <span className="font-mono">{meta.rid}</span>
          {meta.windowDays != null ? ` · ${meta.windowDays} d` : ""}
        </p>
      )}

      {meta?.dataExplain && (
        <section className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
          <h2 className="mb-1 font-semibold text-slate-900">Datagrunnlag</h2>
          <p className="whitespace-pre-wrap">{meta.dataExplain}</p>
        </section>
      )}

      {funnel && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Trakt</h2>
          <ul className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <li>Klikk (social_click): {funnel.clicks}</li>
            <li>Leads: {funnel.leads}</li>
            <li>Ordre: {funnel.orders}</li>
            <li>Click → lead: {funnel.clickToLead.toFixed(4)}</li>
            <li>Lead → ordre: {funnel.leadToOrder.toFixed(4)}</li>
          </ul>
          <p className="mt-2 text-xs text-slate-500">{funnel.explain}</p>
        </section>
      )}

      {issues.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Flaskehalser</h2>
          <ul className="space-y-3">
            {issues.map((i) => (
              <li key={`${i.stage}-${i.type}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <span className="font-medium text-slate-900">{i.message}</span>
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-xs uppercase">{i.severity}</span>
                  <span className="text-xs text-slate-500">{i.stage}</span>
                </div>
                <pre className="mt-2 max-h-32 overflow-auto text-xs text-slate-600">
                  {JSON.stringify(i.metrics, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        </section>
      )}

      {roadmap.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Prioritert veikart</h2>
          <p className="mb-3 text-xs text-slate-500">
            Tall er estimater for prioritering — ikke budsjett. Godkjenn endringer manuelt i eget spor.
          </p>
          <ol className="space-y-3">
            {roadmap.map((r) => (
              <li key={r.priority} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-lg font-semibold text-slate-900">#{r.priority}</span>
                  <span className="font-medium text-slate-800">{r.action}</span>
                  <span className="text-xs text-slate-500">innsats {r.effort}</span>
                  <span className="text-xs text-slate-500">~ {r.impactEstimate} (enhet som omsetning)</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{r.reason}</p>
                <p className="mt-2 text-xs text-slate-600">{r.formula}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!loading && funnel && issues.length === 0 && roadmap.length === 0 && (
        <p className="text-sm text-slate-600">Ingen flaskehalser over terskel i dette vinduet.</p>
      )}
    </div>
  );
}
