/**
 * Phase 16NO.4 — Norway MVA threshold owner panel (superadmin only).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { requireSuperadmin } from "@/lib/superadmin/auth";
import {
  buildNorwayMvaDashboard,
  isNorwayMvaControllerEnabled,
} from "@/lib/markets/norwayMvaController";
import { NORWAY_MVA_THRESHOLD_MINOR } from "@/lib/markets/norwayMvaTurnover";
import Link from "next/link";

function nok(minor: string | number | bigint): string {
  const n = typeof minor === "bigint" ? Number(minor) : Number(minor);
  return new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    n / 100,
  );
}

export default async function NorwayMvaThresholdPage() {
  await requireSuperadmin();

  let dash: Awaited<ReturnType<typeof buildNorwayMvaDashboard>> | null = null;
  let controllerEnabled = false;
  let loadError: string | null = null;
  try {
    controllerEnabled = await isNorwayMvaControllerEnabled();
    dash = await buildNorwayMvaDashboard();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "LOAD_FAILED";
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-[27px]">
      <h1 className="text-2xl font-semibold tracking-tight">Norge MVA-terskel</h1>
      <p className="mt-2 max-w-3xl text-sm text-neutral-600">
        Automatisk kontroll av Lunchportalen AS sin avgiftspliktige omsetning (rullerende 12 måneder).
        Terskel {nok(NORWAY_MVA_THRESHOLD_MINOR)} NOK. Sammenligning: strengt større enn.
      </p>

      {loadError ? (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Kunne ikke laste terskelstatus ({loadError}). Kontroller at migrasjon er anvendt.
        </p>
      ) : null}

      {dash ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Offisiell status
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>MVA-registrert</dt>
                <dd className="font-medium">{dash.mvaRegistered ? "JA" : "NEI"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>25 % MVA aktiv</dt>
                <dd className="font-medium">{dash.vat25Eligible ? "JA" : "NEI"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Sist sjekket</dt>
                <dd className="font-medium">{dash.officialCheck.checkedAt ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Kilde</dt>
                <dd className="font-medium">{dash.officialCheck.source ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Kontroller</dt>
                <dd className="font-medium">{controllerEnabled ? "AKTIV" : "INAKTIV"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Omsetning</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Gjenkjent (rullerende 12 mnd)</dt>
                <dd className="font-medium">{nok(dash.recognizedTaxableTurnoverMinor)} NOK</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Fakturert provisjon</dt>
                <dd className="font-medium">{nok(dash.invoicedCommissionTurnoverMinor)} NOK</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Gjenkjent ikke fakturert</dt>
                <dd className="font-medium">{nok(dash.recognizedButUninvoicedMinor)} NOK</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Holdt pendent registrering</dt>
                <dd className="font-medium">{nok(dash.heldPendingRegistrationMinor)} NOK</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Gjenstår til terskel</dt>
                <dd className="font-medium">{nok(dash.remainingMinor)} NOK</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Andel av terskel</dt>
                <dd className="font-medium">{(dash.percentOfThresholdBps / 100).toFixed(2)} %</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Prognose og faktura
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Status</dt>
                <dd className="font-medium">{dash.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Varselbånd</dt>
                <dd className="font-medium">{dash.warningBand}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Transmisjon</dt>
                <dd className="font-medium">{dash.invoiceTransmission}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Crossing-policy</dt>
                <dd className="font-medium">{dash.crossingPolicy}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Crossing event</dt>
                <dd className="max-w-[12rem] truncate font-medium">
                  {dash.crossingEventId ?? "—"}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}

      {dash ? (
        <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Eierhandling</h2>
          <p className="mt-2 text-sm text-neutral-600">
            {!dash.mvaRegistered &&
            (dash.status === "CROSSING_EVENT_DETECTED" ||
              dash.status === "REGISTRATION_REQUIRED" ||
              dash.status === "REGISTRATION_PENDING")
              ? "MVA_REGISTRATION_OWNER_ACTION_REQUIRED — registrer Lunchportalen AS i Merverdiavgiftsregisteret. Systemet sender ikke søknad automatisk."
              : dash.mvaRegistered
                ? "Offisiell registrering er bekreftet. 25 % MVA kan aktiveres for plattformprovisjon."
                : "Ingen eierhandling kreves før terskel krysses. Forhåndsvarsler vises når omsetningen nærmer seg 50 000 NOK."}
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            Checksum: {dash.calculationChecksum} · Org.nr {dash.orgnr} · Vindu{" "}
            {dash.windowStart.slice(0, 10)} → {dash.windowEnd.slice(0, 10)}
          </p>
          <p className="mt-4 text-sm">
            <Link href="/superadmin/provisjon" className="text-[var(--lp-hot-pink,#e91e8c)] underline-offset-2 hover:underline">
              Åpne plattformprovisjon
            </Link>
            {" · "}
            <Link href="/superadmin/legal/norway" className="text-[var(--lp-hot-pink,#e91e8c)] underline-offset-2 hover:underline">
              Norske vilkår
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}
