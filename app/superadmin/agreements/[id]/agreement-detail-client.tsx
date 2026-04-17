"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { displayLabelForMealTypeKey } from "@/lib/cms/mealTypeDisplayFallback";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import type { CmsProductPlan } from "@/lib/cms/types";
import { parseMealContractFromAgreementJson } from "@/lib/server/agreements/mealContract";

import { approveAgreement, pauseAgreementLedger, rejectAgreement } from "../actions";
import { REGISTRATION_WEEKDAYS, type WeekdayMealTiers } from "@/lib/registration/weekdayMealTiers";

type AgreementDetailPayload = {
  agreement: {
    id: string;
    company_id: string;
    location_id: string | null;
    status: string;
    tier: string;
    delivery_days: unknown;
    slot_start: string | null;
    slot_end: string | null;
    starts_at: string | null;
    ends_at: string | null;
    binding_months: number | null;
    notice_months: number | null;
    price_per_employee: number | null;
    created_at: string | null;
    updated_at: string | null;
    activated_at: string | null;
    rejection_reason: string | null;
  };
  company_name: string;
  company_status?: string | null;
  agreement_json: unknown;
  locations: { id: string; name: string }[];
  approvalValidity: { ok: true } | { ok: false; code: string; message: string };
  registration_exists?: boolean;
  ledger_pending_agreement_id?: string | null;
  ledger_active_agreement_id?: string | null;
  weekday_meal_tiers?: WeekdayMealTiers | null;
  pipeline_stage_label?: string;
  pipeline_next_label?: string;
  pipeline_next_href?: string;
  pipeline_primary_href?: string;
};

const DAY_LABEL: Record<string, string> = {
  mon: "mandag",
  tue: "tirsdag",
  wed: "onsdag",
  thu: "torsdag",
  fri: "fredag",
};

function tierLabel(t: string) {
  const s = String(t ?? "").toUpperCase();
  if (s === "BASIS") return "Basis";
  if (s === "LUXUS") return "Luxus";
  return s || "-";
}

function companyStatusLabel(raw: string | null | undefined) {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "Aktiv";
  if (s === "PENDING") return "Venter";
  if (s === "PAUSED") return "Pauset";
  if (s === "CLOSED") return "Stengt";
  return s || "—";
}

function companyStatusPillClass(raw: string | null | undefined) {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
  if (s === "PENDING") return "bg-neutral-50 text-neutral-800 ring-1 ring-neutral-200";
  if (s === "PAUSED") return "bg-yellow-50 text-yellow-900 ring-1 ring-yellow-200";
  if (s === "CLOSED") return "bg-red-50 text-red-900 ring-1 ring-red-200";
  return "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200";
}

type Props = {
  detail: AgreementDetailPayload;
  cmsBasis: CmsProductPlan | null;
  cmsLuxus: CmsProductPlan | null;
  menuTitles?: Record<string, string> | null;
};

function mealDisplay(mealKey: string, titles: Record<string, string> | null | undefined) {
  const nk = normalizeMealTypeKey(mealKey);
  const t = nk ? titles?.[nk]?.trim() : "";
  if (t) return t;
  return displayLabelForMealTypeKey(nk || mealKey, null);
}

export default function AgreementDetailClient({ detail, cmsBasis, cmsLuxus, menuTitles = null }: Props) {
  const router = useRouter();
  const {
    agreement,
    company_name: companyName,
    company_status: companyStatus,
    agreement_json: agreementJson,
    locations,
    approvalValidity,
    registration_exists = false,
    ledger_pending_agreement_id = null,
    ledger_active_agreement_id = null,
    weekday_meal_tiers: weekdayMealTiers = null,
    pipeline_stage_label = "—",
    pipeline_next_label = "—",
    pipeline_next_href = "",
    pipeline_primary_href = "",
  } = detail;
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const status = String(agreement.status ?? "").toUpperCase();
  const canApprove = status === "PENDING" && approvalValidity.ok === true;
  const showInvalid = status === "PENDING" && approvalValidity.ok === false;
  const isLedgerPending = !!ledger_pending_agreement_id && agreement.id === ledger_pending_agreement_id;
  const isLedgerActive = !!ledger_active_agreement_id && agreement.id === ledger_active_agreement_id;
  const nextHref = pipeline_next_href || `/superadmin/agreements/${encodeURIComponent(agreement.id)}`;
  const primaryHref =
    pipeline_primary_href || `/superadmin/companies/${encodeURIComponent(agreement.company_id)}`;

  const cmsForTier = agreement.tier === "LUXUS" ? cmsLuxus : cmsBasis;
  const cmsPrice = cmsForTier?.price != null && Number.isFinite(cmsForTier.price) ? cmsForTier.price : null;
  const displayPrice = cmsPrice ?? agreement.price_per_employee;

  const meal = parseMealContractFromAgreementJson(agreementJson);

  async function onApprove() {
    setMsg(null);
    if (!canApprove) return;
    if (!window.confirm("Godkjenn denne avtalen?")) return;
    startTransition(async () => {
      const r = await approveAgreement(agreement.id);
      if (!r.ok) {
        setMsg(r.message);
        return;
      }
      router.refresh();
    });
  }

  async function onReject() {
    setMsg(null);
    if (status !== "PENDING") return;
    if (!window.confirm("Avslå denne avtalen?")) return;
    startTransition(async () => {
      const r = await rejectAgreement(agreement.id, reason);
      if (!r.ok) {
        setMsg(r.message);
        return;
      }
      router.refresh();
    });
  }

  async function onPause() {
    setMsg(null);
    if (status !== "ACTIVE") return;
    if (!window.confirm("Pause denne avtalen?")) return;
    startTransition(async () => {
      const r = await pauseAgreementLedger(agreement.id);
      if (!r.ok) {
        setMsg(r.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-amber-50 text-amber-950 ring-1 ring-amber-200/80 px-4 py-3 text-sm space-y-2">
        <p>
          Superadmin kan ikke fritekst-endre avtalen her – kun eksplisitte ledger-handlinger. «Godkjenn avtale» er publish: avtalen blir ACTIVE via
          canonical RPC; firma kan aktiveres i samme operasjon når databasen krever det (ikke ved utkast-opprettelse).
        </p>
        <p className="text-xs font-medium text-amber-950/90">
          <strong className="font-semibold">Adskilt sannhet:</strong> avtalestatus ligger i <span className="font-mono">public.agreements</span>.
          Firmastatus ligger i <span className="font-mono">companies.status</span> og styres kun via firmastatus-flyten — ikke av avslag eller pause på
          ledger-avtale.
        </p>
      </div>

      {msg ? (
        <div className="rounded-2xl bg-rose-50 text-rose-900 ring-1 ring-rose-200 p-3 text-sm" role="alert">
          {msg}
        </div>
      ) : null}

      {showInvalid ? (
        <div className="rounded-2xl bg-rose-50 text-rose-900 ring-1 ring-rose-200 p-3 text-sm" role="status">
          Avtalen er ugyldig og kan ikke godkjennes
          {approvalValidity.ok === false ? (
            <span className="block mt-1 text-xs opacity-90">{approvalValidity.message}</span>
          ) : null}
        </div>
      ) : null}

      <section className="lp-card lp-card--elevated">
        <div className="lp-card-pad space-y-4">
          <h2 className="text-base font-semibold text-neutral-900">Operativ status (firma · registrering · ledger)</h2>
          <p className="text-xs lp-muted">
            Fra <span className="font-mono">agreements</span>, <span className="font-mono">companies</span> og{" "}
            <span className="font-mono">company_registrations</span>. Firmastatus styrer driftstilgang; avtalestatus styrer kontraktsleddet (samme
            logikk som avtaleliste og firmadetalj).
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Avtale-ID</dt>
              <dd className="mt-1 font-mono text-xs break-all text-neutral-900">{agreement.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Avtalestatus (ledger)</dt>
              <dd className="mt-1 font-medium text-neutral-900">{status}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Firmastatus</dt>
              <dd className="mt-1">
                <span className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", companyStatusPillClass(companyStatus)].join(" ")}>
                  {companyStatusLabel(companyStatus)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Registrering</dt>
              <dd className="mt-1 font-medium text-neutral-900">{registration_exists ? "Ja" : "Nei"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Denne raden = nyeste PENDING (ledger)</dt>
              <dd className="mt-1 font-medium text-neutral-900">{isLedgerPending ? "Ja" : "Nei"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Denne raden = ACTIVE (ledger)</dt>
              <dd className="mt-1 font-medium text-neutral-900">{isLedgerActive ? "Ja" : "Nei"}</dd>
            </div>
          </dl>
          <div className="rounded-2xl bg-neutral-50 ring-1 ring-black/5 px-3 py-3 text-sm">
            <p>
              <span className="text-xs font-semibold text-neutral-600">Operativ fase: </span>
              <span className="text-neutral-900">{pipeline_stage_label}</span>
            </p>
            <p className="mt-2">
              <span className="text-xs font-semibold text-neutral-600">Neste steg: </span>
              <span className="text-neutral-900">{pipeline_next_label}</span>
              {nextHref ? (
                <>
                  {" "}
                  <Link href={nextHref} className="font-medium text-neutral-900 underline underline-offset-2">
                    Åpne
                  </Link>
                </>
              ) : null}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={primaryHref}
                className="inline-flex rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
              >
                Anbefalt neste steg (firma/reg.) →
              </Link>
              <Link
                href={`/superadmin/companies/${encodeURIComponent(agreement.company_id)}`}
                className="inline-flex rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
              >
                Firmaside →
              </Link>
              {registration_exists ? (
                <Link
                  href={`/superadmin/registrations/${encodeURIComponent(agreement.company_id)}`}
                  className="inline-flex rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                >
                  Registrering →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="lp-card lp-card--elevated">
        <div className="lp-card-pad space-y-4">
          <h2 className="text-base font-semibold text-neutral-900">Dagmap (Basis/Luxus man–fre)</h2>
          <p className="text-xs lp-muted">
            Operativt grunnlag fra <span className="font-mono">company_registrations.weekday_meal_tiers</span> (canonical daymap for bestilling).
          </p>
          {weekdayMealTiers ? (
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {REGISTRATION_WEEKDAYS.map((d) => (
                <li
                  key={d}
                  className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2 ring-1 ring-black/5"
                >
                  <span className="font-medium capitalize text-neutral-800">{DAY_LABEL[d] ?? d}</span>
                  <span className="text-neutral-900">{tierLabel(weekdayMealTiers[d])}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm lp-muted">Ingen komplett ukedagsplan i registrering (opprett/oppdater via canonical registrering).</p>
          )}
        </div>
      </section>

      <section className="lp-card lp-card--elevated">
        <div className="lp-card-pad space-y-6">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Avtaledata (skrivebeskyttet)</h2>
            <p className="mt-1 text-sm lp-muted">
              {companyName} · <span className="break-all">{agreement.company_id}</span>
            </p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Plan</dt>
              <dd className="mt-1 font-medium text-neutral-900">{tierLabel(agreement.tier)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Pris (CMS hvis tilgjengelig)</dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {displayPrice != null ? `${displayPrice} kr (ex. mva)` : "—"}
                {cmsPrice == null && agreement.price_per_employee != null ? (
                  <span className="block text-xs lp-muted mt-0.5">Lagret pris: {agreement.price_per_employee}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Status</dt>
              <dd className="mt-1 font-medium text-neutral-900">{status}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Leveringsvindu</dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {agreement.slot_start && agreement.slot_end ? `${agreement.slot_start}–${agreement.slot_end}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Leveringsdager</dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {Array.isArray(agreement.delivery_days) && agreement.delivery_days.length
                  ? (agreement.delivery_days as string[]).join(", ")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Start / slutt</dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {agreement.starts_at ?? "—"} → {agreement.ends_at ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Opprettet</dt>
              <dd className="mt-1 font-medium text-neutral-900">{agreement.created_at ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500">Aktivert</dt>
              <dd className="mt-1 font-medium text-neutral-900">{agreement.activated_at ?? "—"}</dd>
            </div>
            {agreement.rejection_reason ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold text-neutral-500">Avslagsårsak (lagret)</dt>
                <dd className="mt-1 text-neutral-900 whitespace-pre-wrap">{agreement.rejection_reason}</dd>
              </div>
            ) : null}
          </dl>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Meny</h3>
            <div className="mt-2 rounded-2xl bg-neutral-50 ring-1 ring-black/5 p-4 text-sm">
              {!meal ? (
                <p className="lp-muted">Ingen gyldig meal_contract i firmaets agreement_json.</p>
              ) : meal.plan === "basis" ? (
                <p>
                  <span className="font-medium text-neutral-900">Samme meny hver dag:</span>{" "}
                  <span className="text-neutral-800">{mealDisplay(meal.fixed_meal_type, menuTitles)}</span>
                </p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(meal.menu_per_day)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([day, mealType]) => (
                      <li key={day}>
                        <span className="font-medium capitalize">{DAY_LABEL[day] ?? day}:</span>{" "}
                        {mealDisplay(String(mealType), menuTitles)}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Lokasjoner</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {locations.length === 0 ? (
                <li className="lp-muted">Ingen lokasjoner registrert.</li>
              ) : (
                locations.map((l) => (
                  <li key={l.id}>
                    {l.name} <span className="text-xs lp-muted break-all">({l.id})</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-2xl bg-neutral-50 ring-1 ring-black/5 px-3 py-3 text-xs text-neutral-800 space-y-2">
            <div className="font-semibold text-neutral-900">Ledger-handlinger (server-side RPC)</div>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <span className="font-medium">Avslå (PENDING):</span> <span className="font-mono">lp_agreement_reject_pending</span> →{" "}
                <span className="font-mono">REJECTED</span>. Endrer ikke <span className="font-mono">companies.status</span>.
              </li>
              <li>
                <span className="font-medium">Pause (ACTIVE):</span> <span className="font-mono">lp_agreement_pause_ledger_active</span> →{" "}
                <span className="font-mono">PAUSED</span>. Endrer ikke <span className="font-mono">companies.status</span>.
              </li>
              <li>
                <span className="font-medium">Gjenoppta ledger:</span> ingen canonical RPC i migrasjoner for{" "}
                <span className="font-mono">public.agreements</span> — visning og sporbarhet kun.
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap pt-2 border-t border-black/5">
            {status === "PENDING" ? (
              <>
                <button
                  type="button"
                  disabled={pending || !canApprove}
                  onClick={() => void onApprove()}
                  className="lp-btn lp-btn--primary disabled:opacity-50 disabled:pointer-events-none"
                >
                  Godkjenn avtale
                </button>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end flex-1 min-w-[200px]">
                  <label className="text-sm flex-1">
                    <span className="text-xs font-semibold text-neutral-600">Begrunnelse (valgfritt ved avslag)</span>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      readOnly={pending}
                      className="mt-1 w-full rounded-xl px-3 py-2 text-sm ring-1 ring-black/10 bg-white/70"
                    />
                  </label>
                  <button type="button" disabled={pending} onClick={() => void onReject()} className="lp-btn lp-btn--secondary">
                    Avslå avtale (ledger)
                  </button>
                </div>
              </>
            ) : null}

            {status === "ACTIVE" ? (
              <button type="button" disabled={pending} onClick={() => void onPause()} className="lp-btn lp-btn--secondary">
                Pause ledger-avtale
              </button>
            ) : null}

            {status === "PAUSED" ? (
              <p className="text-sm text-neutral-700">
                Denne avtalen er <span className="font-semibold">PAUSED</span> i ledger. Migrasjonene definerer ikke gjenopptaks-RPC for{" "}
                <span className="font-mono">public.agreements</span> — kun innsyn og sporbarhet herfra.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
