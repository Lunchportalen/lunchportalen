"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import RegistrationApproveDialog from "@/components/providers/RegistrationApproveDialog";
import type { ProviderRegistrationRow } from "@/lib/providers/loadProviderRegistrations";
import {
  PROVIDER_REGISTRATIONS_COPY,
  PROVIDER_REGISTRATIONS_EMPTY_STATE,
  formatProviderRegistrationReceived,
  providerRegistrationStatusLabel,
  providerRegistrationsSummary,
} from "@/lib/providers/providerRegistrationsSurface";

export default function ProviderRegistrationsQueue({
  providerId,
  rows,
  locale,
}: {
  providerId: string;
  rows: ProviderRegistrationRow[];
  locale?: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ProviderRegistrationRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const pending = useMemo(() => rows.filter((r) => r.status.toUpperCase() === "PENDING"), [rows]);
  const copy = PROVIDER_REGISTRATIONS_COPY;

  function openRow(row: ProviderRegistrationRow) {
    setSelected(row);
    setDialogOpen(true);
  }

  return (
    <>
      <p className="ds-provider-reg-summary">{providerRegistrationsSummary(pending.length)}</p>

      {pending.length === 0 ? (
        <div className="ds-provider-empty">
          <p className="ds-provider-empty__title">{PROVIDER_REGISTRATIONS_EMPTY_STATE.title}</p>
          <p className="ds-provider-empty__text">{PROVIDER_REGISTRATIONS_EMPTY_STATE.text}</p>
          <ul className="ds-provider-empty__steps">
            {PROVIDER_REGISTRATIONS_EMPTY_STATE.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="ds-provider-reg-table-wrap">
          <table className="ds-provider-reg-table">
            <thead>
              <tr>
                <th>{copy.tableHeaders.company}</th>
                <th>{copy.tableHeaders.area}</th>
                <th>{copy.tableHeaders.contact}</th>
                <th>{copy.tableHeaders.employees}</th>
                <th>{copy.tableHeaders.received}</th>
                <th>{copy.tableHeaders.status}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button type="button" className="ds-provider-reg-link" onClick={() => openRow(row)}>
                      {row.company_name}
                    </button>
                    <span className="ds-provider-reg-meta">{row.orgnr}</span>
                  </td>
                  <td>
                    {row.city} {row.postal_code}
                  </td>
                  <td>
                    {row.contact_name}
                    <span className="ds-provider-reg-meta">{row.contact_email}</span>
                  </td>
                  <td>{row.employee_count ?? "—"}</td>
                  <td>{formatProviderRegistrationReceived(row.created_at, locale)}</td>
                  <td>{providerRegistrationStatusLabel(row.status)}</td>
                  <td>
                    <button type="button" className="ds-btn ds-btn--secondary" onClick={() => openRow(row)}>
                      {copy.reviewAction}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RegistrationApproveDialog
        open={dialogOpen}
        providerId={providerId}
        registration={selected}
        onClose={() => setDialogOpen(false)}
        onDone={() => router.refresh()}
      />
    </>
  );
}
