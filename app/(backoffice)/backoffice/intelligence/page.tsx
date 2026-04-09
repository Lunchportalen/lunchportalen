"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  IntelligenceEvent,
  IntelligenceTrends,
  LearningHistoryItem,
  PublicSystemSignals,
} from "@/lib/ai/intelligence/types";

type DashboardPayload = {
  generatedAt: string;
  signals: PublicSystemSignals;
  recentEvents: IntelligenceEvent[];
  trends: IntelligenceTrends;
  learningHistory: LearningHistoryItem[];
  meta?: {
    eventCounts: Record<string, number>;
    topPatterns: Array<{ key: string; weight: number }>;
  };
};

type QueryResponse = {
  question: string;
  answer: string;
  basedOn: string[];
  confidence: string;
  snapshotGeneratedAt?: string;
};

export default function SystemIntelligencePage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [qAns, setQAns] = useState<QueryResponse | null>(null);
  const [qLoading, setQLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/backoffice/ai/intelligence/dashboard", { credentials: "include" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: DashboardPayload; message?: string } | null;
      if (!json?.ok || !json.data) {
        setErr(json?.message ?? "Kunne ikke laste intelligens.");
        setData(null);
        return;
      }
      setData(json.data);
    } catch {
      setErr("Nettverksfeil.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runQuery = useCallback(async () => {
    const question = q.trim();
    if (!question) return;
    setQLoading(true);
    setQAns(null);
    try {
      const res = await fetch("/api/backoffice/ai/intelligence/query", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: QueryResponse } | null;
      if (json?.ok && json.data) setQAns(json.data);
    } finally {
      setQLoading(false);
    }
  }, [q]);

  return (
    <div className="mx-auto max-w-[1440px] overflow-auto px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">System Intelligence</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Én felles hjerne: signaler, trender og læring på tvers av GTM, revenue, design og eksperimenter. Alle beslutninger skal
            kunne spores til samme hendelseslag.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Oppdater
        </button>
      </div>

      {loading ? <p className="mt-6 text-sm text-slate-500">Laster…</p> : null}
      {err ? <p className="mt-6 text-sm text-red-700">{err}</p> : null}

      {data ? (
        <div className="mt-8 space-y-8">
          <section aria-label="Toppsignaler" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Toppsignaler</h2>
            <p className="mt-1 text-xs text-slate-500">Oppdatert {new Date(data.generatedAt).toLocaleString("nb-NO")}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Beste CTA-fokus</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{data.signals.topCTA}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Spacing</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{data.signals.bestSpacing}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Beste kanal</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{data.signals.bestChannel}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Sterkest bransje</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{data.signals.bestIndustry}</dd>
              </div>
            </dl>
          </section>

          <section aria-label="Trender" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Trender</h2>
            <ul className="mt-3 list-inside list-disc text-sm text-slate-700">
              <li>Oppgang konverteringer: {data.trends.risingConversions ? "ja" : "nei"}</li>
              <li>Fallende ytelse (heuristikk): {data.trends.fallingPerformance ? "ja" : "nei"}</li>
              {data.trends.anomalies.length ? (
                <li>Anomalier: {data.trends.anomalies.join(", ")}</li>
              ) : (
                <li>Ingen anomalier flagget.</li>
              )}
            </ul>
            {data.trends.explain.length ? (
              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                {data.trends.explain.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section aria-label="Spør intelligensen" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Spør systemet</h2>
            <p className="mt-1 text-xs text-slate-500">
              Deterministiske svar (ingen LLM). Prøv «hva fungerer best?» eller «hva feilet nylig?».
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="min-h-10 min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 text-sm"
                placeholder="Spørsmål…"
              />
              <button
                type="button"
                disabled={qLoading}
                onClick={() => void runQuery()}
                className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {qLoading ? "…" : "Kjør"}
              </button>
            </div>
            {qAns ? (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                <p className="font-medium">Svar ({qAns.confidence})</p>
                <p className="mt-2 whitespace-pre-wrap">{qAns.answer}</p>
                <p className="mt-2 text-xs text-slate-500">Basert på: {qAns.basedOn.join(", ") || "—"}</p>
              </div>
            ) : null}
          </section>

          <section aria-label="Læringshistorikk" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Læringshistorikk</h2>
            {data.learningHistory.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Ingen registrerte endring → resultat-par ennå.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {data.learningHistory.map((h, i) => (
                  <li key={`${h.timestamp}-${i}`} className="rounded-lg border border-slate-100 p-2">
                    <span className="font-medium text-slate-900">{h.change}</span>
                    <span className="text-slate-500"> → </span>
                    <span>{h.result}</span>
                    {h.explain ? <p className="mt-1 text-xs text-slate-500">{h.explain}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Nylige hendelser" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nylige hendelser</h2>
            <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-2">Tid</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Kilde</th>
                    <th className="p-2">Kind</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentEvents.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="p-2 whitespace-nowrap">{new Date(e.timestamp).toLocaleString("nb-NO")}</td>
                      <td className="p-2">{e.type}</td>
                      <td className="p-2">{e.source}</td>
                      <td className="p-2">{typeof e.payload.kind === "string" ? e.payload.kind : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {data.meta?.topPatterns?.length ? (
            <section aria-label="Mønstre" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Topp mønstre (vekter)</h2>
              <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                {data.meta.topPatterns.slice(0, 12).map((p) => (
                  <li key={p.key} className="rounded-full border border-slate-200 px-2 py-1">
                    {p.key}: {p.weight.toFixed(2)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
