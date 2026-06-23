"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { toggleServiceArea } from "@/app/leverandor/omrader/actions";
import ServiceAreaEditor from "@/components/providers/ServiceAreaEditor";
import type { ServiceAreaRow } from "@/lib/providers/serviceAreaShared";
import { resolveProviderCoverageActionError } from "@/lib/providers/providerCoverageActionErrors";
import {
  PROVIDER_COVERAGE_EMPTY_STEP_KEYS,
  coverageStatusLabel,
  formatCoverageDays,
  formatCoverageEmployees,
  providerCoverageSummary,
} from "@/lib/providers/providerCoverageSurface";

export default function ServiceAreasManager({
  providerId,
  rows,
  canEdit,
}: {
  providerId: string;
  rows: ServiceAreaRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("provider.coverage");
  const tErrors = useTranslations("provider.coverage.errors");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<ServiceAreaRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const citySuggestions = useMemo(
    () => [...new Set(rows.map((r) => r.city).filter(Boolean))].sort(),
    [rows],
  );

  function openCreate() {
    setSelected(null);
    setEditorOpen(true);
    setActionError(null);
  }

  function openEdit(row: ServiceAreaRow) {
    setSelected(row);
    setEditorOpen(true);
    setActionError(null);
  }

  function onToggle(row: ServiceAreaRow) {
    if (!canEdit) return;
    setActionError(null);
    startTransition(async () => {
      const res = await toggleServiceArea(providerId, row.id, !row.active);
      if (res.success === false) {
        setActionError(resolveProviderCoverageActionError((key) => tErrors(key), res, "toggleFailed"));
        return;
      }
      router.refresh();
    });
  }

  function toggleButton(row: ServiceAreaRow) {
    return (
      <button
        type="button"
        className="ds-btn ds-btn--secondary"
        disabled={pending}
        title={row.active ? t("actions.deactivateTitle") : t("actions.activateTitle")}
        onClick={() => onToggle(row)}
      >
        {row.active ? t("actions.deactivate") : t("actions.activate")}
      </button>
    );
  }

  return (
    <>
      <div className="ds-provider-service-areas-toolbar">
        <p className="ds-provider-reg-summary">{providerCoverageSummary(rows, (key, values) => t(key, values))}</p>
        {canEdit ? (
          <button type="button" className="ds-btn ds-btn--primary" title={t("actions.newAreaTitle")} onClick={openCreate}>
            {t("actions.newArea")}
          </button>
        ) : (
          <p className="ds-body">{t("actions.readOnlyNote")}</p>
        )}
      </div>

      {actionError ? (
        <p className="lp-demo-form__status is-error" role="alert">
          {actionError}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="ds-provider-empty">
          <p className="ds-provider-empty__title">{t("empty.title")}</p>
          <p className="ds-provider-empty__text">{t("empty.text")}</p>
          <ul className="ds-provider-empty__steps">
            {PROVIDER_COVERAGE_EMPTY_STEP_KEYS.map((stepKey) => (
              <li key={stepKey}>{t(`empty.${stepKey}`)}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="ds-provider-service-area-list">
            {rows.map((row) => (
              <article
                key={row.id}
                className={`ds-provider-service-area-row${row.active ? "" : " is-inactive"}`}
              >
                <div className="ds-provider-service-area-row__main">
                  <h2 className="ds-h4">{row.city}</h2>
                  <p className="ds-provider-reg-meta">
                    {row.postal_code_from}–{row.postal_code_to} ·{" "}
                    {formatCoverageEmployees(row.min_employees, row.max_employees, (key, values) => t(key, values))}
                  </p>
                  <p className="ds-provider-reg-meta">
                    {formatCoverageDays(row.available_days, (key, values) => t(key, values))}
                  </p>
                </div>
                <div className="ds-provider-service-area-row__meta">
                  <span className={`ds-provider-status-pill${row.active ? " is-active" : ""}`}>
                    {coverageStatusLabel(row.active, (key, values) => t(key, values))}
                  </span>
                </div>
                {canEdit ? (
                  <div className="ds-provider-service-area-row__actions">
                    <button type="button" className="ds-btn ds-btn--secondary" onClick={() => openEdit(row)}>
                      {t("actions.edit")}
                    </button>
                    {toggleButton(row)}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="ds-provider-reg-table-wrap ds-provider-reg-table-wrap--desktop">
            <table className="ds-provider-reg-table">
              <thead>
                <tr>
                  <th>{t("table.area")}</th>
                  <th>{t("table.postalCodes")}</th>
                  <th>{t("table.minEmployees")}</th>
                  <th>{t("table.deliveryDays")}</th>
                  <th>{t("table.status")}</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={row.active ? "" : "is-inactive"}>
                    <td>{row.city}</td>
                    <td>
                      {row.postal_code_from}–{row.postal_code_to}
                    </td>
                    <td>{formatCoverageEmployees(row.min_employees, row.max_employees, (key, values) => t(key, values))}</td>
                    <td>{formatCoverageDays(row.available_days, (key, values) => t(key, values))}</td>
                    <td>
                      <span className={`ds-provider-status-pill${row.active ? " is-active" : ""}`}>
                        {coverageStatusLabel(row.active, (key, values) => t(key, values))}
                      </span>
                    </td>
                    {canEdit ? (
                      <td className="ds-provider-service-area-row__actions-inline">
                        <button type="button" className="ds-btn ds-btn--secondary" onClick={() => openEdit(row)}>
                          {t("actions.edit")}
                        </button>
                        {toggleButton(row)}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ServiceAreaEditor
        open={editorOpen}
        providerId={providerId}
        area={selected}
        citySuggestions={citySuggestions}
        onClose={() => setEditorOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
