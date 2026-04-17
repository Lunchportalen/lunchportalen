import Link from "next/link";

import { EditorialAuditTimelinePanel } from "./EditorialAuditTimelinePanel";
import { getSanityStudioBaseUrl } from "@/lib/cms/sanityStudioUrl";

/**
 * CP12 — Unified history *narrative* (UX): hvor versjoner og historikk faktisk lever.
 * U18 — Tydeligere per-kilde-fortelling + rollback-ærlighet (ingen samlet tidslinje-API).
 * U19 — Redaksjonell tidslinje (UX-lag): tre parallelle spor — ikke én sammenslått teknisk motor.
 * U20 — Aggregert feed fra `content_audit_log` (klient) med eksplisitt kilde-badge.
 */
export function CmsHistoryDiscoveryStrip() {
  const studioUrl = getSanityStudioBaseUrl();

  return (
    <details
      className="group shrink-0 border-b border-slate-200/90 bg-slate-50/95 text-[11px] leading-snug text-slate-700 sm:px-0"
      aria-label="Redaksjonell historikk og kilder"
    >
      <summary className="min-h-11 cursor-pointer list-none px-4 py-2 marker:content-none sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold text-slate-900">Historikk & publish</span>
        <span className="text-slate-500"> · trykk for å utvide kilder og spor</span>
      </summary>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 pb-3 pt-1 sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
          <span className="shrink-0 font-semibold text-slate-900">Historikk & publish (samlet fortelling)</span>
          <span className="min-w-0 text-slate-600">
            Det finnes <strong className="font-medium text-slate-800">ikke én teknisk tidslinje</strong> for alt — kildene
            er forskjellige. Bruk riktig arbeidsflate per domene.
          </span>
        </div>
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3"
          aria-label="Redaksjonelle spor (UX — ikke én logg)"
        >
          <div className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 shadow-sm">
            <p className="font-semibold text-slate-900">Spor A · Public / redaksjonelle sider</p>
            <p className="mt-1 text-slate-600">
              Samme innholdsspor som forsiden (lagring i Postgres). Publish, variant og audit i innholdsworkspace.{" "}
              <Link className="font-medium text-slate-900 underline underline-offset-2" href="/backoffice/content">
                Åpne innhold
              </Link>
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 shadow-sm">
            <p className="font-semibold text-slate-900">Spor B · Meny (Sanity)</p>
            <p className="mt-1 text-slate-600">
              Versjonshistorikk i{" "}
              <a
                className="font-medium text-slate-900 underline underline-offset-2"
                href={studioUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Sanity Studio
              </a>
              .
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 shadow-sm">
            <p className="font-semibold text-slate-900">Spor C · Uke & meny</p>
            <p className="mt-1 text-slate-600">
              Operativ vs redaksjonell forklaring.{" "}
              <Link className="font-medium text-slate-900 underline underline-offset-2" href="/backoffice/week-menu">
                Uke & meny
              </Link>
            </p>
          </div>
        </div>
        <EditorialAuditTimelinePanel />

        <ul className="list-inside list-disc space-y-0.5 text-slate-600 sm:ml-1">
          <li>
            <strong className="font-medium text-slate-800">Public / redaksjonelle sider:</strong> recovery/gjennomgang og
            variantarbeid i{" "}
            <Link className="font-medium text-slate-900 underline underline-offset-2" href="/backoffice/content">
              innholdsworkspace
            </Link>
            . Rollback avhenger av workspace-funksjoner — ikke global «undo» for hele plattformen.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Meny / Sanity:</strong>{" "}
            <a
              className="font-medium text-slate-900 underline underline-offset-2"
              href={studioUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Sanity Studio
            </a>{" "}
            eier versjonshistorikk for menydokumenter.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Uke & meny (operativ vs redaksjonelt):</strong>{" "}
            <Link className="font-medium text-slate-900 underline underline-offset-2" href="/backoffice/week-menu">
              Uke & meny
            </Link>{" "}
            forklarer kildekjede og weekPlan som redaksjonelt spor der det gjelder.
          </li>
        </ul>
      </div>
    </details>
  );
}
