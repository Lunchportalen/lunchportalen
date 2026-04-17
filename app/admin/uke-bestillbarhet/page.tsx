// app/admin/uke-bestillbarhet/page.tsx — firmascopet read-only ukeoversikt (bestillbarhet per dag)
export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Link from "next/link";

import {
  loadAdminContext,
  isAdminContextBlocked,
  type AdminContextBlocked,
} from "@/lib/admin/loadAdminContext";
import { formatDateNO } from "@/lib/date/format";
import { loadCompanyWeekBookabilityOverview } from "@/lib/server/admin/loadCompanyWeekBookabilityOverview";

import BlockedState from "@/components/admin/BlockedState";
import SupportReportButton from "@/components/admin/SupportReportButton";
import AdminPageShell from "@/components/admin/AdminPageShell";

function blockedTitle(ctx: AdminContextBlocked) {
  if (ctx.blocked === "ACCOUNT_DISABLED") return "Konto er deaktivert";
  if (ctx.blocked === "MISSING_COMPANY_ID") return "Mangler firmatilknytning";
  if (ctx.blocked === "COMPANY_INACTIVE") return "Firma er ikke aktivt";
  return "Systemfeil";
}

function blockedBody(ctx: AdminContextBlocked) {
  if (ctx.blocked === "ACCOUNT_DISABLED") return "Kontoen er deaktivert og har ikke tilgang til administrasjon.";
  if (ctx.blocked === "MISSING_COMPANY_ID") return "Kontoen er registrert som company_admin, men mangler company_id.";
  if (ctx.blocked === "COMPANY_INACTIVE") return "Tilgang er begrenset fordi firma ikke er aktivt.";
  return "Vi klarte ikke å hente nødvendig kontekst akkurat nå.";
}

function blockedLevel(ctx: AdminContextBlocked): "followup" | "critical" {
  return ctx.blocked === "COUNTS_FAILED" ? "critical" : "followup";
}

export default async function UkeBestillbarhetPage() {
  const ctx = await loadAdminContext({
    nextPath: "/admin/uke-bestillbarhet",
    enforceCompanyAdmin: true,
    returnBlockedState: true,
  });

  if (isAdminContextBlocked(ctx)) {
    return (
      <div className="lp-container py-8">
        <BlockedState
          level={blockedLevel(ctx)}
          title={blockedTitle(ctx)}
          body={blockedBody(ctx)}
          nextSteps={ctx.nextSteps}
          action={
            <SupportReportButton
              reason={ctx.support.reason}
              companyId={ctx.support.companyId}
              locationId={ctx.support.locationId}
              buttonLabel="Send systemrapport"
              buttonClassName="lp-btn lp-btn--secondary"
            />
          }
          meta={[
            { label: "auth.user.id", value: ctx.dbg.authUserId },
            { label: "auth.user.email", value: ctx.dbg.authEmail || "-" },
            { label: "company_id", value: ctx.companyId ?? "-" },
          ]}
        />
      </div>
    );
  }

  const overview = await loadCompanyWeekBookabilityOverview({
    companyId: ctx.companyId,
    locationId: ctx.profile?.location_id ?? null,
    companyStatusUpper: String(ctx.company?.status ?? "ACTIVE").toUpperCase(),
  });

  return (
    <AdminPageShell
      title="Uke og bestillbarhet"
      subtitle="Oversikt for synlige uker i /week: operative dager i daymap, stengte datoer, cut-off og firmastatus — samme kilder som firmadagens drift. Kun visning."
      actions={null}
    >
      {overview.config_warning_nb ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
          {overview.config_warning_nb}
        </div>
      ) : null}

      <section className="lp-card lp-card--elevated" aria-labelledby="uke-grunnlag-heading">
        <div className="lp-card-pad">
          <h2 id="uke-grunnlag-heading" className="text-sm font-semibold text-neutral-900">
            Operativt ukegrunnlag
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Firma (status)</dt>
              <dd className="mt-1 font-medium text-neutral-900">{overview.company_status_upper}</dd>
            </div>
            <div className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Avtale (ledger)</dt>
              <dd className="mt-1 font-medium text-neutral-900">{overview.ledger_pipeline_label_nb}</dd>
            </div>
            <div className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Avtale (snapshot)</dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {overview.snapshot_agreement_status_upper ?? "—"}{" "}
                <span className="text-xs font-normal text-neutral-600">(company_current_agreement)</span>
              </dd>
            </div>
            <div className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Operative leveringsdager (daymap)</dt>
              <dd className="mt-1 text-neutral-900">{overview.operative_days_label_nb}</dd>
            </div>
            <div className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Synlighet i /week</dt>
              <dd className="mt-1 text-neutral-900">{overview.week_visibility_summary_nb}</dd>
            </div>
          </dl>
        </div>
      </section>

      {overview.weeks.length === 0 ? (
        <p className="text-sm text-neutral-700">Ingen synlige uker akkurat nå — sjekk igjen etter planlagt ukeskifte (Oslo).</p>
      ) : (
        overview.weeks.map((w) => (
          <section key={w.week_start_iso} className="lp-card lp-card--elevated" aria-labelledby={`uke-${w.week_start_iso}`}>
            <div className="lp-card-pad">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 id={`uke-${w.week_start_iso}`} className="text-sm font-semibold text-neutral-900">
                  {w.title_nb}
                </h2>
                <p className="text-xs font-medium text-neutral-600 sm:text-sm">{w.range_label_nb}</p>
              </div>

              <ul className="mt-4 space-y-3 text-sm text-neutral-800">
                {w.days.map((d) => (
                  <li key={`${d.date_iso}-det`} className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5">
                    <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:text-left">
                      <div className="min-w-0 font-medium text-neutral-900">
                        {formatDateNO(d.date_iso)} · {d.weekday_label_nb}
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {d.daymap_active ? (
                          <span className="inline-flex min-h-[44px] items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
                            Aktiv i daymap
                          </span>
                        ) : (
                          <span className="inline-flex min-h-[44px] items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-800 ring-1 ring-neutral-200">
                            Ikke i daymap
                          </span>
                        )}
                        <span className="inline-flex min-h-[44px] items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-800 ring-1 ring-black/10">
                          Nivå: {d.tier_label_nb ?? "—"}
                        </span>
                        {d.booking === "open" ? (
                          <span className="inline-flex min-h-[44px] items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
                            Bestilling: åpen
                          </span>
                        ) : (
                          <span className="inline-flex min-h-[44px] items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-900 ring-1 ring-rose-200">
                            Bestilling: blokkert
                          </span>
                        )}
                      </div>
                    </div>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-left text-sm text-neutral-700">
                      {d.detail_lines_nb.map((line, i) => (
                        <li key={`${d.date_iso}-l-${i}`}>{line}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))
      )}

      <section className="lp-card lp-card--elevated" aria-labelledby="uke-lenker-heading">
        <div className="lp-card-pad">
          <h2 id="uke-lenker-heading" className="text-sm font-semibold text-neutral-900">
            Relaterte flater
          </h2>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Link href="/week" className="lp-btn lp-btn--secondary lp-neon-focus">
              Ukeplan (/week)
            </Link>
            <Link href="/admin" className="lp-btn lp-btn--secondary lp-neon-focus">
              Oversikt (/admin)
            </Link>
            <Link href="/admin/leveringsgrunnlag" className="lp-btn lp-btn--secondary lp-neon-focus">
              Leveringsgrunnlag
            </Link>
            <Link href="/admin/orders" className="lp-btn lp-btn--secondary lp-neon-focus">
              Ordrehistorikk
            </Link>
          </div>
        </div>
      </section>
    </AdminPageShell>
  );
}
