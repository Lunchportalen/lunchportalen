export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import TripletexSubNav from "@/components/superadmin/tripletex/TripletexSubNav";
import {
  listProviderTripletexSync,
  loadTripletexOverviewStats,
} from "@/lib/superadmin/tripletexAdminData";

export default async function SuperadminTripletexPage() {
  const [stats, syncRows] = await Promise.all([loadTripletexOverviewStats(), listProviderTripletexSync(30)]);

  const cards = [
    { label: "Leverandører", value: stats.activeProviders, href: "/superadmin/providers" },
    { label: "Tripletex-mapping", value: stats.tripletexMappedProviders, href: "/superadmin/tripletex/invoices" },
    { label: "Outbox PENDING", value: stats.outboxPending, href: "/superadmin/tripletex/queue?status=PENDING" },
    { label: "Outbox FAILED", value: stats.outboxFailed, href: "/superadmin/tripletex/queue?status=FAILED" },
    { label: "Fakturaer PAID", value: stats.invoicesPaid, href: "/superadmin/tripletex/invoices?status=PAID" },
    { label: "Webhooks FAILED", value: stats.webhooksFailed, href: "/superadmin/tripletex/webhooks?status=FAILED" },
  ];

  return (
    <div className="lp-select-text mx-auto max-w-6xl">
      <header className="text-center sm:text-left">
        <p className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Tripletex</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Flow A — SaaS-fakturaer, outbox, webhooks og sync-status.
        </p>
      </header>

      <div className="mt-6">
        <TripletexSubNav activePath="/superadmin/tripletex" />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="ds-card block rounded-[var(--ds-radius-md)] p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
            <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">{card.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{card.value}</p>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Sync-status per leverandør</h2>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Tripletex customer-mapping (Flow A).</p>

        <div className="mt-4 hidden overflow-x-auto rounded-2xl border bg-white md:block">
          <table className="lp-table min-w-full text-sm">
            <thead>
              <tr>
                <th>Leverandør</th>
                <th>Slug</th>
                <th>Tripletex customer</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {syncRows.map((row) => (
                <tr key={row.provider_id}>
                  <td className="font-medium">{row.provider_name}</td>
                  <td className="font-mono text-xs">{row.provider_slug}</td>
                  <td>{row.tripletex_customer_id ?? "—"}</td>
                  <td className="text-right">
                    <Link
                      href={`/superadmin/providers/${row.provider_id}/billing`}
                      className="ds-btn ds-btn--secondary min-h-[48px]"
                    >
                      Billing
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="mt-4 grid gap-3 md:hidden">
          {syncRows.map((row) => (
            <li key={row.provider_id} className="ds-card rounded-[var(--ds-radius-md)] p-4 text-center">
              <p className="font-semibold">{row.provider_name}</p>
              <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{row.provider_slug}</p>
              <p className="mt-2 text-sm">{row.has_mapping ? row.tripletex_customer_id : "Ingen mapping"}</p>
              <Link
                href={`/superadmin/providers/${row.provider_id}/billing`}
                className="ds-btn ds-btn--secondary mt-4 inline-flex min-h-[48px] items-center"
              >
                Billing
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
