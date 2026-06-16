export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import TripletexSubNav from "@/components/superadmin/tripletex/TripletexSubNav";
import {
  SuperadminHero,
  SuperadminMetricRow,
  SuperadminPageShell,
  SuperadminSection,
  SuperadminTableSurface,
} from "@/components/superadmin/shell/SuperadminShell";
import {
  listProviderTripletexSync,
  loadTripletexOverviewStats,
} from "@/lib/superadmin/tripletexAdminData";

export default async function SuperadminTripletexPage() {
  const [stats, syncRows] = await Promise.all([loadTripletexOverviewStats(), listProviderTripletexSync(30)]);

  const needsAttention = stats.outboxFailed + stats.webhooksFailed;

  return (
    <SuperadminPageShell>
      <SuperadminHero
        variant="command"
        eyebrow="Superadmin"
        title="Tripletex"
        lead="Økonomi- og sync-kontroll — Flow A fakturaer, outbox, webhooks og leverandør-mapping."
      />

      <SuperadminMetricRow
        metrics={[
          {
            label: "Outbox PENDING",
            value: stats.outboxPending,
            href: "/superadmin/tripletex/queue?status=PENDING",
            attention: stats.outboxPending > 0,
          },
          {
            label: "Outbox FAILED",
            value: stats.outboxFailed,
            href: "/superadmin/tripletex/queue?status=FAILED",
            attention: stats.outboxFailed > 0,
            valueClassName: stats.outboxFailed > 0 ? "text-rose-700" : "",
          },
          {
            label: "Webhooks FAILED",
            value: stats.webhooksFailed,
            href: "/superadmin/tripletex/webhooks?status=FAILED",
            attention: stats.webhooksFailed > 0,
            valueClassName: stats.webhooksFailed > 0 ? "text-rose-700" : "",
          },
          {
            label: "Fakturaer PAID",
            value: stats.invoicesPaid,
            href: "/superadmin/tripletex/invoices?status=PAID",
          },
          {
            label: "Tripletex-mapping",
            value: stats.tripletexMappedProviders,
            href: "/superadmin/tripletex/invoices",
          },
          {
            label: "Aktive leverandører",
            value: stats.activeProviders,
            href: "/superadmin/providers",
          },
        ]}
      />

      {needsAttention > 0 ? (
        <p className="text-sm text-amber-900">
          {needsAttention} hendelse{needsAttention === 1 ? "" : "r"} krever oppfølging (failed outbox/webhooks).
        </p>
      ) : null}

      <div className="mt-2">
        <TripletexSubNav activePath="/superadmin/tripletex" />
      </div>

      <SuperadminSection title="Sync-status per leverandør" lead="Tripletex customer-mapping (Flow A)." flat>
        <SuperadminTableSurface>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--lp-border))] text-left text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  <th className="px-4 py-3">Leverandør</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Tripletex customer</th>
                  <th className="px-4 py-3 text-right">Handling</th>
                </tr>
              </thead>
              <tbody>
                {syncRows.map((row) => (
                  <tr key={row.provider_id} className="border-b border-[rgb(var(--lp-border))] last:border-b-0">
                    <td className="px-4 py-3 font-medium">{row.provider_name}</td>
                    <td className="px-4 py-3 font-mono text-xs break-all">{row.provider_slug}</td>
                    <td className="px-4 py-3 font-mono text-xs break-all">{row.tripletex_customer_id ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/superadmin/providers/${row.provider_id}/billing`}
                        className="ds-btn ds-btn--secondary min-h-[44px]"
                      >
                        Billing
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 p-4 md:hidden">
            {syncRows.map((row) => (
              <li key={row.provider_id} className="border-b border-[rgb(var(--lp-border))] pb-3 last:border-b-0">
                <p className="font-semibold">{row.provider_name}</p>
                <p className="mt-1 font-mono text-xs break-all text-[rgb(var(--lp-muted))]">{row.provider_slug}</p>
                <p className="mt-2 text-sm break-all">{row.has_mapping ? row.tripletex_customer_id : "Ingen mapping"}</p>
                <Link
                  href={`/superadmin/providers/${row.provider_id}/billing`}
                  className="ds-btn ds-btn--secondary mt-3 inline-flex min-h-[44px] items-center"
                >
                  Billing
                </Link>
              </li>
            ))}
          </ul>
        </SuperadminTableSurface>
      </SuperadminSection>
    </SuperadminPageShell>
  );
}
