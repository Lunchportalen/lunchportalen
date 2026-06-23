"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import RegistrationApproveDialog from "@/components/providers/RegistrationApproveDialog";
import type { ProviderRegistrationRow } from "@/lib/providers/loadProviderRegistrations";
import {
  PROVIDER_REGISTRATIONS_EMPTY_STEP_KEYS,
  formatProviderRegistrationReceived,
  providerRegistrationStatusLabelKey,
  providerRegistrationsSummaryKey,
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
  const tTable = useTranslations("provider.registrations.table");
  const tStatus = useTranslations("provider.registrations.status");
  const tSummary = useTranslations("provider.registrations.summary");
  const tActions = useTranslations("provider.registrations.actions");
  const tEmpty = useTranslations("provider.registrations.empty");

  const pending = useMemo(() => rows.filter((r) => r.status.toUpperCase() === "PENDING"), [rows]);
  const summary = providerRegistrationsSummaryKey(pending.length);

  function openRow(row: ProviderRegistrationRow) {
    setSelected(row);
    setDialogOpen(true);
  }

  return (
    <>
      <p className="ds-provider-reg-summary">
        {summary.key === "many"
          ? tSummary("many", { count: summary.count })
          : tSummary(summary.key)}
      </p>

      {pending.length === 0 ? (
        <div className="ds-provider-empty">
          <p className="ds-provider-empty__title">{tEmpty("title")}</p>
          <p className="ds-provider-empty__text">{tEmpty("text")}</p>
          <ul className="ds-provider-empty__steps">
            {PROVIDER_REGISTRATIONS_EMPTY_STEP_KEYS.map((step) => (
              <li key={step}>{tEmpty(`steps.${step}`)}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="ds-provider-reg-table-wrap">
          <table className="ds-provider-reg-table">
            <thead>
              <tr>
                <th>{tTable("company")}</th>
                <th>{tTable("area")}</th>
                <th>{tTable("contact")}</th>
                <th>{tTable("employees")}</th>
                <th>{tTable("received")}</th>
                <th>{tTable("status")}</th>
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
                  <td>{tStatus(providerRegistrationStatusLabelKey(row.status))}</td>
                  <td>
                    <button type="button" className="ds-btn ds-btn--secondary" onClick={() => openRow(row)}>
                      {tActions("review")}
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
