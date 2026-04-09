"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";

import type { EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { PIPELINE_STAGES } from "@/lib/pipeline/stages";

type Forecast = { total: number; weighted: number; confidence: number };

type ApiOk = {
  ok: true;
  rid: string;
  data: {
    pipelineAvailable: boolean;
    deals: EnrichedPipelineDeal[];
    forecast: Forecast;
  };
};

/** Lav risiko = grønn, medium = gul, høy risiko = rød */
function riskStyles(risk: "low" | "medium" | "high"): string {
  if (risk === "low") return "border-emerald-200 bg-emerald-50/80 text-emerald-900";
  if (risk === "medium") return "border-amber-200 bg-amber-50/80 text-amber-900";
  return "border-rose-200 bg-rose-50/80 text-rose-900";
}

function formatKr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("nb-NO", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export type PipelineKanbanClientProps = {
  /** Skjul prognosestripen (når KPI vises utenfor, f.eks. Sales Cockpit). */
  hideForecastStrip?: boolean;
  onDealSelect?: (deal: EnrichedPipelineDeal) => void;
  selectedDealId?: string | null;
  /** Etter vellykket drag (oppdater overordnet state). */
  onPipelineUpdated?: () => void;
};

export default function PipelineKanbanClient({
  hideForecastStrip = false,
  onDealSelect,
  selectedDealId,
  onPipelineUpdated,
}: PipelineKanbanClientProps = {}) {
  const onPipelineUpdatedRef = useRef(onPipelineUpdated);
  onPipelineUpdatedRef.current = onPipelineUpdated;

  const [deals, setDeals] = useState<EnrichedPipelineDeal[]>([]);
  const [forecast, setForecast] = useState<Forecast>({ total: 0, weighted: 0, confidence: 0 });
  const [pipelineAvailable, setPipelineAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline/deals", { credentials: "same-origin", cache: "no-store" });
      const j = (await res.json()) as ApiOk | { ok: false };
      if (!res.ok || !("ok" in j) || j.ok !== true || !j.data) {
        setPipelineAvailable(false);
        setDeals([]);
        setForecast({ total: 0, weighted: 0, confidence: 0 });
        setLoadError("Kunne ikke laste pipeline.");
        return;
      }
      setPipelineAvailable(j.data.pipelineAvailable);
      setDeals(Array.isArray(j.data.deals) ? j.data.deals : []);
      setForecast(
        j.data.forecast && typeof j.data.forecast === "object"
          ? j.data.forecast
          : { total: 0, weighted: 0, confidence: 0 },
      );
      setMoveError(null);
    } catch {
      setPipelineAvailable(false);
      setDeals([]);
      setForecast({ total: 0, weighted: 0, confidence: 0 });
      setLoadError("Kunne ikke laste pipeline.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byStage = useMemo(() => {
    const m: Record<string, EnrichedPipelineDeal[]> = {};
    for (const s of PIPELINE_STAGES) m[s.id] = [];
    for (const d of deals) {
      const k = d.stage in m ? d.stage : "lead";
      m[k] = [...(m[k] ?? []), d];
    }
    return m;
  }, [deals]);

  const columnTotals = useMemo(() => {
    const out: Record<string, { count: number; value: number }> = {};
    for (const s of PIPELINE_STAGES) {
      const list = byStage[s.id] ?? [];
      out[s.id] = {
        count: list.length,
        value: list.reduce((acc, x) => acc + x.value, 0),
      };
    }
    return out;
  }, [byStage]);

  const onDragStart = (e: DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragEnd = () => setDragId(null);

  const onDropToStage = async (e: DragEvent, stageId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    if (!id) return;
    if (stageId === deals.find((d) => d.id === id)?.stage) return;

    setSavingId(id);
    setMoveError(null);
    try {
      const res = await fetch("/api/pipeline/update-stage", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ dealId: id, stage: stageId }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || j?.ok !== true) {
        setMoveError(typeof j?.message === "string" ? j.message : "Kunne ikke flytte deal.");
        return;
      }
      await load();
      onPipelineUpdatedRef.current?.();
    } catch {
      setMoveError("Kunne ikke flytte deal.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-[rgb(var(--lp-muted))]">Laster pipeline …</p>;
  }

  if (loadError) {
    return (
      <p className="text-sm text-rose-700" role="alert">
        {loadError}
      </p>
    );
  }

  if (pipelineAvailable === false) {
    return <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen pipeline-data tilgjengelig</p>;
  }

  return (
    <div className="space-y-6">
      {moveError ? (
        <p className="text-sm text-rose-700" role="alert">
          {moveError}
        </p>
      ) : null}

      {!hideForecastStrip ? (
        <section
          className="grid grid-cols-1 gap-4 rounded-lg border border-black/10 bg-white/60 p-4 sm:grid-cols-3"
          aria-label="Pipelineprognose"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-[rgb(var(--lp-muted))]">Total pipeline</p>
            <p className="text-2xl font-semibold tabular-nums">{formatKr(forecast.total)} kr</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[rgb(var(--lp-muted))]">Vektet prognose</p>
            <p className="text-2xl font-semibold tabular-nums">{formatKr(forecast.weighted)} kr</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[rgb(var(--lp-muted))]">Konfidens</p>
            <p className="text-2xl font-semibold tabular-nums">{forecast.confidence} %</p>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start">
        {PIPELINE_STAGES.map((col) => {
          const list = byStage[col.id] ?? [];
          const ct = columnTotals[col.id] ?? { count: 0, value: 0 };
          return (
            <div
              key={col.id}
              className="min-w-0 flex-1 basis-[200px] rounded-lg border border-black/10 bg-white/40 p-3"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => void onDropToStage(e, col.id)}
            >
              <div className="mb-3 border-b border-black/10 pb-2">
                <h2 className="text-sm font-semibold text-neutral-900">{col.name}</h2>
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  {ct.count} · {formatKr(ct.value)} kr
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {list.map((d) => {
                  const pred = d.prediction;
                  const reasonsText =
                    pred?.reasons?.length ? pred.reasons.join(" · ") : "Ingen forklaring tilgjengelig";
                  return (
                    <li key={d.id}>
                      <div
                        draggable
                        role={onDealSelect ? "button" : undefined}
                        tabIndex={onDealSelect ? 0 : undefined}
                        onClick={() => onDealSelect?.(d)}
                        onKeyDown={(e) => {
                          if (!onDealSelect) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onDealSelect(d);
                          }
                        }}
                        onDragStart={(e) => onDragStart(e, d.id)}
                        onDragEnd={onDragEnd}
                        title={reasonsText}
                        className={`cursor-grab rounded-md border px-3 py-2 text-sm active:cursor-grabbing ${riskStyles(
                          pred?.risk ?? "medium",
                        )} ${savingId === d.id ? "opacity-60" : ""} ${
                          selectedDealId === d.id ? "ring-2 ring-neutral-900 ring-offset-1" : ""
                        }`}
                      >
                        <p className="font-medium leading-snug">{d.company_name}</p>
                        <p className="mt-1 text-xs tabular-nums">
                          {formatKr(d.value)} kr · prognose {pred?.winProbability ?? 0} % ({pred?.risk ?? "—"}) ·
                          stage {(d.probability * 100).toFixed(0)} %
                        </p>
                        <p className="mt-1 text-xs text-neutral-700">Neste: {d.nextAction ?? "—"}</p>
                        <p className="mt-1 text-xs text-neutral-600">Opprettet {formatDate(d.created_at)}</p>
                        <p className="mt-2 text-[11px] leading-snug text-neutral-600" title={reasonsText}>
                          {reasonsText}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
