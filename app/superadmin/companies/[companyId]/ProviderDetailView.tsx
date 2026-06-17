import Link from "next/link";

import { formatDateTimeNO } from "@/lib/date/format";
import type { SuperadminProviderDetail } from "@/lib/server/superadmin/loadSuperadminProviderDetail";

function statusLabel(status: string) {
  if (status === "active") return "Aktiv";
  if (status === "paused") return "Pauset";
  if (status === "closed") return "Stengt";
  return "Venter";
}

function statusPill(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
  if (status === "paused") return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
  if (status === "closed") return "bg-red-50 text-red-800 ring-1 ring-red-200";
  return "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200";
}

function fmtTs(ts?: string | null) {
  if (!ts) return "—";
  try {
    return formatDateTimeNO(ts);
  } catch {
    return ts;
  }
}

export default function ProviderDetailView(props: { data: SuperadminProviderDetail }) {
  const { provider, customers } = props.data;

  return (
    <div className="lp-select-text mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin / Cateringfirma</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{provider.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[rgb(var(--lp-muted))]">
            <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
              Org.nr: {provider.orgnr ?? "—"}
            </span>
            <span className={["inline-flex rounded-full px-3 py-1 text-xs", statusPill(provider.status)].join(" ")}>
              {statusLabel(provider.status)}
            </span>
          </div>
        </div>

        <Link
          href="/superadmin/companies"
          className="inline-flex rounded-2xl border bg-white px-4 py-2 text-sm hover:bg-neutral-50"
        >
          Til leverandøroversikt
        </Link>
      </header>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Kunder</div>
          <div className="mt-2 text-2xl font-semibold">{customers.length}</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Lunsjkunder under dette cateringfirmaet</div>
        </div>
        <div className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Aktive avtaler</div>
          <div className="mt-2 text-2xl font-semibold">{customers.filter((c) => c.activeAgreement).length}</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Kunder med ACTIVE avtale</div>
        </div>
        <div className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Sist endret</div>
          <div className="mt-2 text-lg font-semibold">{fmtTs(provider.updatedAt)}</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Kontakt: {provider.contactEmail ?? "—"}</div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <h2 className="text-sm font-semibold text-neutral-900">Kunder</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Lunsjkunder koblet via <span className="font-mono">companies.provider_id</span>. Systemorganisasjoner som Lunchportalen
          vises ikke her.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-[rgb(var(--lp-muted))]">
              <tr className="border-b border-[rgb(var(--lp-border))]">
                <th className="px-4 py-2">Firma</th>
                <th className="px-4 py-2">Org.nr</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Avtale</th>
                <th className="px-4 py-2">Sist endret</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-sm text-[rgb(var(--lp-muted))]">
                    Ingen kunder funnet for dette cateringfirmaet.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="border-b border-[rgb(var(--lp-border))] last:border-b-0">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 tabular-nums">{c.orgnr ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={["inline-flex rounded-full px-2.5 py-1 text-xs", statusPill(c.status)].join(" ")}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{c.activeAgreement ? "Aktiv" : "—"}</td>
                    <td className="px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">{fmtTs(c.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/superadmin/companies/${encodeURIComponent(c.id)}`}
                        className="rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                      >
                        Åpne kunde
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Leverandør-ID</div>
        <div className="mt-2 font-mono text-xs text-[rgb(var(--lp-muted))]">{provider.id}</div>
      </section>
    </div>
  );
}
