// components/admin/InsightAlerts.tsx
"use client";

import { useMemo } from "react";
import { t, tArray } from "@/lib/copy/admin";

type Props = {
  /**
   * Navn på lokasjon som kan templatiseres inn i varsler:
   * "Lav dekning på lokasjon {{name}} …"
   */
  locationName?: string | null;

  /**
   * Hvis du senere vil gi dynamiske alerts fra backend:
   * - strings: rene tekster (allerede ferdig generert)
   * - tom array => faller tilbake på copy-pack sine eksempelvarsler (hvis useFallback=true)
   */
  alerts?: string[] | null;

  /**
   * Default: true
   * Når true og alerts er tom/undefined -> bruk copy-pack sine eksempelvarsler.
   */
  useFallback?: boolean;

  /**
   * Vis antall maks (for rolig UI)
   * Default: 4
   */
  maxItems?: number;

  className?: string;
};

/**
 * InsightAlerts – rolig enterprise-liste for "Varsler" i Innsikt (AI)
 * - Ingen støy
 * - Tomtilstand håndteres
 * - Kan brukes både med statiske (copy) og dynamiske (backend) varsler
 */
export default function InsightAlerts({
  locationName,
  alerts,
  useFallback = true,
  maxItems = 4,
  className = "",
}: Props) {
  const items = useMemo(() => {
    const dyn = (alerts ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);

    if (dyn.length) return dyn.slice(0, maxItems);

    if (!useFallback) return [];

    // fallback til copy-pack eksempelvarsler
    const fallback = tArray("insightAI.alerts.items", { name: locationName ?? "" })
      .map((s) => String(s ?? "").trim())
      .filter(Boolean);

    return fallback.slice(0, maxItems);
  }, [alerts, useFallback, maxItems, locationName]);

  return (
    <section
      className={[
        "rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]",
        className,
      ].join(" ")}
      aria-label={t("insightAI.alerts.title")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{t("insightAI.alerts.title")}</div>
        {/* Liten, rolig status-chip */}
        <span className="lp-chip lp-chip-neutral">
          {items.length ? `${items.length}` : "0"}
        </span>
      </div>

      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((msg, idx) => (
            <li key={`${idx}-${msg}`} className="flex gap-3">
              <span
                className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[rgb(var(--lp-muted))]/40"
                aria-hidden="true"
              />
              <div className="text-sm text-[rgb(var(--lp-muted))]">{msg}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 text-sm text-[rgb(var(--lp-muted))]">
          {t("insightAI.alerts.empty")}
        </div>
      )}

      <div className="mt-4 rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-xs text-[rgb(var(--lp-muted))]">{t("insightAI.explain")}</div>
      </div>
    </section>
  );
}
