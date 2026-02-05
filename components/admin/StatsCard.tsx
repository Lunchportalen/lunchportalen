// components/admin/StatsCard.tsx
"use client";

import { ReactNode } from "react";
import { t } from "@/lib/copy/admin";

type Tone = "default" | "neutral" | "surface";

type Props = {
  /** Copy-key for liten tittel (øverst), f.eks "stats.todayOrders.title" */
  titleKey: string;
  /** Vars til {{...}} i titleKey */
  titleVars?: Record<string, any>;

  /** Hovedtall */
  value: ReactNode;

  /** Copy-key for liten fotlinje, f.eks "stats.todayOrders.cancelled" */
  footerKey?: string;
  /** Vars til {{...}} i footerKey */
  footerVars?: Record<string, any>;

  /** Hvis true: vis tom-tekst i stedet for value/footer */
  empty?: boolean;
  /** Copy-key for tomtekst, f.eks "stats.todayOrders.empty" */
  emptyKey?: string;

  /** Ekstra hjelpe-/info-tekst (valgfritt) */
  helpKey?: string;
  helpVars?: Record<string, any>;

  /** Visuelt: bakgrunnstoning */
  tone?: Tone;

  /** Ekstra klasser */
  className?: string;
};

/**
 * StatsCard – enterprise, rolig, konsistent.
 * Bruker lp-tokens: --lp-border, --lp-surface, --lp-muted.
 */
export default function StatsCard({
  titleKey,
  titleVars,
  value,
  footerKey,
  footerVars,
  empty,
  emptyKey,
  helpKey,
  helpVars,
  tone = "default",
  className = "",
}: Props) {
  const bg =
    tone === "surface"
      ? "bg-[rgb(var(--lp-surface))]"
      : tone === "neutral"
        ? "bg-white/70"
        : "bg-white";

  const title = t(titleKey, titleVars);

  const emptyText = emptyKey ? t(emptyKey) : t("system.micro.noResults");
  const footer = footerKey ? t(footerKey, footerVars) : "";
  const help = helpKey ? t(helpKey, helpVars) : "";

  return (
    <div
      className={[
        "rounded-3xl p-5 ring-1 ring-[rgb(var(--lp-border))]",
        bg,
        className,
      ].join(" ")}
    >
      <div className="text-xs text-[rgb(var(--lp-muted))]">{title}</div>

      {empty ? (
        <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{emptyText}</div>
      ) : (
        <>
          <div className="mt-1 text-2xl font-semibold">{value}</div>

          {footer ? (
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{footer}</div>
          ) : null}

          {help ? (
            <div className="mt-3 text-xs text-[rgb(var(--lp-muted))]">{help}</div>
          ) : null}
        </>
      )}
    </div>
  );
}

/* =========================================================
   Convenience helpers (valgfritt)
========================================================= */

/**
 * CutoffCard – standardisert kort for Cut-off.
 * Krever at copy finnes: stats.cutoff.*
 */
export function CutoffCard(props: { className?: string }) {
  return (
    <StatsCard
      titleKey="stats.cutoff.title"
      value={t("stats.cutoff.time")}
      footerKey="stats.cutoff.note"
      helpKey="stats.cutoff.help"
      tone="default"
      className={props.className}
    />
  );
}
