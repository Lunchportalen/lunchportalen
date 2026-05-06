import Link from "next/link";

import { MODULE_LIVE_POSTURE_REGISTRY } from "@/lib/cms/moduleLivePosture";

/**
 * U18 — AI control center: ærlig modulposture + governance-prinsipper (lesing fra CP6-register).
 * Ingen ny orkestrator; ingen skjult sannhet.
 */
export function AiGovernanceOverview() {
  return (
    <section className="lp-card soft p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="lp-h2 text-[rgb(var(--lp-text))]">Governance & modulstatus</h2>
          <p className="lp-lead mt-2 max-w-3xl">
            CMS står stabilt; AI og vekstmoduler er <strong className="font-black text-[rgb(var(--lp-text))]">valgfrie</strong>,{" "}
            <strong className="font-black text-[rgb(var(--lp-text))]">review-first</strong> der det trengs, og styrt av faktisk
            backend-atferd. Oversikten viser samme sannhet som drift og dokumentasjon.
          </p>
        </div>
        <span className="lp-chip lp-chip-ok shrink-0">System truth</span>
      </div>
      <ul className="mt-5 divide-y divide-[rgb(var(--lp-divider))]/80">
        {MODULE_LIVE_POSTURE_REGISTRY.map((row) => (
          <li key={row.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-black text-[rgb(var(--lp-text))]">{row.label}</span>
              <span className="lp-chip lp-chip-neutral font-mono text-[10px] uppercase tracking-wide">
                {row.posture === "STUB" ? "Ikke aktiv" : row.posture}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[rgb(var(--lp-muted))]">{row.note}</p>
          </li>
        ))}
      </ul>
      <div className="lp-actions mt-5 border-t border-[rgb(var(--lp-border))]/70 pt-4 text-sm font-medium">
        <span className="text-[rgb(var(--lp-muted))]">Hurtiglenker:</span>
        <Link className="lp-link" href="/backoffice/content">
          Content
        </Link>
        <Link className="lp-link" href="/backoffice/media">
          Media
        </Link>
        <Link className="lp-link" href="/backoffice/seo-growth">
          SEO
        </Link>
        <Link className="lp-link" href="/backoffice/social">
          Social
        </Link>
        <Link className="lp-link" href="/backoffice/week-menu">
          Uke & meny
        </Link>
      </div>
    </section>
  );
}
