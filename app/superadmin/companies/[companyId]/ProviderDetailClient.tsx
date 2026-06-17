"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import CompanyRemovalDialog from "@/app/superadmin/companies/CompanyRemovalDialog";
import {
  SuperadminBadge,
  SuperadminCommandList,
  SuperadminHero,
  SuperadminMetricRow,
  SuperadminPageShell,
  SuperadminSection,
  SuperadminTableSurface,
} from "@/components/superadmin/shell/SuperadminShell";
import { formatDateTimeNO } from "@/lib/date/format";
import type { SuperadminProviderDetail } from "@/lib/server/superadmin/loadSuperadminProviderDetail";

function statusLabel(status: string) {
  if (status === "active") return "Aktiv";
  if (status === "paused") return "Pauset";
  if (status === "closed") return "Stengt";
  return "Venter";
}

function statusTone(status: string): "go" | "watch" | "stop" | "muted" {
  if (status === "active") return "go";
  if (status === "paused") return "watch";
  if (status === "closed") return "stop";
  return "muted";
}

function fmtTs(ts?: string | null) {
  if (!ts) return "—";
  try {
    return formatDateTimeNO(ts);
  } catch {
    return ts;
  }
}

type RemovalTarget = {
  id: string;
  name: string;
  orgnr: string | null;
};

export default function ProviderDetailClient(props: { data: SuperadminProviderDetail }) {
  const { provider, customers } = props.data;
  const router = useRouter();
  const [removalTarget, setRemovalTarget] = useState<RemovalTarget | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activeAgreements = useMemo(() => customers.filter((c) => c.activeAgreement).length, [customers]);

  return (
    <SuperadminPageShell fullWidth>
      <SuperadminHero
        variant="command"
        eyebrow="Superadmin / Cateringfirma"
        title={provider.name}
        lead="Administrer lunsjkunder, avtaler og drift for dette cateringfirmaet."
        meta={
          <SuperadminCommandList
            items={[
              { label: "Til leverandøroversikt", href: "/superadmin/companies", description: "Cateringfirma og leverandører" },
              { label: "Audit", href: `/superadmin/audit?entity_id=${encodeURIComponent(provider.id)}`, description: "Sporbarhet for leverandør" },
            ]}
          />
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <SuperadminBadge tone={statusTone(provider.status)}>{statusLabel(provider.status)}</SuperadminBadge>
            <span className="text-xs text-[rgb(var(--lp-muted))]">Org.nr: {provider.orgnr ?? "—"}</span>
            {provider.contactEmail ? <span className="text-xs text-[rgb(var(--lp-muted))]">· {provider.contactEmail}</span> : null}
          </div>
        }
      />

      <SuperadminMetricRow
        metrics={[
          { label: "Kunder", value: customers.length, valueClassName: "sa-metric-row__value--num" },
          { label: "Aktive avtaler", value: activeAgreements, valueClassName: "sa-metric-row__value--num" },
          { label: "Sist endret", value: fmtTs(provider.updatedAt) },
          { label: "Leverandør-ID", value: <span className="font-mono text-xs">{provider.id}</span> },
        ]}
      />

      {successMsg ? (
        <div className="sa-context-note mt-4 border-emerald-200 bg-emerald-50 text-emerald-900">
          <div className="text-sm font-semibold">{successMsg}</div>
        </div>
      ) : null}

      <SuperadminSection
        title="Lunsjkunder"
        lead="Firma koblet til denne leverandøren via companies.provider_id. Systemorganisasjoner vises ikke."
        flat
      >
        <SuperadminTableSurface>
          <div className="sa-enterprise-table-wrap">
            <table className="sa-enterprise-table">
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>Org.nr</th>
                  <th>Status</th>
                  <th>Avtale</th>
                  <th>Ansatte</th>
                  <th>Sist endret</th>
                  <th className="text-right">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-sm text-[rgb(var(--lp-muted))]">
                      Ingen kunder funnet for dette cateringfirmaet.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id}>
                      <td className="font-semibold text-neutral-900">{c.name}</td>
                      <td className="tabular-nums">{c.orgnr ?? "—"}</td>
                      <td>
                        <span className={`sa-status-chip sa-status-chip--${c.status === "active" ? "active" : c.status === "paused" ? "paused" : c.status === "closed" ? "closed" : "pending"}`}>
                          {statusLabel(c.status)}
                        </span>
                      </td>
                      <td>{c.activeAgreement ? "Aktiv" : "—"}</td>
                      <td className="tabular-nums">{c.employeesCount}</td>
                      <td className="whitespace-nowrap text-xs text-[rgb(var(--lp-muted))]">{fmtTs(c.updatedAt)}</td>
                      <td className="text-right">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/superadmin/companies/${encodeURIComponent(c.id)}`}
                            className="inline-flex min-h-12 min-w-[7.5rem] items-center justify-center rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                          >
                            Åpne kunde
                          </Link>
                          <button
                            type="button"
                            className="inline-flex min-h-12 min-w-[7.5rem] items-center justify-center rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-50"
                            onClick={() => {
                              setSuccessMsg(null);
                              setRemovalTarget({ id: c.id, name: c.name, orgnr: c.orgnr });
                            }}
                          >
                            Fjern kunde
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SuperadminTableSurface>
      </SuperadminSection>

      {removalTarget ? (
        <CompanyRemovalDialog
          open={Boolean(removalTarget)}
          companyId={removalTarget.id}
          companyName={removalTarget.name}
          orgnr={removalTarget.orgnr}
          onClose={() => setRemovalTarget(null)}
          onDone={(result) => {
            setRemovalTarget(null);
            setSuccessMsg(result.mode === "hard_delete" ? "Kunde er slettet permanent." : "Kunde er arkivert.");
            router.refresh();
          }}
        />
      ) : null}
    </SuperadminPageShell>
  );
}
