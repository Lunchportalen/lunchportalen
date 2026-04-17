"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RankedCompetitor = {
  id: string;
  name: string;
  market: string;
  position: "low" | "mid" | "high";
  strengths: string[];
  weaknesses: string[];
  estimatedTraffic?: number;
  rank: number;
  score: number;
};

type MarketGapFinding = {
  id: string;
  gap: string;
  confidence: number;
  potentialImpact: string;
  signalsUsed: string[];
};

type RecommendedGapAction = {
  gapId: string;
  gapSummary: string;
  action: string;
  expectedImpact: string;
  effort: string;
  risk: string;
  rationale: string[];
};

type DominationPayload = {
  generatedAt: string;
  competitors: RankedCompetitor[];
  gaps: MarketGapFinding[];
  actions: RecommendedGapAction[];
};

type ApiOk = { ok: true; rid: string; data: DominationPayload };
type ApiErr = { ok: false; rid?: string; message?: string };
type ApiResp = ApiOk | ApiErr;

type ActionDisposition = "pending" | "approved" | "ignored" | "tracked";

const STORAGE_PREFIX = "lp-ct-domination-";

function actionKey(a: RecommendedGapAction, index: number): string {
  return `${a.gapId}:${index}`;
}

function loadDispositions(): Record<string, ActionDisposition> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}dispositions`);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, ActionDisposition>;
    return typeof o === "object" && o ? o : {};
  } catch {
    return {};
  }
}

function saveDispositions(next: Record<string, ActionDisposition>): void {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}dispositions`, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function positionNb(p: RankedCompetitor["position"]): string {
  if (p === "low") return "Lav";
  if (p === "mid") return "Mid";
  if (p === "high") return "Høy";
  return p;
}

function tierNb(t: string): string {
  if (t === "high") return "Høy";
  if (t === "medium") return "Middels";
  if (t === "low") return "Lav";
  return t;
}

export default function DominationStrategyPanel() {
  const [data, setData] = useState<DominationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dispositions, setDispositions] = useState<Record<string, ActionDisposition>>({});

  useEffect(() => {
    setDispositions(loadDispositions());
  }, []);

  const fetchDomination = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/superadmin/control-tower/domination", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json()) as ApiResp;
      if (j?.ok === true && j.data) {
        setData(j.data);
      } else {
        setErr((j as ApiErr)?.message ?? "Kunne ikke laste domination-data.");
        setData(null);
      }
    } catch {
      setErr("Nettverksfeil.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDomination();
  }, [fetchDomination]);

  const setDisposition = useCallback((key: string, d: ActionDisposition) => {
    setDispositions((prev) => {
      const next = { ...prev, [key]: d };
      saveDispositions(next);
      return next;
    });
  }, []);

  const trackedCount = useMemo(
    () => Object.values(dispositions).filter((v) => v === "tracked").length,
    [dispositions],
  );

  return (
    <section
      className="mb-10 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-6"
      id="domination-modus"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Domination-modus</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Konkurrenter, gap og tiltak — anbefalinger krever menneskelig beslutning (ingen auto-utførelse).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchDomination()}
          disabled={loading}
          className="rounded-full border border-[rgb(var(--lp-border))] px-3 py-1.5 text-sm text-[rgb(var(--lp-fg))] hover:bg-[rgb(var(--lp-muted))]/10 disabled:opacity-50"
        >
          {loading ? "Oppdaterer…" : "Oppdater"}
        </button>
      </div>

      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}

      {loading && !data ? (
        <p className="mt-6 text-sm text-[rgb(var(--lp-muted))]">Laster…</p>
      ) : null}

      {data ? (
        <div className="mt-6 space-y-6">
          {/* Konkurrenter */}
          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--lp-fg))]">Konkurrenter</h3>
            {data.competitors.length === 0 ? (
              <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Ingen i register — legg inn i kuratert profil.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.competitors.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/40 p-4"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-xs tabular-nums text-[rgb(var(--lp-muted))]">#{c.rank}</span>
                      <span className="font-medium text-[rgb(var(--lp-fg))]">{c.name}</span>
                      <span className="text-xs text-[rgb(var(--lp-muted))]">{c.market}</span>
                      <span className="ml-auto text-xs tabular-nums text-[rgb(var(--lp-muted))]">
                        Score {c.score} · {positionNb(c.position)}
                      </span>
                    </div>
                    {c.estimatedTraffic != null && Number.isFinite(c.estimatedTraffic) ? (
                      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                        Est. trafikk (kuratert): {c.estimatedTraffic.toLocaleString("nb-NO")}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.strengths.filter((s) => String(s).trim()).map((s) => (
                        <span
                          key={`s-${c.id}-${s}`}
                          className="rounded-full border border-emerald-600/35 bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-900 dark:text-emerald-100"
                        >
                          + {s}
                        </span>
                      ))}
                      {c.weaknesses.filter((w) => String(w).trim()).map((w) => (
                        <span
                          key={`w-${c.id}-${w}`}
                          className="rounded-full border border-amber-600/35 bg-amber-600/10 px-2 py-0.5 text-xs text-amber-950 dark:text-amber-100"
                        >
                          − {w}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Gap */}
          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--lp-fg))]">Detekterte gap</h3>
            {data.gaps.length === 0 ? (
              <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Ingen gap med gjeldende signaler.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.gaps.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm text-[rgb(var(--lp-fg))]"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="font-medium">{g.gap}</span>
                      <span className="text-xs text-[rgb(var(--lp-muted))]">
                        konfidens {(g.confidence * 100).toFixed(0)} % · potensial {tierNb(g.potentialImpact)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tiltak */}
          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--lp-fg))]">Anbefalte tiltak</h3>
            {data.actions.length === 0 ? (
              <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Ingen tiltak i kø (maks tre ved gap).</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {data.actions.map((a, index) => {
                  const k = actionKey(a, index);
                  const d = dispositions[k] ?? "pending";
                  return (
                    <li
                      key={k}
                      className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/40 p-4"
                    >
                      <p className="text-sm text-[rgb(var(--lp-fg))]">{a.action}</p>
                      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                        Effekt {tierNb(a.expectedImpact)} · innsats {tierNb(a.effort)} · risiko {tierNb(a.risk)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setDisposition(k, "approved")}
                          disabled={d === "approved"}
                          className="rounded-full border border-[rgb(var(--lp-border))] px-3 py-1.5 text-sm hover:bg-[rgb(var(--lp-muted))]/10 disabled:opacity-60"
                        >
                          Godkjenn
                        </button>
                        <button
                          type="button"
                          onClick={() => setDisposition(k, "ignored")}
                          disabled={d === "ignored"}
                          className="rounded-full border border-[rgb(var(--lp-border))] px-3 py-1.5 text-sm hover:bg-[rgb(var(--lp-muted))]/10 disabled:opacity-60"
                        >
                          Ignorer
                        </button>
                        <button
                          type="button"
                          onClick={() => setDisposition(k, "tracked")}
                          disabled={d === "tracked"}
                          className="rounded-full border border-[rgb(var(--lp-border))] px-3 py-1.5 text-sm hover:bg-[rgb(var(--lp-muted))]/10 disabled:opacity-60"
                        >
                          Spor
                        </button>
                        {d !== "pending" ? (
                          <span className="self-center text-xs text-[rgb(var(--lp-muted))]">
                            {d === "approved" ? "Status: godkjent" : d === "ignored" ? "Status: ignorert" : "Status: sporet"}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {trackedCount > 0 ? (
              <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
                {trackedCount} tiltak merket for sporing (lagres i nettleser for denne økten).
              </p>
            ) : null}
          </div>

          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Data: {new Date(data.generatedAt).toLocaleString("nb-NO", { timeZone: "Europe/Oslo" })}
          </p>
        </div>
      ) : null}
    </section>
  );
}

