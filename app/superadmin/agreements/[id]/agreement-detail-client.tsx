"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { displayLabelForMealTypeKey } from "@/lib/cms/mealTypeDisplayFallback";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import type { CmsProductPlan } from "@/lib/cms/types";
import { parseMealContractFromAgreementJson } from "@/lib/server/agreements/mealContract";

import { approveAgreement, pauseAgreementLedger, rejectAgreement } from "../actions";

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
  agreement_json: unknown;
  locations: { id: string; name: string }[];
  approvalValidity: { ok: true } | { ok: false; code: string; message: string };
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
  const { agreement, company_name: companyName, agreement_json: agreementJson, locations, approvalValidity } = detail;
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const status = String(agreement.status ?? "").toUpperCase();
  const canApprove = status === "PENDING" && approvalValidity.ok === true;
  const showInvalid = status === "PENDING" && approvalValidity.ok === false;

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
      <div className="rounded-2xl bg-amber-50 text-amber-950 ring-1 ring-amber-200/80 px-4 py-3 text-sm">
        Superadmin kan ikke endre avtalen – kun godkjenne eller avslå.
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
                    <span className="text-xs font-semibold text-neutral-600">Begrunnelse (valgfritt)</span>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      readOnly={pending}
                      className="mt-1 w-full rounded-xl px-3 py-2 text-sm ring-1 ring-black/10 bg-white/70"
                    />
                  </label>
                  <button type="button" disabled={pending} onClick={() => void onReject()} className="lp-btn lp-btn--secondary">
                    Avslå avtale
                  </button>
                </div>
              </>
            ) : null}

            {status === "ACTIVE" ? (
              <button type="button" disabled={pending} onClick={() => void onPause()} className="lp-btn lp-btn--secondary">
                Pause avtale
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
