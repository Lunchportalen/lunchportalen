"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { Alert } from "@/lib/alerts/types";
import { detectIssues } from "@/lib/controlTower/alerts";
import type { ControlTowerData } from "@/lib/controlTower/types";
import { simulateScenario } from "@/lib/simulation/engine";
import { assessRisk } from "@/lib/simulation/risk";
import type { SimulationRiskLevel } from "@/lib/simulation/risk";

import DataTrustBadge from "@/components/superadmin/DataTrustBadge";
import { AlertEdgeFrame } from "@/components/superadmin/controlTower/AlertEdgeFrame";
import { ControlTowerInsightActions } from "@/components/superadmin/controlTower/ControlTowerInsightActions";
import { LiveMetricValue } from "@/components/superadmin/controlTower/LiveMetricValue";
import { LiveSectionHeading } from "@/components/superadmin/controlTower/LiveSectionHeading";
import { LiveStatusDot } from "@/components/superadmin/controlTower/LiveStatusDot";
import { SecondsSinceUpdate } from "@/components/superadmin/controlTower/SecondsSinceUpdate";

import { controlTowerFinanceSimulationLogAction } from "./actions";

type ApiOk = { ok: true; rid: string; data: ControlTowerData };
type ApiErr = { ok: false; rid?: string; message?: string; error?: string };
type ApiResp = ApiOk | ApiErr;

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)} %`;
}

function fmtKr(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

function fmtIso(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("nb-NO", { timeZone: "Europe/Oslo" });
  } catch {
    return iso;
  }
}

function healthNb(h: ControlTowerData["system"]["health"]): string {
  if (h === "ok") return "OK";
  if (h === "warning") return "Advarsel";
  return "Kritisk";
}

function trendArrow(d: ControlTowerData["predictive"]["trend"]["direction"]): string {
  if (d === "up") return "↑";
  if (d === "down") return "↓";
  return "→";
}

function confPct(c: number): string {
  if (!Number.isFinite(c) || c <= 0) return "—";
  return `${(c * 100).toFixed(0)} %`;
}

function detailHrefForRecommendation(text: string): string {
  const t = text.trim();
  if (t.includes("Samle flere dagers")) return "/superadmin/control-tower";
  if (t.includes("advarsler")) return "/superadmin/control-tower#kontroll-varsler";
  if (t.includes("eksperiment")) return "/superadmin/control-tower#vekst-eksperimenter";
  return "/superadmin/growth/social";
}

function workHrefForRecommendation(text: string): string {
  const t = text.trim();
  if (t.includes("Samle flere dagers")) return "/superadmin/system";
  return "/superadmin/growth/social";
}

function detailHrefForFinancialAlert(alert: Alert): string {
  if (alert.type === "profit_drop" || alert.type === "no_revenue") return "/superadmin/cfo";
  if (alert.type === "roas_drop" || alert.type === "high_spend_low_return") return "/superadmin/growth/social";
  return "/superadmin/audit";
}

function workHrefForFinancialAlert(alert: Alert): string {
  if (alert.type === "profit_drop" || alert.type === "no_revenue") return "/superadmin/cfo";
  return "/superadmin/growth/social";
}

function detailHrefForAnomaly(text: string): string {
  if (text.includes("omsetning") || text.includes("inntekt")) return "/superadmin/cfo";
  return "/superadmin/control-tower#kontroll-varsler";
}

function workHrefForAnomaly(text: string): string {
  return "/superadmin/growth/social";
}

type GrowthOptimizationClient = {
  explain: string;
  experimentName?: string | null;
  recommendation: { suggestion: string; reason: string } | null;
};

type ExperimentListRow = {
  id: string;
  name: string;
  status: string;
  pageId: string | null;
};

type ControlTowerAutopilotPayload = {
  enabled: boolean;
  envAllows: boolean;
  runtimeOverride: boolean | null;
  currentExperiment: {
    id: string;
    type: string;
    target: string;
    status: string;
    startedAt: number;
  } | null;
  lastResult: { atIso: string; status: string; summary: string } | null;
};

type ControlTowerScalePayload = {
  enabled: boolean;
  paused: boolean;
  manualOverride: boolean;
  envAllows: boolean;
  runtimeOverride: boolean | null;
  effectiveActive: boolean;
  budgetPerMarket: Record<string, number> | null;
  markets: Array<{
    id: string;
    name: string;
    country: string;
    currency: string;
    active: boolean;
    performance: { revenue: number; conversion: number; growth: number };
    loadError: string | null;
  }>;
  topChannel: { id: string | null; label: string };
};

function riskLabelNb(r: SimulationRiskLevel): string {
  if (r === "high") return "Høy";
  if (r === "medium") return "Middels";
  return "Lav";
}

export default function ControlTowerClient({ initial }: { initial: ControlTowerData }) {
  const [data, setData] = useState<ControlTowerData>(initial);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scaleAds, setScaleAds] = useState(false);
  const [priceUp, setPriceUp] = useState(false);
  const [priceDown, setPriceDown] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [simPending, startSimTransition] = useTransition();

  const [towerFeedback, setTowerFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [growthOpt, setGrowthOpt] = useState<GrowthOptimizationClient | null>(null);
  const [experiments, setExperiments] = useState<ExperimentListRow[]>([]);
  const [autopilot, setAutopilot] = useState<ControlTowerAutopilotPayload | null>(null);
  const [autopilotCtlPending, setAutopilotCtlPending] = useState(false);
  const [scale, setScale] = useState<ControlTowerScalePayload | null>(null);
  const [scaleCtlPending, setScaleCtlPending] = useState(false);

  const [errShake, setErrShake] = useState(0);
  const [revenueShake, setRevenueShake] = useState(0);
  const [anomalyShake, setAnomalyShake] = useState(0);
  const [healthShake, setHealthShake] = useState(0);
  const [driftShake, setDriftShake] = useState(0);
  const [revenueDropFlash, setRevenueDropFlash] = useState(false);
  const prevErr = useRef<string | null>(null);
  const prevRevenue = useRef<{ today: number; week: number } | null>(null);
  const prevAnomalySig = useRef<string>("");
  const anomalyMounted = useRef(false);
  const prevHealth = useRef(data.system.health);
  const driftMounted = useRef(false);
  const prevAlertsLen = useRef(0);

  const fetchAutopilot = useCallback(async () => {
    try {
      const r = await fetch("/api/superadmin/control-tower/autopilot", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json()) as { ok?: boolean; data?: ControlTowerAutopilotPayload };
      if (j?.ok === true && j.data) setAutopilot(j.data);
    } catch {
      /* fail-closed */
    }
  }, []);

  const fetchScale = useCallback(async () => {
    try {
      const r = await fetch("/api/superadmin/control-tower/scale", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json()) as { ok?: boolean; data?: ControlTowerScalePayload };
      if (j?.ok === true && j.data) setScale(j.data);
    } catch {
      /* fail-closed */
    }
  }, []);

  const load = useCallback(async (forceRefresh: boolean, mode: "manual" | "poll" = "manual") => {
    if (mode === "manual") {
      setLoading(true);
      setErr(null);
    }
    try {
      const u = forceRefresh ? "/api/superadmin/control-tower/data?refresh=1" : "/api/superadmin/control-tower/data";
      const r = await fetch(u, { credentials: "include", cache: "no-store" });
      let j: ApiResp;
      try {
        j = (await r.json()) as ApiResp;
      } catch {
        const msg = "Kunne ikke lese JSON fra server.";
        setErr(mode === "poll" ? `Automatisk oppdatering: ${msg}` : msg);
        return;
      }
      if (!r.ok || !j || j.ok !== true) {
        const base = (j as ApiErr).message ?? (j as ApiErr).error ?? "Kunne ikke hente data.";
        setErr(mode === "poll" ? `Automatisk oppdatering: ${base}` : base);
        return;
      }
      setData(j.data);
      setErr(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nettverksfeil.";
      setErr(mode === "poll" ? `Automatisk oppdatering: ${msg}` : msg);
    } finally {
      if (mode === "manual") setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      void load(false, "poll");
    }, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    void fetchAutopilot();
    const t = setInterval(() => {
      void fetchAutopilot();
    }, 15000);
    return () => clearInterval(t);
  }, [fetchAutopilot]);

  useEffect(() => {
    void fetchScale();
    const t = setInterval(() => {
      void fetchScale();
    }, 15000);
    return () => clearInterval(t);
  }, [fetchScale]);

  const onScaleControl = useCallback(
    async (action: "enable" | "disable" | "pause" | "resume" | "manual_on" | "manual_off" | "clear_override") => {
      setScaleCtlPending(true);
      try {
        const r = await fetch("/api/superadmin/control-tower/scale", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const j = (await r.json()) as {
          ok?: boolean;
          data?: Partial<ControlTowerScalePayload>;
        };
        if (j?.ok === true && j.data) {
          setScale((prev) => {
            if (!prev) {
              return {
                enabled: Boolean(j.data.enabled),
                paused: Boolean(j.data.paused),
                manualOverride: Boolean(j.data.manualOverride),
                envAllows: Boolean(j.data.envAllows),
                runtimeOverride: j.data.runtimeOverride ?? null,
                effectiveActive: Boolean(j.data.effectiveActive),
                budgetPerMarket: null,
                markets: [],
                topChannel: { id: null, label: "—" },
              };
            }
            return {
              ...prev,
              enabled: j.data.enabled ?? prev.enabled,
              paused: j.data.paused ?? prev.paused,
              manualOverride: j.data.manualOverride ?? prev.manualOverride,
              envAllows: j.data.envAllows ?? prev.envAllows,
              runtimeOverride: j.data.runtimeOverride ?? prev.runtimeOverride,
              effectiveActive: j.data.effectiveActive ?? prev.effectiveActive,
            };
          });
          void fetchScale();
          const labels: Record<string, string> = {
            enable: "Scale-modus aktivert (runtime).",
            disable: "Scale-modus deaktivert (runtime).",
            pause: "Scale-modus pauset.",
            resume: "Scale-modus gjenopptatt.",
            manual_on: "Manuell overstyring på.",
            manual_off: "Manuell overstyring av.",
            clear_override: "Runtime-overstyring fjernet — følger env.",
          };
          setTowerFeedback({ text: labels[action] ?? "Oppdatert.", ok: true });
        } else {
          setTowerFeedback({ text: "Kunne ikke oppdatere scale-modus.", ok: false });
        }
      } catch {
        setTowerFeedback({ text: "Kunne ikke oppdatere scale-modus.", ok: false });
      } finally {
        setScaleCtlPending(false);
      }
    },
    [fetchScale],
  );

  const onAutopilotControl = useCallback(
    async (action: "enable" | "disable") => {
      setAutopilotCtlPending(true);
      try {
        const r = await fetch("/api/superadmin/control-tower/autopilot", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const j = (await r.json()) as {
          ok?: boolean;
          data?: Partial<ControlTowerAutopilotPayload> & {
            enabled?: boolean;
            envAllows?: boolean;
            runtimeOverride?: boolean | null;
          };
        };
        if (j?.ok === true && j.data) {
          setAutopilot((prev) => {
            if (!prev) {
              return {
                enabled: Boolean(j.data.enabled),
                envAllows: Boolean(j.data.envAllows),
                runtimeOverride: j.data.runtimeOverride ?? null,
                currentExperiment: null,
                lastResult: null,
              };
            }
            return {
              ...prev,
              enabled: j.data.enabled ?? prev.enabled,
              envAllows: j.data.envAllows ?? prev.envAllows,
              runtimeOverride: j.data.runtimeOverride ?? prev.runtimeOverride,
            };
          });
          void fetchAutopilot();
          setTowerFeedback({
            text:
              action === "enable"
                ? "Autopilot startet (runtime i denne prosessen)."
                : "Autopilot pauset (runtime i denne prosessen).",
            ok: true,
          });
        } else {
          setTowerFeedback({ text: "Kunne ikke oppdatere autopilot.", ok: false });
        }
      } catch {
        setTowerFeedback({ text: "Kunne ikke oppdatere autopilot.", ok: false });
      } finally {
        setAutopilotCtlPending(false);
      }
    },
    [fetchAutopilot],
  );

  useEffect(() => {
    if (!towerFeedback) return;
    const t = setTimeout(() => setTowerFeedback(null), 5200);
    return () => clearTimeout(t);
  }, [towerFeedback]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/superadmin/experiments", { credentials: "include", cache: "no-store" });
        const j = (await r.json()) as { ok?: boolean; data?: { experiments?: ExperimentListRow[] } };
        if (cancelled || j?.ok !== true || !Array.isArray(j.data?.experiments)) return;
        setExperiments(j.data.experiments.slice(0, 14));
      } catch {
        /* fail-closed: ingen liste */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/superadmin/growth-optimization", { credentials: "include", cache: "no-store" });
        const j = (await r.json()) as { ok?: boolean; data?: GrowthOptimizationClient };
        if (cancelled) return;
        if (j?.ok === true && j.data) {
          setGrowthOpt(j.data);
        } else {
          setGrowthOpt({ explain: "Kunne ikke laste vekstsignal.", experimentName: null, recommendation: null });
        }
      } catch {
        if (!cancelled) {
          setGrowthOpt({ explain: "Kunne ikke laste vekstsignal.", experimentName: null, recommendation: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const postCapitalAllocate = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch("/api/superadmin/growth/capital-allocate", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json()) as { ok?: boolean };
      return j.ok === true;
    } catch {
      return false;
    }
  }, []);

  const onTowerFeedback = useCallback((f: { text: string; ok: boolean }) => {
    setTowerFeedback(f);
  }, []);

  const anomalyActive = useMemo(
    () =>
      data.predictive.anomalies.length > 0 ||
      data.financialAlerts.systemStatus !== "ok" ||
      data.financialAlerts.triggered.some((a) => a.severity === "high"),
    [data.financialAlerts, data.predictive.anomalies],
  );

  useEffect(() => {
    if (err && !prevErr.current) {
      setErrShake((n) => n + 1);
    }
    prevErr.current = err;
  }, [err]);

  useEffect(() => {
    const sig = [
      data.predictive.anomalies.length,
      data.financialAlerts.systemStatus,
      data.financialAlerts.triggered.filter((a) => a.severity === "high").length,
    ].join("|");
    if (!anomalyMounted.current) {
      anomalyMounted.current = true;
      prevAnomalySig.current = sig;
      return;
    }
    if (sig !== prevAnomalySig.current && anomalyActive) {
      setAnomalyShake((n) => n + 1);
    }
    prevAnomalySig.current = sig;
  }, [anomalyActive, data.financialAlerts, data.predictive.anomalies.length]);

  useEffect(() => {
    if (data.revenue.dataSource !== "orders") {
      prevRevenue.current = { today: data.revenue.todayTotal, week: data.revenue.weekTotal };
      setRevenueDropFlash(false);
      return;
    }
    const prev = prevRevenue.current;
    if (prev != null) {
      const dropped = data.revenue.todayTotal < prev.today || data.revenue.weekTotal < prev.week;
      if (dropped) {
        setRevenueDropFlash(true);
        setRevenueShake((n) => n + 1);
      } else {
        setRevenueDropFlash(false);
      }
    }
    prevRevenue.current = { today: data.revenue.todayTotal, week: data.revenue.weekTotal };
  }, [data.revenue.dataSource, data.revenue.todayTotal, data.revenue.weekTotal]);

  useEffect(() => {
    if (data.system.health !== "ok" && prevHealth.current === "ok") {
      setHealthShake((n) => n + 1);
    }
    prevHealth.current = data.system.health;
  }, [data.system.health]);

  const alerts = useMemo(() => detectIssues(data), [data]);

  useEffect(() => {
    if (!driftMounted.current) {
      driftMounted.current = true;
      prevAlertsLen.current = alerts.length;
      return;
    }
    if (alerts.length > 0 && prevAlertsLen.current === 0) {
      setDriftShake((n) => n + 1);
    }
    prevAlertsLen.current = alerts.length;
  }, [alerts.length]);

  const simResult = useMemo(() => {
    return simulateScenario(data.finance.inputs, {
      increaseBudget: scaleAds,
      priceIncrease: priceUp,
      priceDecrease: priceDown,
    });
  }, [data.finance.inputs, scaleAds, priceUp, priceDown]);

  const canSimulate = data.revenue.dataSource === "orders";

  const basePl = data.finance.pl;
  const marginDelta = simResult.pl.margin - basePl.margin;
  const risk = assessRisk(simResult);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-2">
              <LiveStatusDot kind="REAL" />
              <span className="text-xs font-medium text-[rgb(var(--lp-fg))]">Sanntid</span>
            </span>
            <span className="text-xs text-[rgb(var(--lp-muted))]" aria-hidden>
              ·
            </span>
            <SecondsSinceUpdate iso={data.generatedAt} />
            <span className="text-xs text-[rgb(var(--lp-muted))]" aria-hidden>
              ·
            </span>
            <span className="text-[10px] text-[rgb(var(--lp-muted))]/90">
              TTL {data.cacheTtlSeconds}s · 15s
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(true, "manual")}
          className="inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] transition-[transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2" aria-hidden>
              <span className="relative h-2.5 w-28 overflow-hidden rounded-full bg-[rgb(var(--lp-border))]/55">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent bg-[length:200%_100%] animate-lpShimmer" />
              </span>
              <span className="sr-only">Oppdaterer</span>
            </span>
          ) : (
            "Oppfrisk nå"
          )}
        </button>
      </div>

      <section id="autopilot" className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Autopilot</h2>
          <DataTrustBadge kind="REAL" />
        </div>
        <ul className="mt-2 list-inside list-disc text-xs leading-snug text-[rgb(var(--lp-muted))]">
          <li>Ingen auto-endringer</li>
          <li>Kun eksperimenter</li>
        </ul>
        {autopilot && !autopilot.envAllows ? (
          <p className="mt-2 text-xs text-amber-900">
            Miljø: <code className="text-[10px]">LP_AUTOPILOT_ENABLED</code> er av — «Start» overstyrer kun i denne serverprosessen (ikke persistert som env).
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-h-[44px] flex flex-col justify-center">
            <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Status</p>
            <p className="text-sm font-semibold text-[rgb(var(--lp-fg))]">{autopilot?.enabled ? "ON" : "OFF"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={autopilotCtlPending || (autopilot?.enabled ?? false)}
              onClick={() => void onAutopilotControl("enable")}
              className={[
                "inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] transition-[transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50",
                !autopilot?.enabled ? "ring-2 ring-[var(--lp-hotpink)] ring-offset-2" : "",
              ].join(" ")}
            >
              {autopilotCtlPending ? "…" : "Start autopilot"}
            </button>
            <button
              type="button"
              disabled={autopilotCtlPending || !(autopilot?.enabled ?? false)}
              onClick={() => void onAutopilotControl("disable")}
              className={[
                "inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] transition-[transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50",
                autopilot?.enabled ? "ring-2 ring-[var(--lp-hotpink)] ring-offset-2" : "",
              ].join(" ")}
            >
              {autopilotCtlPending ? "…" : "Pause autopilot"}
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Aktivt eksperiment (minne)</p>
          {autopilot?.currentExperiment ? (
            <p className="text-sm text-[rgb(var(--lp-text))]">
              <span className="font-mono text-xs">{autopilot.currentExperiment.id}</span>
              {" · "}
              {autopilot.currentExperiment.type} · {autopilot.currentExperiment.target} · {autopilot.currentExperiment.status}
              {" · "}
              {fmtIso(new Date(autopilot.currentExperiment.startedAt).toISOString())}
            </p>
          ) : (
            <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen aktivt autopilot-eksperiment i denne instansen.</p>
          )}
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Siste resultat (loop)</p>
          {autopilot?.lastResult ? (
            <p className="text-sm text-[rgb(var(--lp-text))]">
              {autopilot.lastResult.summary}
              <span className="text-xs text-[rgb(var(--lp-muted))]">
                {" "}
                · {fmtIso(autopilot.lastResult.atIso)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen kjøring registrert i denne prosessen ennå.</p>
          )}
        </div>
      </section>

      <section id="scale-modus" className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Scale-modus</h2>
          <DataTrustBadge kind="REAL" />
        </div>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Markeder, budsjettfordeling (siste snapshot) og toppkanal fra sporet data. Ingen automatisk posting herfra.
        </p>
        {scale && !scale.envAllows ? (
          <p className="mt-2 text-xs text-amber-900">
            Miljø: <code className="text-[10px]">LP_SCALE_MODE_ENABLED</code> er av — «Aktiver» overstyrer kun i denne prosessen.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="min-h-[44px] flex flex-col justify-center">
            <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Status</p>
            <p className="text-sm font-semibold text-[rgb(var(--lp-fg))]">
              {scale?.effectiveActive ? "ON" : "OFF"}
              {scale?.paused ? (
                <span className="ml-2 text-xs font-normal text-amber-900">· Pause</span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!scale || scaleCtlPending || (scale.paused ?? false) || (scale.effectiveActive ?? false)}
              onClick={() => void onScaleControl("enable")}
              className={[
                "inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] transition-[transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50",
                !scale?.effectiveActive && !scale?.paused ? "ring-2 ring-[var(--lp-hotpink)] ring-offset-2" : "",
              ].join(" ")}
            >
              {scaleCtlPending ? "…" : "Aktiver scale"}
            </button>
            <button
              type="button"
              disabled={!scale || scaleCtlPending || !scale.effectiveActive}
              onClick={() => void onScaleControl("disable")}
              className="inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] transition-[transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50"
            >
              Stopp
            </button>
            <button
              type="button"
              disabled={!scale || scaleCtlPending || !scale.effectiveActive || scale.paused}
              onClick={() => void onScaleControl("pause")}
              className="inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] transition-[transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50"
            >
              Pause
            </button>
            <button
              type="button"
              disabled={!scale || scaleCtlPending || !scale.paused}
              onClick={() => void onScaleControl("resume")}
              className={[
                "inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] transition-[transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50",
                scale?.paused ? "ring-2 ring-[var(--lp-hotpink)] ring-offset-2" : "",
              ].join(" ")}
            >
              Gjenoppta
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Manuell overstyring</p>
          <button
            type="button"
            disabled={!scale || scaleCtlPending || scale.manualOverride}
            onClick={() => void onScaleControl("manual_on")}
            className={[
              "inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] transition-[transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50",
              scale && !scale.manualOverride ? "ring-2 ring-[var(--lp-hotpink)] ring-offset-2" : "",
            ].join(" ")}
          >
            På
          </button>
          <button
            type="button"
            disabled={!scale || scaleCtlPending || !scale.manualOverride}
            onClick={() => void onScaleControl("manual_off")}
            className={[
              "inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] transition-[transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50",
              scale?.manualOverride ? "ring-2 ring-[var(--lp-hotpink)] ring-offset-2" : "",
            ].join(" ")}
          >
            Av
          </button>
          <button
            type="button"
            disabled={!scale || scaleCtlPending}
            onClick={() => void onScaleControl("clear_override")}
            className="inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-full border border-dashed border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium text-[rgb(var(--lp-muted))] transition-[transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50"
          >
            Fjern runtime-overstyring
          </button>
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Toppkanal (sporet)</p>
          <p className="text-sm font-medium text-[rgb(var(--lp-fg))]">{scale?.topChannel?.label ?? "—"}</p>
        </div>
        <div className="mt-4 space-y-3">
          <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Markeder</p>
          {scale?.markets?.length ? (
            <ul className="list-none space-y-2 p-0 text-sm text-[rgb(var(--lp-text))]">
              {scale.markets.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[rgb(var(--lp-border))]/60 pb-2 last:border-0">
                  <span>
                    <span className="font-medium text-[rgb(var(--lp-fg))]">{m.name}</span>{" "}
                    <span className="text-xs text-[rgb(var(--lp-muted))]">
                      ({m.country}) · {m.currency}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-[rgb(var(--lp-muted))]">
                    {m.loadError ? (
                      <span className="text-amber-900">Feil: {m.loadError}</span>
                    ) : (
                      <>
                        {Math.round(m.performance.revenue).toLocaleString("nb-NO")} kr · conv{" "}
                        {(m.performance.conversion * 100).toFixed(1)} %
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[rgb(var(--lp-muted))]">Laster markedsdata…</p>
          )}
        </div>
        <div className="mt-4 space-y-3">
          <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Budsjettfordeling (andel)</p>
          {scale?.budgetPerMarket && Object.keys(scale.budgetPerMarket).length > 0 ? (
            <ul className="list-none space-y-3 p-0">
              {scale.markets.map((m) => {
                const pct = (scale.budgetPerMarket?.[m.id] ?? 0) * 100;
                return (
                  <li key={`bar-${m.id}`}>
                    <div className="mb-1 flex justify-between text-xs text-[rgb(var(--lp-text))]">
                      <span className="font-medium uppercase">{m.id}</span>
                      <span className="font-mono">{pct.toFixed(1)} %</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[rgb(var(--lp-border))]/45">
                      <div
                        className="h-2.5 rounded-full bg-[rgb(var(--lp-fg))]/75"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[rgb(var(--lp-muted))]">
              Ingen budsjett-snapshot ennå — kjør `allocateBudget` / reallokering på server for å fylle dette.
            </p>
          )}
        </div>
      </section>

      {towerFeedback ? (
        <div
          role="status"
          aria-live="polite"
          className={
            towerFeedback.ok
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-950"
              : "rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-950"
          }
        >
          {towerFeedback.text}
        </div>
      ) : null}

      {err ? (
        <AlertEdgeFrame active className="overflow-hidden" shakeNonce={errShake}>
          <div
            role="alert"
            aria-live="polite"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-950"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{err}</span>
              <button
                type="button"
                disabled={loading}
                onClick={() => void load(true, "manual")}
                className="inline-flex min-h-[44px] shrink-0 touch-manipulation select-none items-center justify-center rounded-full border border-red-800 bg-white px-4 py-2 text-sm font-medium text-red-900 transition-transform duration-150 hover:bg-red-100 active:scale-[0.98] disabled:opacity-50"
              >
                Prøv igjen
              </button>
            </div>
          </div>
        </AlertEdgeFrame>
      ) : null}

      {alerts.length > 0 ? (
        <AlertEdgeFrame active variant="warn" className="overflow-hidden" shakeNonce={driftShake}>
          <div className="rounded-2xl border border-amber-300/90 bg-amber-50/95 px-4 py-4 shadow-md shadow-amber-900/10">
            <p className="font-heading text-base font-semibold tracking-tight text-amber-950">Driftvarsler</p>
            <ul className="mt-3 list-none space-y-4 p-0">
              {alerts.map((a, i) => (
                <li key={`${i}-${a.slice(0, 48)}`} className="rounded-xl border border-amber-200/80 bg-white/60 px-3 py-2 text-sm text-amber-950">
                  <p className="text-pretty">{a}</p>
                  <ControlTowerInsightActions
                    surface="drift_alert"
                    refKey={`drift:${i}:${a.slice(0, 120)}`}
                    label={a}
                    detailHref="/superadmin/system"
                    workHref="/superadmin/system"
                    onFeedback={onTowerFeedback}
                  />
                </li>
              ))}
            </ul>
          </div>
        </AlertEdgeFrame>
      ) : null}

      <AlertEdgeFrame active={anomalyActive} className="overflow-hidden" shakeNonce={anomalyShake}>
        <section id="kontroll-varsler">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Varsler</h2>
            <DataTrustBadge kind="ESTIMATED" />
          </div>
          <p className="mt-1 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
            Finans og anomalier · kjøling 30 min. Status:{" "}
            <span className="font-medium text-[rgb(var(--lp-fg))]">
              {data.financialAlerts.systemStatus === "ok" ? "datagrunnlag OK" : "degradert"}
            </span>
            .
          </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[rgb(var(--lp-border))] bg-white/90">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs text-[rgb(var(--lp-text))]">
            <thead>
              <tr className="border-b border-[rgb(var(--lp-border))] text-[10px] uppercase text-[rgb(var(--lp-muted))]">
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Alvor</th>
                <th className="px-3 py-2 font-medium">Melding</th>
                <th className="px-3 py-2 font-medium">Tidspunkt</th>
                <th className="min-w-[240px] px-3 py-2 font-medium">Handling</th>
              </tr>
            </thead>
            <tbody>
              {data.financialAlerts.triggered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-left text-[rgb(var(--lp-muted))]">
                    <p className="font-medium text-[rgb(var(--lp-fg))]">Ingen aktive varsler akkurat nå</p>
                    <p className="mt-1 text-xs leading-snug">
                      Når finansmotoren finner avvik, vises de her (med kjøling mot støy). Trykk «Oppfrisk nå» over hvis du vil tvinge ny evaluering.
                    </p>
                  </td>
                </tr>
              ) : (
                data.financialAlerts.triggered.map((a) => (
                  <tr key={a.id} className="border-b border-[rgb(var(--lp-border))]/80">
                    <td className="px-3 py-2 font-mono text-[10px]">{a.type}</td>
                    <td className="px-3 py-2">
                      <span aria-hidden="true">{a.severity === "high" ? "🔴" : a.severity === "medium" ? "🟡" : "🟢"}</span>{" "}
                      <span className="sr-only">
                        {a.severity === "high" ? "Høy" : a.severity === "medium" ? "Middels" : "Lav"}
                      </span>
                      <span className="text-[rgb(var(--lp-text))]">
                        {a.severity === "high" ? "Høy" : a.severity === "medium" ? "Middels" : "Lav"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{a.message}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-[rgb(var(--lp-muted))]">
                      {new Date(a.timestamp).toLocaleString("nb-NO", { timeZone: "Europe/Oslo" })}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <ControlTowerInsightActions
                        surface="financial_alert"
                        refKey={a.id}
                        label={a.message}
                        detailHref={detailHrefForFinancialAlert(a)}
                        workHref={workHrefForFinancialAlert(a)}
                        onFeedback={onTowerFeedback}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data.financialAlerts.suppressed.length > 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-white/70 px-3 py-2">
            <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Undertrykt (kjøling)</p>
            <ul className="mt-1 list-inside list-disc text-xs text-[rgb(var(--lp-muted))]">
              {data.financialAlerts.suppressed.map((s, i) => (
                <li key={`${s.type}-${i}`}>
                  {s.type} — {s.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        </section>
      </AlertEdgeFrame>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Revisjon (enterprise)</h2>
          <DataTrustBadge kind="REAL" />
        </div>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Append-only spor fra kritisk motor (annonser, budsjett, pris, innkjøp, AI, omsetning). Status:{" "}
          <span className="font-medium text-[rgb(var(--lp-fg))]">
            {data.auditCompliance.complianceStatus === "ok" ? "OK" : "Gjennomgå"}
          </span>
          {data.auditCompliance.suspicious24h === "high_activity" ? (
            <span className="text-amber-800"> · flagg: høy aktivitet 24 t</span>
          ) : null}
          .
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[rgb(var(--lp-border))] bg-white/90">
          <table className="w-full min-w-[320px] border-collapse text-left text-xs text-[rgb(var(--lp-text))]">
            <thead>
              <tr className="border-b border-[rgb(var(--lp-border))] text-[10px] uppercase text-[rgb(var(--lp-muted))]">
                <th className="px-3 py-2 font-medium">Tid</th>
                <th className="px-3 py-2 font-medium">Handling</th>
                <th className="px-3 py-2 font-medium">Kilde</th>
                <th className="px-3 py-2 font-medium">Ressurs</th>
              </tr>
            </thead>
            <tbody>
              {data.auditCompliance.recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-left text-[rgb(var(--lp-muted))]">
                    <p className="font-medium text-[rgb(var(--lp-fg))]">Ingen hendelser i vinduet</p>
                    <p className="mt-1 text-xs leading-snug">
                      Enten er det stille, eller så mangler lesing mot revisjonstabellen (service role / tilgang). Åpne full revisjonslogg under når kilden er tilgjengelig.
                    </p>
                  </td>
                </tr>
              ) : (
                data.auditCompliance.recent.map((row) => (
                  <tr key={row.id} className="border-b border-[rgb(var(--lp-border))]/80">
                    <td className="px-3 py-2 font-mono text-[10px] text-[rgb(var(--lp-muted))]">
                      {fmtIso(row.created_at)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px]">{row.action}</td>
                    <td className="px-3 py-2">{row.source ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-[rgb(var(--lp-muted))]">{row.resource}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
          <Link href="/superadmin/audit" className="font-medium text-[rgb(var(--lp-fg))] underline-offset-2 hover:underline">
            Åpne full revisjonslogg
          </Link>
        </p>
      </section>

      <section>
        <LiveSectionHeading title="AI Prognose" trustKind="ESTIMATED" />
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Enkel glidende modell — ikke maskinlæring. Ingen tall uten datagrunnlag.
        </p>
        {!data.predictive.dataAvailable || !data.predictive.forecast.sufficientData ? (
          <div className="mt-3 rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-white/70 px-3 py-3 text-sm text-[rgb(var(--lp-muted))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">{data.predictive.insufficientDataMessage ?? "Ikke nok historikk ennå"}</p>
            <p className="mt-1 text-xs leading-snug">
              Prognosen trenger flere sammenlignbare dager med ordredata. Kom tilbake når volumet har bygget seg opp, eller oppfrisk siden etter nye ordrer.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
              <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Forventet i dag (nivå)</p>
              <p className="mt-1 font-heading text-xl font-semibold text-[rgb(var(--lp-fg))]">
                <LiveMetricValue value={data.predictive.forecast.todayKr ?? 0} className="font-heading text-xl font-semibold text-[rgb(var(--lp-fg))]">
                  {fmtKr(data.predictive.forecast.todayKr ?? 0)}
                </LiveMetricValue>
              </p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
              <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Forventet uke (7× snitt)</p>
              <p className="mt-1 font-heading text-xl font-semibold text-[rgb(var(--lp-fg))]">
                <LiveMetricValue value={data.predictive.forecast.weekKr ?? 0} className="font-heading text-xl font-semibold text-[rgb(var(--lp-fg))]">
                  {fmtKr(data.predictive.forecast.weekKr ?? 0)}
                </LiveMetricValue>
              </p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
              <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Tillitsgrad (heuristikk)</p>
              <p className="mt-1 font-heading text-xl font-semibold text-[rgb(var(--lp-fg))]">
                <LiveMetricValue value={data.predictive.forecast.confidence} className="font-heading text-xl font-semibold text-[rgb(var(--lp-fg))]">
                  {confPct(data.predictive.forecast.confidence)}
                </LiveMetricValue>
              </p>
            </div>
          </div>
        )}
        <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Trend</p>
          <p className="mt-1 text-lg font-semibold text-[rgb(var(--lp-fg))]">
            {trendArrow(data.predictive.trend.direction)}{" "}
            {data.predictive.trend.direction === "up"
              ? "Opp"
              : data.predictive.trend.direction === "down"
                ? "Ned"
                : "Flat"}{" "}
            <span className="text-sm font-normal text-[rgb(var(--lp-muted))]">
              (styrke {data.predictive.trend.strength.toFixed(2)})
            </span>
          </p>
          <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">{data.predictive.trend.explainNb}</p>
          <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">{data.predictive.forecast.methodNb}</p>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">AI Anbefalinger</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Forslag kun — ingen automatisk utførelse.</p>
        {data.predictive.recommendedActions.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-white/70 px-3 py-3 text-sm text-[rgb(var(--lp-muted))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">Ingen nye grep foreslått</p>
            <p className="mt-1 text-xs leading-snug">
              Når trend, volum eller avvik tilsier tiltak, dukker nummererte forslag opp her. Sjekk også prognose og inntekt over for kontekst.
            </p>
          </div>
        ) : (
          <ol className="mt-3 list-inside list-decimal space-y-4 text-sm text-[rgb(var(--lp-text))]">
            {data.predictive.recommendedActions.map((a, i) => (
              <li key={`${i}-${a.slice(0, 48)}`} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-pretty transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
                {a}
                <ControlTowerInsightActions
                  surface="recommendation"
                  refKey={`rec:${i}:${a.slice(0, 160)}`}
                  label={a}
                  detailHref={detailHrefForRecommendation(a)}
                  workHref={workHrefForRecommendation(a)}
                  onFeedback={onTowerFeedback}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Advarsler</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]/90">Prognosegrunnlag.</p>
        {data.predictive.anomalies.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-white/70 px-3 py-3 text-sm text-[rgb(var(--lp-muted))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">Ingen avvik i prognosegrunnlaget</p>
            <p className="mt-1 text-xs leading-snug">
              Når modellen ser uvanlige hopp eller mønstre, listes de her. Følg med på inntekt og varsler hvis du trenger annen kontekst.
            </p>
          </div>
        ) : (
          <ul className="mt-3 list-none space-y-4 p-0 text-sm text-amber-950">
            {data.predictive.anomalies.map((a, i) => (
              <li key={`${i}-${a.slice(0, 48)}`} className="rounded-xl border border-amber-200/90 bg-amber-50/50 px-3 py-2 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-pretty">{a}</p>
                <ControlTowerInsightActions
                  surface="anomaly"
                  refKey={`anom:${i}:${a.slice(0, 160)}`}
                  label={a}
                  detailHref={detailHrefForAnomaly(a)}
                  workHref={workHrefForAnomaly(a)}
                  onFeedback={onTowerFeedback}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="vekst-eksperimenter">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Eksperimenter (vekst)</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]/90">Hentet fra eksisterende superadmin-liste (CMS preview / growth copy).</p>
        {experiments.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-white/70 px-3 py-3 text-sm text-[rgb(var(--lp-muted))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">Ingen CMS-veksteksperimenter i listen</p>
            <p className="mt-1 text-xs leading-snug">
              Når preview A/B eller growth-copy tester kjører, dukker de opp her. Gå til AI Engine for å opprette eller følge opp innhold.
            </p>
          </div>
        ) : (
          <ul className="mt-3 list-none space-y-4 p-0">
            {experiments.map((e) => {
              const detail =
                e.pageId && /^[0-9a-fA-F-]{36}$/.test(e.pageId.trim())
                  ? `/backoffice/content/${e.pageId.trim()}`
                  : "/superadmin/growth/social";
              return (
                <li
                  key={e.id}
                  className="rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-sm text-[rgb(var(--lp-text))] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="font-medium text-[rgb(var(--lp-fg))]">{e.name}</p>
                  <p className="text-xs text-[rgb(var(--lp-muted))]">
                    Status: {e.status}
                    {e.pageId ? (
                      <>
                        {" "}
                        · side <span className="font-mono text-[10px]">{e.pageId}</span>
                      </>
                    ) : null}
                  </p>
                  <ControlTowerInsightActions
                    surface="experiment"
                    refKey={e.id}
                    label={e.name}
                    detailHref={detail}
                    workHref="/superadmin/growth/social"
                    onFeedback={onTowerFeedback}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="vekst-forslag">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Vekstforslag (signal)</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        {growthOpt === null ? (
          <div className="mt-2 h-4 w-full max-w-xl overflow-hidden rounded-md bg-[rgb(var(--lp-border))]/45" aria-hidden>
            <div className="h-full w-full bg-gradient-to-r from-[rgb(var(--lp-border))]/40 via-white/85 to-[rgb(var(--lp-border))]/40 bg-[length:200%_100%] animate-lpShimmer" />
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]/90">{growthOpt.explain}</p>
        )}
        {growthOpt?.recommendation ? (
          <div className="mt-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 px-3 py-2 text-sm text-[rgb(var(--lp-text))] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
            <p className="font-medium text-[rgb(var(--lp-fg))]">{growthOpt.recommendation.suggestion}</p>
            <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{growthOpt.recommendation.reason}</p>
            <ControlTowerInsightActions
              surface="growth"
              refKey={`growth-opt:${growthOpt.experimentName ?? "na"}`}
              label={growthOpt.recommendation.suggestion}
              detailHref="/superadmin/growth/social"
              workHref="/superadmin/growth/social"
              onFeedback={onTowerFeedback}
            />
          </div>
        ) : growthOpt !== null ? (
          <div className="mt-3 rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-white/70 px-3 py-3 text-sm text-[rgb(var(--lp-muted))]">
            <p className="font-medium text-[rgb(var(--lp-fg))]">Ingen tekstlig anbefaling fra vekstsignal</p>
            <p className="mt-1 text-xs leading-snug">
              Anbefalinger krever aktivt eksperiment og nok trafikk. Du kan fortsatt kjøre kapitalallokering under — eller åpne AI Engine for innhold og vekst.
            </p>
          </div>
        ) : null}
        <div className="mt-4 rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-white/70 px-3 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Kapitalallokering</p>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Eksisterende POST-endepunkt — deterministisk kjøring med audit (ingen skjema).
          </p>
          <ControlTowerInsightActions
            surface="growth"
            refKey="growth:capital-allocate"
            label="POST /api/superadmin/growth/capital-allocate"
            detailHref="/superadmin/growth/social"
            workHref="/superadmin/growth/social"
            executeApi={postCapitalAllocate}
            onFeedback={onTowerFeedback}
          />
        </div>
      </section>

      <AlertEdgeFrame active={revenueDropFlash} className="overflow-hidden" shakeNonce={revenueShake}>
        <section>
          <LiveSectionHeading
            title="Inntekt"
            trustKind={data.revenue.dataSource === "orders" ? "REAL" : "ESTIMATED"}
          />
          <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]/90">
            Ordre · <code className="text-[10px]">line_total</code> · kalenderdag / Oslo-uke.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-4 py-4 text-center shadow-md shadow-black/[0.06] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-fg))]/80">I dag</p>
              <p className="mt-1 font-heading text-[1.65rem] font-bold leading-tight tracking-tight text-[rgb(var(--lp-fg))]">
                <LiveMetricValue
                  value={data.revenue.todayTotal}
                  className="font-heading text-[1.65rem] font-bold tracking-tight text-[rgb(var(--lp-fg))]"
                >
                  {fmtKr(data.revenue.todayTotal)}
                </LiveMetricValue>
              </p>
              <p className="mt-1.5 text-[10px] text-[rgb(var(--lp-muted))]">
                <LiveMetricValue value={data.revenue.ordersCountedToday} className="text-[10px] text-[rgb(var(--lp-muted))]">
                  {data.revenue.ordersCountedToday} ordre
                </LiveMetricValue>
              </p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-4 py-4 text-center shadow-md shadow-black/[0.06] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-fg))]/80">Denne uken</p>
              <p className="mt-1 font-heading text-[1.65rem] font-bold leading-tight tracking-tight text-[rgb(var(--lp-fg))]">
                <LiveMetricValue
                  value={data.revenue.weekTotal}
                  className="font-heading text-[1.65rem] font-bold tracking-tight text-[rgb(var(--lp-fg))]"
                >
                  {fmtKr(data.revenue.weekTotal)}
                </LiveMetricValue>
              </p>
              <p className="mt-1.5 text-[10px] text-[rgb(var(--lp-muted))]">
                <LiveMetricValue value={data.revenue.ordersCountedWeek} className="text-[10px] text-[rgb(var(--lp-muted))]">
                  {data.revenue.ordersCountedWeek} ordre
                </LiveMetricValue>
              </p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Fra AI</p>
              <p className="mt-1 font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]/95">
                <LiveMetricValue value={data.revenue.fromAiAttributed} className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]/95">
                  {fmtKr(data.revenue.fromAiAttributed)}
                </LiveMetricValue>
              </p>
              <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
                uke · i dag{" "}
                <LiveMetricValue value={data.revenue.fromAiAttributedToday} className="text-[10px] text-[rgb(var(--lp-muted))]">
                  {fmtKr(data.revenue.fromAiAttributedToday)}
                </LiveMetricValue>
              </p>
            </div>
          </div>
          {data.revenue.dataSource === "unavailable" ? (
            <p className="mt-2 text-xs text-amber-800">Ordredata utilgjengelig — kontroller database/tilgang.</p>
          ) : null}
        </section>
      </AlertEdgeFrame>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">P&L Dashboard</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Ukesnitt fra kontrolltårn-aggregat. Tall er sanne for omsetning; varekost og annonsespend følger kilde-status nedenfor.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Omsetning (uke)</p>
            <p className="mt-1 font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">{fmtKr(basePl.revenue)}</p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Varekost</p>
            <p className="mt-1 font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">{fmtKr(basePl.costOfGoods)}</p>
            {!data.finance.cogsKnown ? (
              <p className="mt-1 text-[10px] text-amber-900">Ikke i aggregat v1</p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Annonsespend</p>
            <p className="mt-1 font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">{fmtKr(basePl.adSpend)}</p>
            {!data.finance.adSpendKnown ? (
              <p className="mt-1 text-[10px] text-amber-900">Ikke i aggregat v1</p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Nettoresultat</p>
            <p className="mt-1 font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">{fmtKr(basePl.netProfit)}</p>
            <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">Brutto − annonse</p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Margin %</p>
            <p className="mt-1 font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">{pct(basePl.margin)}</p>
            <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">Netto / omsetning</p>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white/80 px-3 py-2 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Bruttofortjeneste</p>
          <p className="mt-0.5 font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">{fmtKr(basePl.grossProfit)}</p>
        </div>
        <ul className="mt-3 list-inside list-disc space-y-0.5 text-[10px] leading-snug text-[rgb(var(--lp-muted))]/90">
          {data.finance.explainNb.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {data.finance.unitEconomics.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[rgb(var(--lp-border))] bg-white/90">
            <table className="w-full min-w-[360px] border-collapse text-left text-xs text-[rgb(var(--lp-text))]">
              <thead>
                <tr className="border-b border-[rgb(var(--lp-border))] text-[10px] uppercase text-[rgb(var(--lp-muted))]">
                  <th className="px-3 py-2 font-medium">Produkt</th>
                  <th className="px-3 py-2 font-medium text-right">Margin</th>
                  <th className="px-3 py-2 font-medium text-right">DB/enhet</th>
                </tr>
              </thead>
              <tbody>
                {data.finance.unitEconomics.map((u) => (
                  <tr key={u.productId} className="border-b border-[rgb(var(--lp-border))]/80">
                    <td className="px-3 py-2 font-mono">{u.productId}</td>
                    <td className="px-3 py-2 text-right font-mono">{pct(u.margin)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtKr(u.profitPerUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
            Enhetsøkonomikk: ingen rader i aggregat v1 (krever produktkost koblet til omsetning).
          </p>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Simulering</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Deterministisk modell på P&L-grunnlaget over — ingen endringer i system eller priser. Velg scenario og logg til aktivitetslogg ved behov.
        </p>
        {!canSimulate ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
            Simulering er blokkert: ordredata utilgjengelig (fail-closed). Oppfrisk når kilden er OK.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label className="inline-flex min-h-[44px] cursor-pointer touch-manipulation select-none items-center gap-2 rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm transition-transform duration-150 active:scale-[0.99]">
                <input
                  type="checkbox"
                  checked={scaleAds}
                  onChange={(e) => setScaleAds(e.target.checked)}
                  className="h-4 w-4"
                />
                Øk annonsebudsjett (+20 % spend, +15 % omsetning)
              </label>
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={priceUp}
                  onChange={(e) => setPriceUp(e.target.checked)}
                  className="h-4 w-4"
                />
                Øk pris (+5 % omsetning)
              </label>
              <label className="inline-flex min-h-[44px] cursor-pointer touch-manipulation select-none items-center gap-2 rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm transition-transform duration-150 active:scale-[0.99]">
                <input
                  type="checkbox"
                  checked={priceDown}
                  onChange={(e) => setPriceDown(e.target.checked)}
                  className="h-4 w-4"
                />
                Senk pris (−5 % omsetning)
              </label>
            </div>
            {priceUp && priceDown ? (
              <p className="mt-2 text-xs text-amber-900">
                Både pris opp og ned er valgt — modellen bruker begge multiplikatorer i fast rekkefølge (deterministisk, men sjelden realistisk).
              </p>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
                <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Forventet nettoresultat</p>
                <p className="mt-1 font-heading text-xl font-semibold">{fmtKr(simResult.pl.netProfit)}</p>
              </div>
              <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
                <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Endring margin (pts)</p>
                <p className="mt-1 font-heading text-xl font-semibold">{(marginDelta * 100).toFixed(2)} %</p>
              </div>
              <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md text-center">
                <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Risiko (heuristikk)</p>
                <p className="mt-1 font-heading text-xl font-semibold">{riskLabelNb(risk)}</p>
                <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">Basert på simulert nettoresultat</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-[rgb(var(--lp-muted))]">
              Simulert omsetning {fmtKr(simResult.revenue)} · spend {fmtKr(simResult.adSpend)} · varekost uendret{" "}
              {fmtKr(simResult.costOfGoods)}.
            </p>
            <button
              type="button"
              disabled={simPending}
              className="mt-4 inline-flex min-h-[44px] touch-manipulation select-none items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-fg))] transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
              onClick={() =>
                startSimTransition(() => {
                  void (async () => {
                    setSimMessage(null);
                    const r = await controlTowerFinanceSimulationLogAction({
                      scenarioFlags: {
                        increaseBudget: scaleAds,
                        priceIncrease: priceUp,
                        priceDecrease: priceDown,
                      },
                      baseInputs: { ...data.finance.inputs },
                      result: {
                        netProfit: simResult.pl.netProfit,
                        margin: simResult.pl.margin,
                        revenue: simResult.revenue,
                        grossProfit: simResult.pl.grossProfit,
                        adSpend: simResult.adSpend,
                        costOfGoods: simResult.costOfGoods,
                      },
                      risk,
                    });
                    if (!r.ok) {
                      setSimMessage(r.error ?? "Kunne ikke logge");
                      return;
                    }
                    setSimMessage("Simulering logget i aktivitetslogg (ingen automatisk handling).");
                  })();
                })
              }
            >
              {simPending ? "Logger…" : "Logg simulering (audit)"}
            </button>
            {simMessage ? <p className="mt-2 text-sm text-[rgb(var(--lp-text))]">{simMessage}</p> : null}
          </>
        )}
      </section>

      <section>
        <LiveSectionHeading title="AI-status" trustKind="REAL" />
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Siste døgn fra <code className="text-[10px]">ai_activity_log</code> (SoMe-autonomi, siste {400} rader).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Beslutninger</p>
            <p className="mt-1 font-heading text-2xl font-semibold">
              <LiveMetricValue value={data.ai.decisions24h} className="font-heading text-2xl font-semibold">
                {data.ai.decisions24h}
              </LiveMetricValue>
            </p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Godkjent / utført</p>
            <p className="mt-1 font-heading text-2xl font-semibold">
              <LiveMetricValue value={data.ai.approved24h} className="font-heading text-2xl font-semibold">
                {data.ai.approved24h}
              </LiveMetricValue>
            </p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Hoppet over</p>
            <p className="mt-1 font-heading text-2xl font-semibold">
              <LiveMetricValue value={data.ai.skipped24h} className="font-heading text-2xl font-semibold">
                {data.ai.skipped24h}
              </LiveMetricValue>
            </p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Lav tillit</p>
            <p className="mt-1 font-heading text-2xl font-semibold">
              <LiveMetricValue value={data.ai.lowConfidence24h} className="font-heading text-2xl font-semibold">
                {data.ai.lowConfidence24h}
              </LiveMetricValue>
            </p>
            <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">siste syklus: {fmtIso(data.ai.lastCycleAt)}</p>
          </div>
        </div>
        {!data.ai.logAvailable ? (
          <p className="mt-2 text-xs text-amber-800">AI-logg kunne ikke leses (tomt eller feil).</p>
        ) : null}
      </section>

      <section>
        <LiveSectionHeading title="Ytelse (uke)" trustKind="REAL" />
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Topp verdi kun fra ordre med AI-attributjon (ingen antakelser).</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Beste innlegg</p>
            <p className="mt-1 font-mono text-sm">{data.performance.topPostId ?? "—"}</p>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              <LiveMetricValue value={data.performance.topPostRevenue} className="text-xs text-[rgb(var(--lp-muted))]">
                {fmtKr(data.performance.topPostRevenue)}
              </LiveMetricValue>
            </p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Beste produkt</p>
            <p className="mt-1 font-mono text-sm">{data.performance.topProductId ?? "—"}</p>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              <LiveMetricValue value={data.performance.topProductRevenue} className="text-xs text-[rgb(var(--lp-muted))]">
                {fmtKr(data.performance.topProductRevenue)}
              </LiveMetricValue>
            </p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">AI-andel (ordre)</p>
            <p className="mt-1 font-heading text-2xl font-semibold">
              <LiveMetricValue
                value={String(data.performance.aiAttributedShareWeek ?? "na")}
                className="font-heading text-2xl font-semibold"
              >
                {pct(data.performance.aiAttributedShareWeek)}
              </LiveMetricValue>
            </p>
            <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">andel ordre med ai_social</p>
          </div>
        </div>
      </section>

      <AlertEdgeFrame active={data.system.health !== "ok"} className="overflow-hidden" shakeNonce={healthShake}>
        <section>
          <LiveSectionHeading title="System" trustKind="REAL" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div
              className={[
                "rounded-2xl border bg-white px-4 py-4 text-center",
                data.system.health === "ok"
                  ? "border-[rgb(var(--lp-border))] shadow-md shadow-black/[0.06]"
                  : "border-[rgb(var(--lp-border))] shadow-md shadow-black/[0.08]",
              ].join(" ")}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-fg))]/80">Status</p>
              <p className="mt-1 font-heading text-[1.65rem] font-bold leading-tight tracking-tight text-[rgb(var(--lp-fg))]">
                <LiveMetricValue
                  value={data.system.health}
                  className="font-heading text-[1.65rem] font-bold tracking-tight text-[rgb(var(--lp-fg))]"
                >
                  {healthNb(data.system.health)}
                </LiveMetricValue>
              </p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/85 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">Siste helse-sjekk</p>
              <p className="mt-1 text-xs text-[rgb(var(--lp-text))]/90">{fmtIso(data.system.lastHealthCheckAt)}</p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/85 px-4 py-3 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-[10px] font-medium uppercase text-[rgb(var(--lp-muted))]">AI-feil (24t)</p>
              <p className="mt-1 font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]/95">
                <LiveMetricValue value={data.system.aiFailures24h} className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]/95">
                  {data.system.aiFailures24h}
                </LiveMetricValue>
              </p>
              <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">logg-metadata</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">{data.system.summary}</p>
        </section>
      </AlertEdgeFrame>
    </div>
  );
}
