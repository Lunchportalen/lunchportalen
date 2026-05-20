"use client";

import { useEffect, useId, useState, useTransition } from "react";

import { saveServiceArea } from "@/app/leverandor/omrader/actions";
import {
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  type ServiceAreaRow,
  type WeekdayKey,
} from "@/lib/providers/serviceAreaShared";
import { normalizePostal } from "@/lib/providers/serviceAreaSchema";

export type ServiceAreaEditorProps = {
  open: boolean;
  providerId: string;
  area: ServiceAreaRow | null;
  citySuggestions: string[];
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  city: string;
  postal_code_from: string;
  postal_code_to: string;
  min_employees: string;
  max_employees: string;
  available_days: WeekdayKey[];
  active: boolean;
};

function emptyForm(): FormState {
  return {
    city: "",
    postal_code_from: "",
    postal_code_to: "",
    min_employees: "20",
    max_employees: "",
    available_days: [...WEEKDAY_KEYS],
    active: true,
  };
}

function formFromArea(area: ServiceAreaRow): FormState {
  return {
    city: area.city,
    postal_code_from: area.postal_code_from,
    postal_code_to: area.postal_code_to,
    min_employees: area.min_employees != null ? String(area.min_employees) : "",
    max_employees: area.max_employees != null ? String(area.max_employees) : "",
    available_days: WEEKDAY_KEYS.filter((d) => area.available_days.includes(d)),
    active: area.active,
  };
}

export default function ServiceAreaEditor({
  open,
  providerId,
  area,
  citySuggestions,
  onClose,
  onSaved,
}: ServiceAreaEditorProps) {
  const titleId = useId();
  const listId = useId();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setError(null);
      return;
    }
    setForm(area ? formFromArea(area) : emptyForm());
    setError(null);
  }, [open, area]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  function toggleDay(day: WeekdayKey) {
    setForm((prev) => {
      const has = prev.available_days.includes(day);
      const next = has
        ? prev.available_days.filter((d) => d !== day)
        : [...prev.available_days, day];
      return { ...prev, available_days: next };
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveServiceArea(providerId, area?.id ?? null, {
        city: form.city,
        postal_code_from: normalizePostal(form.postal_code_from),
        postal_code_to: normalizePostal(form.postal_code_to),
        min_employees: form.min_employees ? Number(form.min_employees) : null,
        max_employees: form.max_employees ? Number(form.max_employees) : null,
        available_days: form.available_days,
        active: form.active,
      });
      if (!res.success) {
        setError("error" in res ? res.error : "Kunne ikke lagre.");
        return;
      }
      onSaved();
      onClose();
    });
  }

  return (
    <>
      <button type="button" className="ds-provider-drawer-backdrop" aria-label="Lukk" onClick={onClose} />
      <div className="ds-provider-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="ds-h3">
          {area ? "Rediger område" : "Legg til område"}
        </h2>

        <form className="lp-demo-form" onSubmit={onSubmit} noValidate>
          <label htmlFor="sa-city">
            Poststed / område
            <input
              id="sa-city"
              name="city"
              list={listId}
              required
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
            />
            <datalist id={listId}>
              {citySuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <div className="lp-registrer-form__row">
            <label htmlFor="sa-from">
              Postnr fra
              <input
                id="sa-from"
                inputMode="numeric"
                required
                value={form.postal_code_from}
                onChange={(e) =>
                  setForm((p) => ({ ...p, postal_code_from: normalizePostal(e.target.value) }))
                }
              />
            </label>
            <label htmlFor="sa-to">
              Postnr til
              <input
                id="sa-to"
                inputMode="numeric"
                required
                value={form.postal_code_to}
                onChange={(e) =>
                  setForm((p) => ({ ...p, postal_code_to: normalizePostal(e.target.value) }))
                }
              />
            </label>
          </div>

          <div className="lp-registrer-form__row">
            <label htmlFor="sa-min">
              Min ansatte
              <input
                id="sa-min"
                type="number"
                min={1}
                value={form.min_employees}
                onChange={(e) => setForm((p) => ({ ...p, min_employees: e.target.value }))}
              />
            </label>
            <label htmlFor="sa-max">
              Maks ansatte (valgfritt)
              <input
                id="sa-max"
                type="number"
                min={1}
                value={form.max_employees}
                onChange={(e) => setForm((p) => ({ ...p, max_employees: e.target.value }))}
              />
            </label>
          </div>

          <fieldset className="ds-provider-day-fieldset">
            <legend>Leveringsdager</legend>
            <div className="ds-provider-day-grid">
              {WEEKDAY_KEYS.map((day) => (
                <label key={day} className="ds-provider-day-chip">
                  <input
                    type="checkbox"
                    checked={form.available_days.includes(day)}
                    onChange={() => toggleDay(day)}
                  />
                  <span>{WEEKDAY_LABELS[day]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="ds-provider-active-toggle">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
            />
            <span>Aktivt område (brukes i registreringsmatching)</span>
          </label>

          {error ? (
            <p className="lp-demo-form__status is-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ds-provider-dialog__actions">
            <button type="button" className="ds-btn ds-btn--secondary" onClick={onClose} disabled={pending}>
              Avbryt
            </button>
            <button type="submit" className="ds-btn ds-btn--primary" disabled={pending}>
              {pending ? "Lagrer…" : area ? "Lagre endringer" : "Opprett område"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
