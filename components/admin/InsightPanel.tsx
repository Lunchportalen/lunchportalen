// STATUS: KEEP

// components/admin/InsightPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import StatsCard from "@/components/admin/StatsCard";
import InsightAlerts from "@/components/admin/InsightAlerts";
import { t } from "@/lib/copy/admin";

type Confidence = "high" | "medium" | "low";

type InsightOk = {
  ok: true;
  range: { from: string; to: string };
  forecast: { expectedTomorrow: number; confidence: Confidence };
  stability: { level: "lav" | "middels" | "høy"; deviationPercent: number };
  waste: { level: "low" | "medium" | "high"; cancelRate: number }; // cancelRate = %
  series: { date: string; active: number; cancelled: number }[];
  alerts: string[];
};

type InsightErr = { ok: false; error: string; message?: string; detail?: any };

type InsightRes = InsightOk | InsightErr;

function badgeForConfidence(c: Confidence) {
  if (c === "high") return { label: "Høy sikkerhet", cls: "lp-chip lp-chip-ok" };
  if (c === "medium") return { label: "Middels sikkerhet", cls: "lp-chip lp-chip-warn" };
  return { label: t("insightAI.forecast.lowConfidence"), cls: "lp-chip lp-chip-neutral" };
}

function wasteLabel(level: InsightOk["waste"]["level"]) {
  if (level === "low") return "Lav";
  if (level === "medium") return "Middels";
  return "Høy";
}

function wasteBody(level: InsightOk["waste"]["level"]) {
  if (level === "low") return t("insightAI.waste.low");
  if (level === "medium") return t("insightAI.waste.medium");
  return t("insightAI.waste.high");
}

function safeErrText(e: any) {
  if (!e) return "Ukjent feil";
  if (typeof e === "string") return e;
  if (typeof e?.message === "string" && e.message.trim()) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export default function InsightPanel(props: {
  locationName?: string | null;
  className?: string;
}) {
  const { locationName = null, className = "" } = props;

  const [data, setData] = useState<InsightOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/insight", { method: "GET", cache: "no-store" });
      const json = (await res.json()) as InsightRes;

      if (!res.ok || !json || (json as any).ok !== true) {
        const msg =
          (json as any)?.message ||
          (json as any)?.error ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }

      setData(json as InsightOk);
    } catch (e: any) {
      setError(safeErrText(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forecastBadge = useMemo(() => {
    if (!data) return null;
    return badgeForConfidence(data.forecast.confidence);
  }, [data]);

  return (
    <section
      className={[
        "rounded-3xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]",
        className,
      ].join(" ")}
      aria-label={t("insightAI.title")}
    >
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold">{t("insightAI.title")}</div>
          <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            {t("insightAI.intro")}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data?.range ? (
            <span className="lp-chip lp-chip-neutral">
              {t("system.micro.lastUpdated", { time: data.range.to })}
            </span>
          ) : null}

          <button
            type="button"
            onClick={load}
            className="rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
            disabled={loading}
          >
            {loading ? t("system.micro.loading") : "Oppdater"}
          </button>
        </div>
      </div>

      {/* Loading / error */}
      {loading ? (
        <div className="mt-4 rounded-3xl bg-[rgb(var(--lp-surface))] p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm text-[rgb(var(--lp-muted))]">{t("system.micro.loading")}</div>
        </div>
      ) : error ? (
        <div className="mt-4 rounded-3xl bg-[rgb(var(--lp-surface))] p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Kunne ikke hente innsikt</div>
          <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            {error}
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={load}
              className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
            >
              Prøv igjen
            </button>
          </div>
        </div>
      ) : data ? (
        <>
          {/* KPI cards */}
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-[rgb(var(--lp-muted))]">
                      {t("insightAI.forecast.title")}
                    </div>
                    <div className="mt-1 text-2xl font-semibold">
                      {data.forecast.expectedTomorrow}
                    </div>
                    <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                      {t("insightAI.forecast.note")}
                    </div>
                  </div>

                  {forecastBadge ? (
                    <span className={forecastBadge.cls}>{forecastBadge.label}</span>
                  ) : null}
                </div>

                {data.forecast.confidence === "low" ? (
                  <div className="mt-4 rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
                    <div className="text-xs text-[rgb(var(--lp-muted))]">
                      {t("insightAI.forecast.lowConfidenceHelp")}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <StatsCard
              titleKey="insightAI.stability.title"
              value={`${data.stability.level}`}
              footerKey="insightAI.stability.text"
              footerVars={{ level: data.stability.level, percent: data.stability.deviationPercent }}
              tone="default"
            />

            <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="text-xs text-[rgb(var(--lp-muted))]">{t("insightAI.waste.title")}</div>
              <div className="mt-1 text-2xl font-semibold">{wasteLabel(data.waste.level)}</div>
              <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                Avbestillingsrate: {data.waste.cancelRate}%
              </div>

              <div className="mt-4 rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-sm text-[rgb(var(--lp-muted))]">{wasteBody(data.waste.level)}</div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="mt-6">
            <InsightAlerts locationName={locationName} alerts={data.alerts} />
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-3xl bg-[rgb(var(--lp-surface))] p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm text-[rgb(var(--lp-muted))]">
            {t("system.errors.generic")}
          </div>
        </div>
      )}
    </section>
  );
}
