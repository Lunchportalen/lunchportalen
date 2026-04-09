"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buildControlView, type ControlViewModel } from "@/lib/controlTower/viewModel";
import { apiErrorMessageFromJson } from "@/lib/ui/apiErrorMessage";

function healthLabelNb(health: string): string {
  if (health === "ok") return "OK";
  if (health === "warning") return "Advarsel";
  if (health === "critical") return "Kritisk";
  return "Ukjent";
}

function healthChipClass(level: ControlViewModel["healthLevel"]): string {
  if (level === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (level === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
  if (level === "critical") return "border-red-200 bg-red-50 text-red-950";
  return "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-fg))]";
}

function trendArrow(d: ControlViewModel["trendDirection"]): string {
  if (d === "up") return "↑";
  if (d === "down") return "↓";
  if (d === "flat") return "→";
  return "·";
}

function trendLabelNb(d: ControlViewModel["trendDirection"]): string {
  if (d === "up") return "Opp";
  if (d === "down") return "Ned";
  if (d === "flat") return "Flat";
  return "Ukjent trend";
}

const navPill =
  "inline-flex min-h-[44px] touch-manipulation select-none items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium text-[rgb(var(--lp-fg))] transition-[transform,background-color] duration-150 hover:bg-black/[0.02] active:scale-[0.98]";
const navPillPrimary =
  "inline-flex min-h-[44px] touch-manipulation select-none items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-fg))] underline-offset-4 transition-[transform,background-color] duration-150 hover:underline hover:decoration-[var(--lp-hotpink)] hover:decoration-2 active:scale-[0.98] active:bg-[var(--lp-hotpink)]/6";

export default function ControlHeader() {
  const [view, setView] = useState<ReturnType<typeof buildControlView> | null>(null);
  const [snapshotErr, setSnapshotErr] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSnapshotErr(null);

    fetch("/api/superadmin/control-tower/snapshot", { cache: "no-store", credentials: "include" })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          let j: unknown;
          try {
            j = await r.json();
          } catch {
            setSnapshotErr(`Kunne ikke laste kontrolltårn-snapshot (HTTP ${r.status}).`);
            setView(null);
            return;
          }
          setSnapshotErr(apiErrorMessageFromJson(j, `Kunne ikke laste kontrolltårn-snapshot (HTTP ${r.status}).`));
          setView(null);
          return;
        }
        let data: unknown;
        try {
          data = await r.json();
        } catch {
          setSnapshotErr("Kunne ikke lese JSON fra kontrolltårn-snapshot.");
          setView(null);
          return;
        }
        if (cancelled) return;
        if (data && typeof data === "object") {
          try {
            setView(buildControlView(data));
            setSnapshotErr(null);
          } catch {
            setSnapshotErr("Snapshot kunne ikke vises (ugyldig form).");
            setView(null);
          }
        } else {
          setSnapshotErr("Tomt eller ugyldig kontrolltårn-snapshot.");
          setView(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setSnapshotErr(e instanceof Error ? e.message : "Nettverksfeil ved kontrolltårn-snapshot.");
          setView(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  if (snapshotErr) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{snapshotErr}</span>
          <button
            type="button"
            onClick={() => setRetryTick((n) => n + 1)}
            className="inline-flex min-h-[44px] shrink-0 touch-manipulation select-none items-center justify-center rounded-full border border-amber-900 bg-white px-4 py-2 text-sm font-medium text-amber-950 transition-transform duration-150 hover:bg-amber-100 active:scale-[0.98]"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="mb-5 space-y-3" aria-busy="true" aria-label="Laster kontrolltårn-snapshot">
        <div className="h-3 w-40 max-w-[85vw] animate-pulse rounded-md bg-[rgb(var(--lp-border))]/70" />
        <div className="h-12 w-full max-w-2xl rounded-xl bg-gradient-to-r from-[rgb(var(--lp-border))]/50 via-[rgb(var(--lp-surface))]/90 to-[rgb(var(--lp-border))]/50 bg-[length:200%_100%] animate-lpShimmer" />
        <div className="flex flex-wrap gap-2">
          <div className="h-10 w-28 animate-pulse rounded-full bg-[rgb(var(--lp-border))]/60" />
          <div className="h-10 w-28 animate-pulse rounded-full bg-[rgb(var(--lp-border))]/50" style={{ animationDelay: "120ms" }} />
          <div className="h-10 w-28 animate-pulse rounded-full bg-[rgb(var(--lp-border))]/45" style={{ animationDelay: "240ms" }} />
        </div>
      </div>
    );
  }

  const revStr = `${Math.round(view.revenue).toLocaleString("nb-NO")} kr`;
  const criticalJump = "/superadmin/control-tower#kontroll-varsler";

  return (
    <header className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[rgb(var(--lp-border))]/80 pb-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-950">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
          </span>
          Live
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${healthChipClass(view.healthLevel)}`}
          title="Systemhelse (kontrolltårn-data)"
        >
          <span className="text-[10px] uppercase text-[rgb(var(--lp-muted))]">Helse</span>
          {healthLabelNb(view.health)}
        </span>

        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--lp-border))] bg-white px-2.5 py-1 text-xs font-medium text-[rgb(var(--lp-fg))]"
          title="Omsetningstrend (prognosemotor)"
        >
          <span className="text-[10px] uppercase text-[rgb(var(--lp-muted))]">Trend</span>
          <span aria-hidden="true">{trendArrow(view.trendDirection)}</span>
          <span>{trendLabelNb(view.trendDirection)}</span>
        </span>

        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--lp-border))] bg-white px-2.5 py-1 text-xs font-medium text-[rgb(var(--lp-fg))]"
          title="Aktive finansvarsler (etter kjøling)"
        >
          <span className="text-[10px] uppercase text-[rgb(var(--lp-muted))]">Varsler</span>
          <span className="tabular-nums">{view.activeAlerts}</span>
        </span>

        <span className="text-xs text-[rgb(var(--lp-muted))]" aria-hidden>
          ·
        </span>
        <span className="text-xs tabular-nums text-[rgb(var(--lp-muted))]" title="Omsetning (revenue brain)">
          {revStr}
        </span>

        {view.criticalAlerts > 0 ? (
          <Link
            href={criticalJump}
            className="ml-auto inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-950 shadow-sm transition hover:bg-red-100"
          >
            <span aria-hidden="true">⚠️</span>
            <span>
              {view.criticalAlerts}{" "}
              {view.criticalAlerts === 1 ? "kritisk avvik" : "kritiske avvik"}
            </span>
          </Link>
        ) : null}
      </div>

      <nav aria-label="Hurtignavigasjon kontrollsenter" className="flex flex-wrap gap-2">
        <Link href="/superadmin/control-tower" className={navPillPrimary}>
          Kontrolltårn
        </Link>
        <Link href="/superadmin/operations" className={navPill}>
          Operasjoner
        </Link>
        <Link href="/superadmin/companies" className={navPill}>
          Firmaer
        </Link>
        <Link href="/superadmin/growth/social" className={navPill}>
          AI Engine
        </Link>
      </nav>
    </header>
  );
}
