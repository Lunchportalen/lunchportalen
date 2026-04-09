"use client";

import { useCallback, useEffect, useState } from "react";

import DataTrustBadge from "@/components/superadmin/DataTrustBadge";
import { apiErrorMessageFromJson } from "@/lib/ui/apiErrorMessage";

type MarketRow = {
  id: string;
  name: string;
  currency: string;
  language: string;
  enabled: boolean;
};

type MarketsPayload = {
  markets: MarketRow[];
  scaling: { maxMarketsPerRun: number; maxOrchestratedActionsPerMarketPerRun: number };
};

type RunPayload = {
  rid: string;
  markets: Record<string, unknown>;
  errors: Record<string, string>;
};

type RevenuePostRow = {
  postId: string;
  text: string;
  leads: number;
  orders: number;
  revenue: number;
};

type RevenueActionRow = {
  type: string;
  postId: string;
  message: string;
  reason?: string;
  priority?: number;
};

type RevenueAutopilotPayload = {
  summary: {
    posts: number;
    orders: number;
    leads: number;
    winners: number;
    losers: number;
    topRevenueSum: number;
  };
  topPerformingPosts: RevenuePostRow[];
  worstPerformingPosts: RevenuePostRow[];
  actions: RevenueActionRow[];
  projectedImpactNote: string;
};

type ChannelMetricRow = {
  revenue: number;
  orders: number;
  posts: number;
  revenuePerPost: number;
  conversionRate: number;
};

type MultichannelPayload = {
  metrics: Record<string, ChannelMetricRow>;
  allocation: Record<string, number>;
  strategy: Array<{
    channel: string;
    action: string;
    reason: string;
    suggestedBudget: number;
  }>;
  bestChannel: string | null;
  worstChannel: string | null;
  safetyNote: string;
};

type ExpansionPayload = {
  scored: Array<{ market: string; score: number; reason: string }>;
  performance: Record<string, { revenue: number; orders: number }>;
  decisions: Array<{ market: string; action: string; reason: string; recommendationOnly: boolean }>;
  candidate: {
    market: { id: string; name: string; language: string; currency: string; enabled: boolean };
    row: { market: string; score: number; reason: string };
  } | null;
  pilotDrafts: Array<Record<string, unknown>>;
  pilotMaxPosts: number;
  safety: { newMarketsThisRun: number; recommendationOnly: boolean; noPersist: boolean };
};

type GlobalIntelPayload = {
  graphTotalRevenue: number;
  bestPerMarket: Record<string, { combo: string; revenue: number; count: number }>;
  transferPreview: Array<{
    combo: string;
    sourceMarket: string;
    targetMarket: string;
    confidence: number;
  }>;
  safetyNote: string;
};

export default function GlobalControlTowerClient() {
  const [list, setList] = useState<MarketRow[]>([]);
  const [scaling, setScaling] = useState<MarketsPayload["scaling"] | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<RunPayload | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [revenue, setRevenue] = useState<RevenueAutopilotPayload | null>(null);
  const [revenueErr, setRevenueErr] = useState<string | null>(null);
  const [revenueBusy, setRevenueBusy] = useState(false);
  const [multichannel, setMultichannel] = useState<MultichannelPayload | null>(null);
  const [multichannelErr, setMultichannelErr] = useState<string | null>(null);
  const [multichannelBusy, setMultichannelBusy] = useState(false);
  const [expansion, setExpansion] = useState<ExpansionPayload | null>(null);
  const [expansionErr, setExpansionErr] = useState<string | null>(null);
  const [expansionBusy, setExpansionBusy] = useState(false);
  const [globalIntel, setGlobalIntel] = useState<GlobalIntelPayload | null>(null);
  const [globalIntelErr, setGlobalIntelErr] = useState<string | null>(null);
  const [globalIntelBusy, setGlobalIntelBusy] = useState(false);
  const [runErr, setRunErr] = useState<string | null>(null);

  const loadRevenue = useCallback(async () => {
    setRevenueErr(null);
    setRevenueBusy(true);
    try {
      const res = await fetch("/api/revenue/autopilot", { credentials: "same-origin", cache: "no-store" });
      let j: unknown;
      try {
        j = await res.json();
      } catch {
        setRevenueErr("Kunne ikke lese svar fra Revenue Autopilot (ugyldig JSON).");
        return;
      }
      const payload = j as { ok?: boolean; data?: RevenueAutopilotPayload };
      if (res.ok && payload.ok === true && payload.data) {
        setRevenue(payload.data);
        return;
      }
      setRevenueErr(apiErrorMessageFromJson(j, `Kunne ikke laste Revenue Autopilot (HTTP ${res.status}).`));
    } catch (e) {
      setRevenueErr(e instanceof Error ? e.message : "Nettverksfeil ved Revenue Autopilot.");
    } finally {
      setRevenueBusy(false);
    }
  }, []);

  const fetchMultichannel = useCallback(async (opts: { log: boolean }) => {
    setMultichannelErr(null);
    setMultichannelBusy(true);
    try {
      const res = await fetch("/api/growth/multichannel", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ totalBudget: 100_000, log: opts.log }),
        cache: "no-store",
      });
      let j: unknown;
      try {
        j = await res.json();
      } catch {
        setMultichannelErr("Kunne ikke lese svar fra multi-channel (ugyldig JSON).");
        return;
      }
      const payload = j as { ok?: boolean; data?: MultichannelPayload };
      if (res.ok && payload.ok === true && payload.data) {
        setMultichannel(payload.data);
        return;
      }
      setMultichannelErr(apiErrorMessageFromJson(j, `Kunne ikke kjøre multi-channel-analyse (HTTP ${res.status}).`));
    } catch (e) {
      setMultichannelErr(e instanceof Error ? e.message : "Nettverksfeil ved multi-channel.");
    } finally {
      setMultichannelBusy(false);
    }
  }, []);

  const fetchExpansion = useCallback(async () => {
    setExpansionErr(null);
    setExpansionBusy(true);
    try {
      const res = await fetch("/api/global/expand", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; data?: ExpansionPayload };
      if (res.ok && j.ok === true && j.data) {
        setExpansion(j.data);
      } else {
        setExpansionErr("Kunne ikke kjøre global ekspansjon.");
      }
    } catch {
      setExpansionErr("Kunne ikke kjøre global ekspansjon.");
    } finally {
      setExpansionBusy(false);
    }
  }, []);

  const loadGlobalIntel = useCallback(async () => {
    setGlobalIntelErr(null);
    setGlobalIntelBusy(true);
    try {
      const res = await fetch("/api/superadmin/global-intelligence/summary", {
        credentials: "same-origin",
        cache: "no-store",
      });
      let j: unknown;
      try {
        j = await res.json();
      } catch {
        setGlobalIntelErr("Kunne ikke lese svar fra Global Intelligence (ugyldig JSON).");
        return;
      }
      const payload = j as { ok?: boolean; data?: GlobalIntelPayload };
      if (res.ok && payload.ok === true && payload.data) {
        setGlobalIntel(payload.data);
        return;
      }
      setGlobalIntelErr(apiErrorMessageFromJson(j, `Kunne ikke laste Global Intelligence (HTTP ${res.status}).`));
    } catch (e) {
      setGlobalIntelErr(e instanceof Error ? e.message : "Nettverksfeil ved Global Intelligence.");
    } finally {
      setGlobalIntelBusy(false);
    }
  }, []);

  const loadMarkets = useCallback(async () => {
    setLoadErr(null);
    try {
      const res = await fetch("/api/global/markets", { credentials: "same-origin", cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; data?: MarketsPayload };
      if (res.ok && j.ok === true && j.data?.markets) {
        setList(j.data.markets);
        setScaling(j.data.scaling);
        setOverrides((prev) => {
          const next = { ...prev };
          for (const m of j.data!.markets) {
            if (next[m.id] === undefined) next[m.id] = m.enabled;
          }
          return next;
        });
      } else {
        setLoadErr("Kunne ikke laste markeder.");
      }
    } catch {
      setLoadErr("Kunne ikke laste markeder.");
    }
  }, []);

  useEffect(() => {
    void loadMarkets();
  }, [loadMarkets]);

  useEffect(() => {
    void loadRevenue();
  }, [loadRevenue]);

  useEffect(() => {
    void fetchMultichannel({ log: false });
  }, [fetchMultichannel]);

  const runGlobal = useCallback(async () => {
    setBusy(true);
    setRunErr(null);
    try {
      const res = await fetch("/api/global/run", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ marketOverrides: overrides }),
        cache: "no-store",
      });
      let j: unknown;
      try {
        j = await res.json();
      } catch {
        setRunErr("Kunne ikke lese svar fra orkestrering (ugyldig JSON).");
        return;
      }
      const payload = j as { ok?: boolean; data?: RunPayload };
      if (res.ok && payload.ok === true && payload.data) {
        setLastRun(payload.data);
        return;
      }
      setRunErr(apiErrorMessageFromJson(j, `Global orkestrering feilet (HTTP ${res.status}).`));
    } catch (e) {
      setRunErr(e instanceof Error ? e.message : "Nettverksfeil ved orkestrering.");
    } finally {
      setBusy(false);
    }
  }, [overrides]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runGlobal()}
          className="min-h-[44px] rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Kjører…" : "Kjør global orkestrering"}
        </button>
        <button
          type="button"
          onClick={() => void loadMarkets()}
          className="min-h-[44px] rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-800"
        >
          Oppdater liste
        </button>
      </div>

      {loadErr ? <p className="text-sm text-rose-700">{loadErr}</p> : null}

      <section className="rounded-lg border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Global Intelligence</h2>
            <DataTrustBadge kind="REAL" />
          </div>
          <button
            type="button"
            disabled={globalIntelBusy}
            onClick={() => void loadGlobalIntel()}
            className="min-h-[44px] rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-800 disabled:opacity-50"
          >
            {globalIntelBusy ? "Oppdaterer…" : "Oppdater"}
          </button>
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
          Ordre = sannhet per marked. Grafen bygges fra MVO-logger; overføringer er forslag (krever lokal test før
          utrulling).
        </p>
        {globalIntelErr ? (
          <div
            role="alert"
            className="mt-2 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{globalIntelErr}</span>
            <button
              type="button"
              disabled={globalIntelBusy}
              onClick={() => void loadGlobalIntel()}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-red-800 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
            >
              Prøv igjen
            </button>
          </div>
        ) : null}
        {globalIntel ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-[rgb(var(--lp-muted))]">{globalIntel.safetyNote}</p>
            <div className="rounded border border-black/10 bg-white px-3 py-2 text-sm">
              <span className="text-[rgb(var(--lp-muted))]">Aggregert omsetning i graf (logg-basert): </span>
              <strong className="font-medium text-neutral-900">{globalIntel.graphTotalRevenue.toFixed(2)}</strong>
            </div>
            <div className="overflow-x-auto rounded border border-black/10 bg-white">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-black/10 bg-neutral-50 text-xs uppercase text-[rgb(var(--lp-muted))]">
                  <tr>
                    <th className="px-3 py-2">Marked</th>
                    <th className="px-3 py-2">Beste combo</th>
                    <th className="px-3 py-2">Omsetning</th>
                    <th className="px-3 py-2">Antall logg</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(globalIntel.bestPerMarket).length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-[rgb(var(--lp-muted))]" colSpan={4}>
                        Ingen MVO-læring ennå (eller mangler marked på logger).
                      </td>
                    </tr>
                  ) : null}
                  {Object.entries(globalIntel.bestPerMarket).map(([market, row]) => {
                    const r = row as { combo: string; revenue: number; count: number };
                    return (
                    <tr key={market} className="border-b border-black/5">
                      <td className="px-3 py-2 font-mono text-xs text-neutral-800">{market}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-neutral-700">{r.combo}</td>
                      <td className="px-3 py-2">{r.revenue.toFixed(2)}</td>
                      <td className="px-3 py-2">{r.count}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">
                  Overføringer (confidence = kilde-omsetning)
                </h3>
                <DataTrustBadge kind="ESTIMATED" />
              </div>
              <ul className="mt-2 divide-y divide-black/10 rounded border border-black/10 bg-white">
                {globalIntel.transferPreview.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">Ingen kandidater over terskel.</li>
                ) : (
                  globalIntel.transferPreview.map((t, i) => (
                    <li key={`${t.combo}-${t.sourceMarket}-${t.targetMarket}-${i}`} className="px-3 py-2 text-sm">
                      <span className="font-medium text-neutral-900">
                        {t.sourceMarket} → {t.targetMarket}
                      </span>
                      <span className="ml-2 font-mono text-[11px] text-neutral-600">{t.combo}</span>
                      <span className="ml-2 text-xs text-[rgb(var(--lp-muted))]">confidence {t.confidence.toFixed(2)}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : !globalIntelBusy && !globalIntelErr ? (
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Ingen data ennå.</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Revenue Autopilot</h2>
            <DataTrustBadge kind="REAL" />
          </div>
          <button
            type="button"
            disabled={revenueBusy}
            onClick={() => void loadRevenue()}
            className="min-h-[44px] rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-800 disabled:opacity-50"
          >
            {revenueBusy ? "Oppdaterer…" : "Oppdater"}
          </button>
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
          Ordre = sannhet. Forslag er deterministiske og overstyrer ikke manuelt innhold.
        </p>
        {revenueErr ? <p className="mt-2 text-sm text-rose-700">{revenueErr}</p> : null}
        {revenue ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-black/10 bg-white px-3 py-2 text-center">
                <p className="text-xs uppercase text-[rgb(var(--lp-muted))]">Innlegg</p>
                <p className="text-lg font-semibold text-neutral-900">{revenue.summary.posts}</p>
              </div>
              <div className="rounded border border-black/10 bg-white px-3 py-2 text-center">
                <p className="text-xs uppercase text-[rgb(var(--lp-muted))]">Vinnere / tapere</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {revenue.summary.winners} / {revenue.summary.losers}
                </p>
              </div>
              <div className="rounded border border-black/10 bg-white px-3 py-2 text-center">
                <p className="text-xs uppercase text-[rgb(var(--lp-muted))]">Ordre / leads</p>
                <p className="text-lg font-semibold text-neutral-900">
                  {revenue.summary.orders} / {revenue.summary.leads}
                </p>
              </div>
              <div className="rounded border border-black/10 bg-white px-3 py-2 text-center">
                <p className="text-xs uppercase text-[rgb(var(--lp-muted))]">Topp 3 sum</p>
                <p className="text-lg font-semibold text-neutral-900">{revenue.summary.topRevenueSum.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-xs text-[rgb(var(--lp-muted))]">{revenue.projectedImpactNote}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="min-w-0">
                <h3 className="text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">Beste innlegg (attribuert)</h3>
                <ul className="mt-2 space-y-2">
                  {revenue.topPerformingPosts.length === 0 ? (
                    <li className="text-sm text-[rgb(var(--lp-muted))]">Ingen omsetning attribuert ennå.</li>
                  ) : (
                    revenue.topPerformingPosts.map((p) => (
                      <li
                        key={p.postId}
                        className="rounded border border-black/10 bg-white px-3 py-2 text-sm text-neutral-800"
                      >
                        <p className="break-words font-mono text-[11px] text-neutral-500">{p.postId}</p>
                        <p className="mt-1 break-words line-clamp-3">{p.text || "—"}</p>
                        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                          omsetning {p.revenue.toFixed(2)} · ordre {p.orders} · leads {p.leads}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">Tapere (leads, 0 ordre)</h3>
                <ul className="mt-2 space-y-2">
                  {revenue.worstPerformingPosts.length === 0 ? (
                    <li className="text-sm text-[rgb(var(--lp-muted))]">Ingen slike mønstre funnet.</li>
                  ) : (
                    revenue.worstPerformingPosts.map((p) => (
                      <li
                        key={p.postId}
                        className="rounded border border-black/10 bg-white px-3 py-2 text-sm text-neutral-800"
                      >
                        <p className="break-words font-mono text-[11px] text-neutral-500">{p.postId}</p>
                        <p className="mt-1 break-words line-clamp-3">{p.text || "—"}</p>
                        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                          leads {p.leads} · ordre {p.orders}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">Anbefalte tiltak</h3>
                <DataTrustBadge kind="ESTIMATED" />
              </div>
              <ul className="mt-2 divide-y divide-black/10 rounded border border-black/10 bg-white">
                {revenue.actions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">Ingen tiltak (tom data eller ingen treff).</li>
                ) : (
                  revenue.actions.map((a) => (
                    <li key={`${a.type}-${a.postId}`} className="px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="font-medium text-neutral-900">{a.message}</span>
                        <span className="font-mono text-xs text-neutral-500">
                          {a.type}
                          {a.priority != null ? ` · pri ${a.priority}` : ""}
                        </span>
                      </div>
                      {a.reason ? <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{a.reason}</p> : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : !revenueBusy && !revenueErr ? (
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Ingen data ennå.</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Multi-channel scaling</h2>
            <DataTrustBadge kind="ESTIMATED" />
          </div>
          <button
            type="button"
            disabled={multichannelBusy}
            onClick={() => void fetchMultichannel({ log: true })}
            className="min-h-[44px] rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-800 disabled:opacity-50"
          >
            {multichannelBusy ? "Analyserer…" : "Oppdater analyse"}
          </button>
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
          Omsetning fra ordre per kanal. Budsjett er nominelt forslag — krever manuell godkjenning før bruk.
        </p>
        {multichannelErr ? (
          <div
            role="alert"
            className="mt-2 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{multichannelErr}</span>
            <button
              type="button"
              disabled={multichannelBusy}
              onClick={() => void fetchMultichannel({ log: false })}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-red-800 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
            >
              Prøv igjen
            </button>
          </div>
        ) : null}
        {multichannel ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-[rgb(var(--lp-muted))]">{multichannel.safetyNote}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                Beste kanal:{" "}
                <strong className="font-medium text-neutral-900">{multichannel.bestChannel ?? "—"}</strong>
              </span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                Svakest (effektivitet):{" "}
                <strong className="font-medium text-neutral-900">{multichannel.worstChannel ?? "—"}</strong>
              </span>
            </div>
            <div className="overflow-x-auto rounded border border-black/10 bg-white">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-black/10 bg-neutral-50 text-xs uppercase text-[rgb(var(--lp-muted))]">
                  <tr>
                    <th className="px-3 py-2">Kanal</th>
                    <th className="px-3 py-2">Omsetning</th>
                    <th className="px-3 py-2">Ordre</th>
                    <th className="px-3 py-2">Poster</th>
                    <th className="px-3 py-2">Kr/post</th>
                    <th className="px-3 py-2">Konv.rate</th>
                    <th className="px-3 py-2">Forslag kr</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(multichannel.metrics).length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-[rgb(var(--lp-muted))]" colSpan={7}>
                        Ingen kanaldata (ingen poster eller ingen attribuerte ordre).
                      </td>
                    </tr>
                  ) : null}
                  {Object.entries(multichannel.metrics).map(([ch, m]) => (
                    <tr key={ch} className="border-b border-black/5">
                      <td className="px-3 py-2 font-medium text-neutral-900">{ch}</td>
                      <td className="px-3 py-2">{m.revenue.toFixed(2)}</td>
                      <td className="px-3 py-2">{m.orders}</td>
                      <td className="px-3 py-2">{m.posts}</td>
                      <td className="px-3 py-2">{m.revenuePerPost.toFixed(2)}</td>
                      <td className="px-3 py-2">{m.conversionRate.toFixed(4)}</td>
                      <td className="px-3 py-2">{Math.round(multichannel.allocation[ch] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">Skalering</h3>
              <ul className="mt-2 divide-y divide-black/10 rounded border border-black/10 bg-white">
                {multichannel.strategy.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">Ingen skaleringsanbefalinger (terskler).</li>
                ) : (
                  multichannel.strategy.map((s) => (
                    <li key={`${s.channel}-${s.action}`} className="px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span>
                          <strong className="text-neutral-900">{s.channel}</strong> · {s.action} — {s.reason}
                        </span>
                        <span className="font-mono text-xs text-neutral-500">~{s.suggestedBudget} kr</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : !multichannelBusy && !multichannelErr ? (
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Ingen analyse ennå.</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Global Expansion</h2>
            <DataTrustBadge kind="ESTIMATED" />
          </div>
          <button
            type="button"
            disabled={expansionBusy}
            onClick={() => void fetchExpansion()}
            className="min-h-[44px] rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-800 disabled:opacity-50"
          >
            {expansionBusy ? "Kjører…" : "Kjør analyse / pilot-utkast"}
          </button>
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
          Maks {expansion?.pilotMaxPosts ?? 5} poster i pilot. Ingen auto-publisering — kun utkast og logging.
        </p>
        {expansionErr ? (
          <div
            role="alert"
            className="mt-2 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{expansionErr}</span>
            <button
              type="button"
              disabled={expansionBusy}
              onClick={() => void fetchExpansion()}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-red-800 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
            >
              Prøv igjen
            </button>
          </div>
        ) : null}
        {expansion ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-[rgb(var(--lp-muted))]">
              <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                Pilot marked:{" "}
                <strong className="text-neutral-900">{expansion.candidate?.market.id ?? "ingen kandidat"}</strong>
              </span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                Utkast: {expansion.pilotDrafts.length} · nye markeder denne kjøringen: {expansion.safety.newMarketsThisRun}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">Anbefalte markeder</h3>
              <ul className="mt-2 space-y-2">
                {expansion.scored.length === 0 ? (
                  <li className="text-sm text-[rgb(var(--lp-muted))]">Ingen inaktive markeder å score (eller alle aktivert).</li>
                ) : (
                  expansion.scored.map((s) => (
                    <li key={s.market} className="rounded border border-black/10 bg-white px-3 py-2 text-sm">
                      <span className="font-medium text-neutral-900">{s.market}</span> · score {s.score}
                      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{s.reason}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">Ytelse per marked (ordre)</h3>
              <div className="mt-2 overflow-x-auto rounded border border-black/10 bg-white">
                <table className="w-full min-w-[280px] text-left text-sm">
                  <thead className="border-b border-black/10 bg-neutral-50 text-xs uppercase text-[rgb(var(--lp-muted))]">
                    <tr>
                      <th className="px-3 py-2">Marked</th>
                      <th className="px-3 py-2">Omsetning</th>
                      <th className="px-3 py-2">Ordre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(expansion.performance).map(([k, v]) => (
                      <tr key={k} className="border-b border-black/5">
                        <td className="px-3 py-2 font-medium">{k}</td>
                        <td className="px-3 py-2">{v.revenue.toFixed(2)}</td>
                        <td className="px-3 py-2">{v.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">Skaler / stopp (anbefaling)</h3>
              <ul className="mt-2 divide-y divide-black/10 rounded border border-black/10 bg-white">
                {expansion.decisions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">Ingen markedsdata ennå.</li>
                ) : (
                  expansion.decisions.map((d) => (
                    <li key={`${d.market}-${d.action}`} className="px-3 py-2 text-sm">
                      <strong className="text-neutral-900">{d.market}</strong> · {d.action}
                      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{d.reason}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : !expansionBusy && !expansionErr ? (
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Trykk for å kjøre analyse (logger til aktivitetslogg).</p>
        ) : null}
      </section>

      {scaling ? (
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Tak: maks {scaling.maxMarketsPerRun} markeder per kjøring · hint {scaling.maxOrchestratedActionsPerMarketPerRun}{" "}
          handlinger/marked (salgsagent har egne grenser).
        </p>
      ) : null}

      <section className="rounded-lg border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Markeder</h2>
          <DataTrustBadge kind="REAL" />
        </div>
        <ul className="mt-3 divide-y divide-black/10">
          {list.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-neutral-900">
                  {m.name}{" "}
                  <span className="font-mono text-xs text-neutral-500">
                    ({m.id.toUpperCase()} · {m.currency})
                  </span>
                </p>
                <p className="text-xs text-[rgb(var(--lp-muted))]">Språk: {m.language}</p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={overrides[m.id] ?? m.enabled}
                  onChange={(e) => setOverrides((o) => ({ ...o, [m.id]: e.target.checked }))}
                />
                Inkluder i kjøring
              </label>
            </li>
          ))}
        </ul>
      </section>

      {lastRun ? (
        <section className="rounded-lg border border-black/10 bg-white/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Siste kjøring</h2>
            <DataTrustBadge kind="REAL" />
          </div>
          <p className="mt-1 font-mono text-xs text-neutral-600">rid: {lastRun.rid}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">Pipeline / CEO (per marked)</h3>
              <pre className="mt-2 max-h-48 overflow-auto rounded border border-black/10 bg-white p-2 text-[11px]">
                {JSON.stringify(lastRun.markets, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">Feil (isolasjon)</h3>
              <pre className="mt-2 max-h-48 overflow-auto rounded border border-black/10 bg-white p-2 text-[11px]">
                {JSON.stringify(lastRun.errors, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      ) : (
        <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen kjøring ennå.</p>
      )}
    </div>
  );
}
