import Link from "next/link";

import { formatDateNO } from "@/lib/date/format";
import type { CompanyOperationalBrief } from "@/lib/server/admin/loadCompanyOperationalBrief";

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function BookingPill({ booking }: { booking: CompanyOperationalBrief["booking_today"] }) {
  if (booking === "open") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
        Bestilling i dag: åpen
      </span>
    );
  }
  if (booking === "not_applicable") {
    return (
      <span className="inline-flex rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-800 ring-1 ring-neutral-200">
        Bestilling i dag: ikke aktuelt
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-900 ring-1 ring-rose-200">
      Bestilling i dag: blokkert
    </span>
  );
}

function cutoffLabelNb(v: CompanyOperationalBrief["cutoff_today"]) {
  if (v === "PAST") return "Dato i fortid (låst)";
  if (v === "TODAY_OPEN") return "I dag før kl. 08:00 (Oslo)";
  if (v === "TODAY_LOCKED") return "I dag etter kl. 08:00 (Oslo)";
  return "Fremtidig dato (åpen for planlegging)";
}

function StatusPill({ label }: { label: string }) {
  const upper = String(label || "UNKNOWN").toUpperCase();
  const cls =
    upper === "ACTIVE"
      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
      : upper === "PAUSED"
        ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
        : upper === "CLOSED"
          ? "bg-rose-50 text-rose-900 ring-1 ring-rose-200"
          : upper === "PENDING"
            ? "bg-neutral-50 text-neutral-800 ring-1 ring-black/10"
            : "bg-neutral-50 text-neutral-800 ring-1 ring-black/10";

  return <span className={cx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", cls)}>{upper}</span>;
}

export default function CompanyOperationalBriefPanel({ brief }: { brief: CompanyOperationalBrief }) {
  return (
    <section id="firma-operativt" aria-labelledby="firma-operativt-heading" className="lp-card lp-card--elevated">
      <div className="lp-card-pad">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="firma-operativt-heading" className="text-sm font-semibold text-neutral-900">
              Firmadagens drift · {formatDateNO(brief.today_iso)}
            </h2>
            <p className="mt-1 text-sm lp-muted">
              Lesing fra companies, ledger-avtaler, daymap, closed_dates, cut-off og operative ordre (samme filter som /api/kitchen). Ingen ny ordre- eller driftmotor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label={brief.company_status_upper} />
            <BookingPill booking={brief.booking_today} />
          </div>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Avtale (ledger)</dt>
            <dd className="mt-1 font-medium text-neutral-900">{brief.ledger_pipeline_label_nb}</dd>
          </div>
          <div className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Avtale (snapshot)</dt>
            <dd className="mt-1 font-medium text-neutral-900">
              {brief.snapshot_agreement_status_upper ?? "—"}{" "}
              <span className="text-xs font-normal text-neutral-600">(company_current_agreement)</span>
            </dd>
          </div>
          <div className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5 sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Operative leveringsdager (daymap)</dt>
            <dd className="mt-1 text-neutral-900">{brief.operative_days_label_nb}</dd>
          </div>
          <div className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5 sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Uke i /week</dt>
            <dd className="mt-1 text-neutral-900">{brief.week_visibility_summary_nb}</dd>
          </div>
          <div className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5 sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Cut-off i dag (modell)</dt>
            <dd className="mt-1 text-sm text-neutral-900">
              {cutoffLabelNb(brief.cutoff_today)}{" "}
              <span className="font-mono text-xs text-neutral-600">({brief.cutoff_today})</span>
            </dd>
          </div>
        </dl>

        <div className="mt-6 rounded-2xl border border-black/5 bg-white/90 p-4 ring-1 ring-black/5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Operative ordre i dag (firma)</h3>
          {brief.orders_day.ok === false ? (
            <p className="mt-2 text-sm text-rose-800">{brief.orders_day.message}</p>
          ) : (
            <div className="mt-3 space-y-3 text-sm text-neutral-900">
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="text-xs font-semibold text-neutral-600">Totalt operative</span>
                  <div className="text-2xl font-semibold tabular-nums">{brief.orders_day.total_operative}</div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-neutral-600">Aktive rå (DB)</span>
                  <div className="text-lg font-semibold tabular-nums text-neutral-800">{brief.orders_day.total_raw_active}</div>
                </div>
              </div>
              {Object.keys(brief.orders_day.by_slot).length > 0 ? (
                <div>
                  <div className="text-xs font-semibold text-neutral-600">Per vindu (slot)</div>
                  <p className="mt-1 text-neutral-800">
                    {Object.entries(brief.orders_day.by_slot)
                      .sort(([a], [b]) => a.localeCompare(b, "nb"))
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-neutral-600">Ingen operative ordre — ingen slot-fordeling.</p>
              )}
              {brief.orders_day.by_location.length > 0 ? (
                <div>
                  <div className="text-xs font-semibold text-neutral-600">Per lokasjon</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-neutral-800">
                    {brief.orders_day.by_location.map((row) => (
                      <li key={row.location_id}>
                        {row.location_label}{" "}
                        <span className="font-mono text-xs text-neutral-500">({row.location_id})</span>:{" "}
                        <span className="tabular-nums font-semibold">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
          <div className="mt-3 border-t border-black/5 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Ordre — forklaring</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800">
              {brief.orders_context_lines_nb.map((line, i) => (
                <li key={`oc-${i}`}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Bestilling / drift — forklaring</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800">
            {brief.booking_detail_lines_nb.map((line, i) => (
              <li key={`bk-${i}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/week" className="lp-btn lp-btn--secondary lp-neon-focus">
            Ukeplan (/week)
          </Link>
          <Link href="/admin/uke-bestillbarhet" className="lp-btn lp-btn--secondary lp-neon-focus">
            Uke og bestillbarhet
          </Link>
          <Link href="/admin/orders" className="lp-btn lp-btn--secondary lp-neon-focus">
            Ordrehistorikk
          </Link>
          <Link href="/admin/agreement" className="lp-btn lp-btn--secondary lp-neon-focus">
            Avtale
          </Link>
          <Link href="/admin/leveringsgrunnlag" className="lp-btn lp-btn--secondary lp-neon-focus">
            Leveringsgrunnlag
          </Link>
          <Link href="/admin/dagens-brukere" className="lp-btn lp-btn--secondary lp-neon-focus">
            Dagens brukere
          </Link>
          <Link href="/admin/dagens-levering" className="lp-btn lp-btn--secondary lp-neon-focus">
            Dagens levering
          </Link>
          <Link href="/admin/history" className="lp-btn lp-btn--secondary lp-neon-focus">
            Aktivitet / historikk
          </Link>
        </div>
      </div>
    </section>
  );
}
