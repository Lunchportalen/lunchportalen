// app/superadmin/registrations/[companyId]/page.tsx — én firmaregistrering (lesing)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateTimeNO } from "@/lib/date/format";
import {
  deriveSuperadminRegistrationPipelineNext,
  loadCompanyRegistrationDetail,
  type CompanyRegistrationDetail,
} from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";

import CreateAgreementDraftButton from "./CreateAgreementDraftButton";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function companyStatusLabel(raw: string | null) {
  const s = safeStr(raw).toUpperCase();
  if (s === "ACTIVE") return "Aktiv";
  if (s === "PENDING") return "Venter";
  if (s === "PAUSED") return "Pauset";
  if (s === "CLOSED") return "Stengt";
  return s || "—";
}

function statusPillClass(raw: string | null) {
  const s = safeStr(raw).toUpperCase();
  if (s === "ACTIVE") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
  if (s === "PENDING") return "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200";
  if (s === "PAUSED") return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
  if (s === "CLOSED") return "bg-red-50 text-red-800 ring-1 ring-red-200";
  return "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200";
}

function fmtTs(ts: string | null | undefined) {
  if (!ts) return "—";
  try {
    return formatDateTimeNO(ts);
  } catch {
    return ts;
  }
}

export default async function SuperadminRegistrationDetailPage(props: { params: { companyId: string } | Promise<{ companyId: string }> }) {
  const p = await props.params;
  const companyId = safeStr(p?.companyId);
  if (!companyId) notFound();

  const bundle = await loadCompanyRegistrationDetail(companyId);
  if (bundle.ok === true) {
    const r = bundle.item;
    return <RegistrationDetailView r={r} />;
  }

  if ("notFound" in bundle && bundle.notFound) {
    notFound();
  }

  return (
    <main className="lp-select-text mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-red-700">{"message" in bundle ? bundle.message : "Kunne ikke laste registrering."}</p>
      <Link href="/superadmin/registrations" className="mt-4 inline-block text-sm underline">
        Tilbake til innboks
      </Link>
    </main>
  );
}

function RegistrationDetailView({ r }: { r: CompanyRegistrationDetail }) {
  const pipe = deriveSuperadminRegistrationPipelineNext({
    company_status: r.company_status,
    ledger_pending_agreement_id: r.ledger_pending_agreement_id,
    ledger_active_agreement_id: r.ledger_active_agreement_id,
  });
  const closed = safeStr(r.company_status).toUpperCase() === "CLOSED";
  const showDraftBtn = !closed && !r.ledger_pending_agreement_id && !r.ledger_active_agreement_id;

  return (
    <main className="lp-select-text mx-auto max-w-3xl px-4 py-8">
      <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin / Registreringer</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Registreringsdetalj</h1>
      <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
        Operativ rad i <code className="rounded bg-white/80 px-1 text-xs">company_registrations</code> for firma-ID{" "}
        <span className="font-mono text-xs">{r.company_id}</span>. Kun lesing.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/superadmin/registrations" className="inline-flex rounded-2xl border bg-white px-3 py-2 text-sm hover:bg-neutral-50">
          ← Innboks
        </Link>
        <Link
          href={`/superadmin/companies/${encodeURIComponent(r.company_id)}`}
          className="inline-flex rounded-2xl border bg-white px-3 py-2 text-sm hover:bg-neutral-50"
        >
          Firmaside →
        </Link>
      </div>

      <section className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <h2 className="text-sm font-semibold text-neutral-900">Superadmin-status (registrering → avtale → drift)</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Lesning fra <span className="font-mono">company_registrations</span>, <span className="font-mono">agreements</span> og{" "}
          <span className="font-mono">companies.status</span>. Ingen ny arbeidsflyt — kun oversikt.
        </p>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Registrering</dt>
            <dd className="font-medium">Finnes (denne visningen)</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Ledger-avtaleutkast (PENDING)</dt>
            <dd className="font-medium">{r.ledger_pending_agreement_id ? "Ja" : "Nei"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Aktiv ledger-avtale (ACTIVE)</dt>
            <dd className="font-medium">{r.ledger_active_agreement_id ? "Ja" : "Nei"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Firmastatus</dt>
            <dd>
              <span className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusPillClass(r.company_status)].join(" ")}>
                {companyStatusLabel(r.company_status)}
              </span>
            </dd>
          </div>
        </dl>
        <div className="mt-4 rounded-2xl bg-neutral-50/90 px-3 py-3 text-sm ring-1 ring-black/5">
          <p>
            <span className="text-xs font-semibold text-neutral-600">Fase: </span>
            <span className="text-neutral-900">{pipe.stage_label}</span>
          </p>
          <p className="mt-2">
            <span className="text-xs font-semibold text-neutral-600">Neste steg: </span>
            <span className="text-neutral-900">{pipe.next_label}</span>
            {pipe.next_href ? (
              <>
                {" "}
                <Link href={pipe.next_href} className="font-medium text-neutral-900 underline underline-offset-2">
                  Åpne
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </section>

      {showDraftBtn ? <CreateAgreementDraftButton companyId={r.company_id} /> : null}
      {!closed && r.ledger_pending_agreement_id ? (
        <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
          Avtaleutkast finnes allerede. «Opprett avtaleutkast» er skjult til PENDING er ferdigbehandlet (godkjent eller avslått).
        </p>
      ) : null}
      {!closed && !r.ledger_pending_agreement_id && r.ledger_active_agreement_id ? (
        <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
          Aktiv ledger-avtale finnes. Nytt utkast fra denne siden vises ikke — bruk avtaleflyten ved behov.
        </p>
      ) : null}

      <section className="mt-8 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <h2 className="text-sm font-semibold">Firma</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Navn</dt>
            <dd className="font-medium">{r.company_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Org.nr</dt>
            <dd>{r.company_orgnr || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Firmastatus</dt>
            <dd>
              <span className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusPillClass(r.company_status)].join(" ")}>
                {companyStatusLabel(r.company_status)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Firma opprettet</dt>
            <dd>{fmtTs(r.company_created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Firma sist endret</dt>
            <dd>{fmtTs(r.company_updated_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <h2 className="text-sm font-semibold">Kontakt og størrelse</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Kontaktperson</dt>
            <dd className="font-medium">{r.contact_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">E-post</dt>
            <dd className="break-all">{r.contact_email}</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Telefon</dt>
            <dd>{r.contact_phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Antall ansatte (registrert)</dt>
            <dd className="tabular-nums">{r.employee_count}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <h2 className="text-sm font-semibold">Adresse</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Gate / linje</dt>
            <dd>{r.address_line}</dd>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <dt className="text-xs text-[rgb(var(--lp-muted))]">Postnummer</dt>
              <dd>{r.postal_code}</dd>
            </div>
            <div>
              <dt className="text-xs text-[rgb(var(--lp-muted))]">Poststed</dt>
              <dd>{r.city}</dd>
            </div>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <h2 className="text-sm font-semibold">Tidsstempler (registrering)</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Registrering opprettet</dt>
            <dd>{fmtTs(r.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--lp-muted))]">Registrering sist endret</dt>
            <dd>{fmtTs(r.updated_at)}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
