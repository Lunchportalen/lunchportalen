"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toggleServiceArea } from "@/app/leverandor/omrader/actions";
import ServiceAreaEditor from "@/components/providers/ServiceAreaEditor";
import {
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  type ServiceAreaRow,
} from "@/lib/providers/loadServiceAreas";

function formatDays(days: string[]) {
  return WEEKDAY_KEYS.filter((d) => days.includes(d))
    .map((d) => WEEKDAY_LABELS[d])
    .join(", ");
}

function formatEmployees(min: number | null, max: number | null) {
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `${min}+`;
  if (max != null) return `≤${max}`;
  return "—";
}

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
      if (!res.success) {
        setActionError("error" in res ? res.error : "Kunne ikke oppdatere status.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="ds-provider-service-areas-toolbar">
        {canEdit ? (
          <button type="button" className="ds-btn ds-btn--primary" onClick={openCreate}>
            Legg til område
          </button>
        ) : (
          <p className="ds-body">Du har lesetilgang. Endringer krever provider-admin.</p>
        )}
      </div>

      {actionError ? (
        <p className="lp-demo-form__status is-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="ds-provider-service-area-list">
        {rows.length === 0 ? (
          <p className="ds-provider-reg-empty">Ingen dekningsområder er registrert ennå.</p>
        ) : (
          rows.map((row) => (
            <article
              key={row.id}
              className={`ds-provider-service-area-row${row.active ? "" : " is-inactive"}`}
            >
              <div className="ds-provider-service-area-row__main">
                <h2 className="ds-h4">{row.city}</h2>
                <p className="ds-provider-reg-meta">
                  {row.postal_code_from}–{row.postal_code_to} · {formatEmployees(row.min_employees, row.max_employees)}
                </p>
                <p className="ds-provider-reg-meta">{formatDays(row.available_days)}</p>
              </div>
              <div className="ds-provider-service-area-row__meta">
                <span className={`ds-provider-status-pill${row.active ? " is-active" : ""}`}>
                  {row.active ? "Aktiv" : "Inaktiv"}
                </span>
              </div>
              {canEdit ? (
                <div className="ds-provider-service-area-row__actions">
                  <button type="button" className="ds-btn ds-btn--secondary" onClick={() => openEdit(row)}>
                    Rediger
                  </button>
                  <button
                    type="button"
                    className="ds-btn ds-btn--secondary"
                    disabled={pending}
                    onClick={() => onToggle(row)}
                  >
                    {row.active ? "Deaktiver" : "Aktiver"}
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      <div className="ds-provider-reg-table-wrap ds-provider-reg-table-wrap--desktop">
        <table className="ds-provider-reg-table">
          <thead>
            <tr>
              <th>By</th>
              <th>Postnr</th>
              <th>Ansatte</th>
              <th>Dager</th>
              <th>Status</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="ds-provider-reg-empty">
                  Ingen dekningsområder.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={row.active ? "" : "is-inactive"}>
                  <td>{row.city}</td>
                  <td>
                    {row.postal_code_from}–{row.postal_code_to}
                  </td>
                  <td>{formatEmployees(row.min_employees, row.max_employees)}</td>
                  <td>{formatDays(row.available_days)}</td>
                  <td>{row.active ? "Aktiv" : "Inaktiv"}</td>
                  {canEdit ? (
                    <td className="ds-provider-service-area-row__actions-inline">
                      <button type="button" className="ds-btn ds-btn--secondary" onClick={() => openEdit(row)}>
                        Rediger
                      </button>
                      <button
                        type="button"
                        className="ds-btn ds-btn--secondary"
                        disabled={pending}
                        onClick={() => onToggle(row)}
                      >
                        {row.active ? "Deaktiver" : "Aktiver"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
