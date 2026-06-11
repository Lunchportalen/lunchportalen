"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import RegistrationApproveDialog from "@/components/providers/RegistrationApproveDialog";
import type { ProviderRegistrationRow } from "@/lib/providers/loadProviderRegistrations";

function statusLabel(status: string) {
  const s = status.toUpperCase();
  if (s === "PENDING") return "Venter";
  if (s === "APPROVED") return "Godkjent";
  if (s === "REJECTED") return "Avvist";
  return status;
}

export default function ProviderRegistrationsQueue({
  providerId,
  rows,
}: {
  providerId: string;
  rows: ProviderRegistrationRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ProviderRegistrationRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const pending = useMemo(() => rows.filter((r) => r.status.toUpperCase() === "PENDING"), [rows]);

  function openRow(row: ProviderRegistrationRow) {
    setSelected(row);
    setDialogOpen(true);
  }

  return (
    <>
      <div className="ds-provider-reg-table-wrap">
        <table className="ds-provider-reg-table">
          <thead>
            <tr>
              <th>Bedrift</th>
              <th>Område</th>
              <th>Kontakt</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr>
                <td colSpan={5} className="ds-provider-reg-empty">
                  Ingen ventende registreringer akkurat nå.
                  <span className="ds-provider-reg-meta">
                    Når en bedrift i ditt dekningsområde melder interesse, vises den her for behandling.
                  </span>
                </td>
              </tr>
            ) : (
              pending.map((row) => (
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
                  <td>{statusLabel(row.status)}</td>
                  <td>
                    <button type="button" className="ds-btn ds-btn--secondary" onClick={() => openRow(row)}>
                      Behandle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
