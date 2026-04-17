import Link from "next/link";

import type { AgreementPageData, DayKey } from "@/lib/admin/agreement/types";
import { formatDateNO, formatDateTimeNO } from "@/lib/date/format";
import type { CompanyOperationalBrief } from "@/lib/server/admin/loadCompanyOperationalBrief";

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Mandag",
  tue: "Tirsdag",
  wed: "Onsdag",
  thu: "Torsdag",
  fri: "Fredag",
};

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

function agreementStatusNb(s: AgreementPageData["status"]) {
  if (s === "ACTIVE") return "Aktiv avtale (snapshot)";
  if (s === "PAUSED") return "Avtale pauset";
  if (s === "CLOSED") return "Avtale avsluttet";
  if (s === "MISSING_AGREEMENT") return "Ingen aktiv avtale i snapshot";
  return "Firma ikke aktivt for avtalevisning";
}

export default function AgreementDeliveryBasisView({
  brief,
  agreement,
}: {
  brief: CompanyOperationalBrief;
  agreement: AgreementPageData | null;
}) {
  return (
    <div className="grid gap-6">
      <section className="lp-card lp-card--elevated">
        <div className="lp-card-pad">
          <h2 className="text-sm font-semibold text-neutral-900">Status · {formatDateNO(brief.today_iso)}</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Read-only innsyn i operativt leveringsgrunnlag. Samme kilder som avtale-API og firmadagens drift — uten pris, binding eller superadmin-felt.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill label={brief.company_status_upper} />
            <BookingPill booking={brief.booking_today} />
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
                {agreement ? <span className="text-neutral-600">· {agreementStatusNb(agreement.status)}</span> : null}
              </dd>
            </div>
            <div className="rounded-2xl bg-neutral-50/80 p-3 ring-1 ring-black/5 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Leveringsvindu (ledger)</dt>
              <dd className="mt-1 text-neutral-900">{brief.ledger_delivery_window_nb ?? "—"}</dd>
              <dd className="mt-1 text-xs text-neutral-600">
                Cut-off for bestilling samme dag: kl. 08:00 (Europe/Oslo). Status nå:{" "}
                <span className="font-mono">{brief.cutoff_today}</span>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="lp-card lp-card--elevated">
        <div className="lp-card-pad">
          <h2 className="text-sm font-semibold text-neutral-900">Dag-for-dag (Basis / Luxus)</h2>
          <p className="mt-1 text-xs text-neutral-600">Kilde: v_company_current_agreement_daymap + avtaleleveringsdager (samme som /api/admin/agreement).</p>
          {agreement ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {DAY_KEYS.map((dayKey) => {
                const day = agreement.weekPlan.find((d) => d.dayKey === dayKey);
                const active = Boolean(day?.active);
                return (
                  <div
                    key={dayKey}
                    className={cx(
                      "rounded-2xl border border-black/10 bg-white/90 px-3 py-3 text-sm",
                      active ? "" : "opacity-75",
                    )}
                  >
                    <div className="font-semibold text-neutral-900">{DAY_LABELS[dayKey]}</div>
                    <div className="mt-1 text-xs text-neutral-600">{active ? "Aktiv dag" : "Ikke aktiv"}</div>
                    <div className="mt-1 text-xs font-medium text-neutral-800">
                      {day?.tier ? (day.tier === "LUXUS" ? "Luxus" : "Basis") : "—"}
                    </div>
                    {!active && day?.reasonIfInactive ? (
                      <div className="mt-1 text-[11px] text-neutral-600">{day.reasonIfInactive}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-600">Kunne ikke hente ukeskjema — se operative dager i daymap under.</p>
          )}
          <div className="mt-4 rounded-2xl bg-neutral-50/80 p-3 text-sm text-neutral-800 ring-1 ring-black/5">
            <span className="font-semibold">Operative leveringsdager (daymap): </span>
            {brief.operative_days_label_nb}
          </div>
        </div>
      </section>

      <section className="lp-card lp-card--elevated">
        <div className="lp-card-pad">
          <h2 className="text-sm font-semibold text-neutral-900">Bestilling / uke</h2>
          <p className="mt-1 text-sm text-neutral-700">{brief.week_visibility_summary_nb}</p>
          {agreement?.updatedAt ? (
            <p className="mt-2 text-xs text-neutral-600">Avtaledata sist oppdatert: {formatDateTimeNO(agreement.updatedAt)}</p>
          ) : null}
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Forklaring (bestilling i dag)</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800">
              {brief.booking_detail_lines_nb.map((line, i) => (
                <li key={`b-${i}`}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="lp-card lp-card--elevated">
        <div className="lp-card-pad">
          <h2 className="text-sm font-semibold text-neutral-900">Videre</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/week" className="lp-btn lp-btn--secondary lp-neon-focus">
              Ukeplan (/week)
            </Link>
            <Link href="/admin/orders" className="lp-btn lp-btn--secondary lp-neon-focus">
              Ordrehistorikk
            </Link>
            <Link href="/admin#firma-operativt" className="lp-btn lp-btn--secondary lp-neon-focus">
              Firmadagens drift
            </Link>
            <Link href="/admin/agreement" className="lp-btn lp-btn--secondary lp-neon-focus">
              Full avtalevisning
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
