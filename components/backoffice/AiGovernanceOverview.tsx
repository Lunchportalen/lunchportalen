import Link from "next/link";

import { MODULE_LIVE_POSTURE_REGISTRY } from "@/lib/cms/moduleLivePosture";

/**
 * U18 — AI control center: ærlig modulposture + governance-prinsipper (lesing fra CP6-register).
 * Ingen ny orkestrator; ingen skjult sannhet.
 */
export function AiGovernanceOverview() {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Governance & modulposture</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">
        CMS står stabilt; AI og vekstmoduler er <strong className="font-medium text-slate-800">valgfrie</strong>,{" "}
        <strong className="font-medium text-slate-800">review-first</strong> der det trengs, og styrt av faktisk
        backend-atferd. Tabellen under er samme sannhet som drift og dokumentasjon — ikke en egen «grønn» visning.
      </p>
      <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {MODULE_LIVE_POSTURE_REGISTRY.map((row) => (
          <li key={row.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium text-slate-900">{row.label}</span>
              <span className="rounded border border-slate-200 bg-slate-50 px-3 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                {row.posture}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{row.note}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-slate-900">
        <span className="text-slate-500">Hurtiglenker:</span>
        <Link className="underline underline-offset-2" href="/backoffice/content">
          Content
        </Link>
        <Link className="underline underline-offset-2" href="/backoffice/media">
          Media
        </Link>
        <Link className="underline underline-offset-2" href="/backoffice/seo-growth">
          SEO
        </Link>
        <Link className="underline underline-offset-2" href="/backoffice/social">
          Social
        </Link>
        <Link className="underline underline-offset-2" href="/backoffice/week-menu">
          Uke & meny
        </Link>
      </div>
    </section>
  );
}
