// app/superadmin/registrations/page.tsx — innboks nye firmaregistreringer (lesing)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";

import { formatDateTimeNO } from "@/lib/date/format";
import { loadCompanyRegistrationsInbox } from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";

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

export default async function SuperadminRegistrationsInboxPage() {
  const bundle = await loadCompanyRegistrationsInbox();

  return (
    <main className="lp-select-text mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Registreringsinnboks</h1>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Operativ liste fra <code className="rounded bg-white/80 px-1 text-xs">company_registrations</code>, firmastatus fra{" "}
            <code className="rounded bg-white/80 px-1 text-xs">companies</code> og ledger-status fra{" "}
            <code className="rounded bg-white/80 px-1 text-xs">agreements</code>. Rader sorteres etter handlingsprioritet (ventende utkast
            først, deretter manglende utkast). Kun lesing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/superadmin/companies"
            className="inline-flex rounded-2xl border bg-white px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Til firma
          </Link>
          <Link href="/superadmin" className="inline-flex rounded-2xl border bg-white px-3 py-2 text-sm hover:bg-neutral-50">
            Kontrollsenter
          </Link>
        </div>
      </header>

      {bundle.ok === false ? (
        <section className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold text-red-700">Kunne ikke laste innboks</div>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{bundle.message}</p>
        </section>
      ) : bundle.items.length === 0 ? (
        <section className="mt-6 rounded-3xl bg-white/70 p-8 text-center ring-1 ring-[rgb(var(--lp-border))]">
          <p className="text-sm font-medium text-[rgb(var(--lp-fg))]">Ingen registreringer i innboksen.</p>
          <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Nye registreringer vises her når de er lagret i databasen.</p>
        </section>
      ) : (
        <section className="mt-6 overflow-x-auto rounded-3xl bg-white/70 ring-1 ring-[rgb(var(--lp-border))]">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-[rgb(var(--lp-border))] bg-white/70 text-xs text-[rgb(var(--lp-muted))]">
              <tr>
                <th className="px-4 py-3 font-medium">Firma</th>
                <th className="px-4 py-3 font-medium">Firmastatus</th>
                <th className="px-4 py-3 font-medium max-w-[200px]">Pipeline (ledger)</th>
                <th className="px-4 py-3 font-medium">Kontakt</th>
                <th className="px-4 py-3 font-medium">E-post</th>
                <th className="px-4 py-3 font-medium">Telefon</th>
                <th className="px-4 py-3 font-medium">Ansatte</th>
                <th className="px-4 py-3 font-medium">Opprettet</th>
                <th className="px-4 py-3 font-medium text-right">Handling</th>
              </tr>
            </thead>
            <tbody>
              {bundle.items.map((r, idx) => {
                const st = r.company_status;
                const created = r.created_at
                  ? (() => {
                      try {
                        return formatDateTimeNO(r.created_at);
                      } catch {
                        return r.created_at;
                      }
                    })()
                  : "—";
                return (
                  <tr key={r.company_id} className={idx % 2 === 0 ? "bg-white/40" : "bg-white/20"}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.company_name || "—"}</div>
                      <div className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
                        Org.nr {r.company_orgnr || "—"} · ID {r.company_id}
                      </div>
                      <div className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
                        {r.postal_code} {r.city} · {r.address_line}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusPillClass(st)].join(" ")}
                      >
                        {companyStatusLabel(st)}
                      </span>
                    </td>
                    <td className="max-w-[200px] px-4 py-3 align-top text-xs leading-snug text-neutral-800">
                      <div className="space-y-1">
                        <div>
                          Registrering: <span className="font-semibold tabular-nums">Ja</span>
                        </div>
                        <div>
                          Utkast (PENDING):{" "}
                          <span className="font-semibold tabular-nums">{r.ledger_pending_agreement_id ? "Ja" : "Nei"}</span>
                        </div>
                        <div>
                          Aktiv (ACTIVE):{" "}
                          <span className="font-semibold tabular-nums">{r.ledger_active_agreement_id ? "Ja" : "Nei"}</span>
                        </div>
                        <div className="pt-0.5 text-[11px] text-neutral-700">
                          <span className="font-semibold text-neutral-600">Fase: </span>
                          {r.pipeline_stage_label}
                        </div>
                        <div className="text-[11px] text-neutral-700">
                          <span className="font-semibold text-neutral-600">Neste: </span>
                          {r.pipeline_next_label}
                        </div>
                        <div className="pt-1">
                          <Link
                            href={r.pipeline_primary_href}
                            className="inline-flex rounded-xl border bg-white px-2 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                          >
                            Åpne anbefalt steg →
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.contact_name}</td>
                    <td className="px-4 py-3 break-all">{r.contact_email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.contact_phone}</td>
                    <td className="px-4 py-3 tabular-nums">{r.employee_count}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">{created}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <Link
                          href={`/superadmin/registrations/${encodeURIComponent(r.company_id)}`}
                          className="inline-flex rounded-xl border bg-white px-2 py-1 text-xs font-semibold hover:bg-neutral-50"
                        >
                          Registrering →
                        </Link>
                        <Link
                          href={`/superadmin/companies/${encodeURIComponent(r.company_id)}`}
                          className="inline-flex rounded-xl border bg-white px-2 py-1 text-xs font-semibold hover:bg-neutral-50"
                        >
                          Firmaside →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
