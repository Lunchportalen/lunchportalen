"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormSchema, FormFieldBase, FormFieldType } from "@/lib/public/forms/types";

type FormRow = {
  id: string;
  name: string;
  environment: string;
  locale: string;
  schema: FormSchema | any;
  updated_at: string;
};

type SubmissionRow = {
  id: string;
  form_id: string;
  environment: string;
  locale: string;
  data: Record<string, unknown>;
  created_at: string;
};

const FIELD_TYPES: FormFieldType[] = ["text", "email", "textarea", "select", "checkbox"];

function makeFieldId(index: number) {
  return `field_${index}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function FormEditorPage(props: { params: { id: string } }) {
  const router = useRouter();
  const formId = props.params.id;

  const [form, setForm] = useState<FormRow | null>(null);
  const [name, setName] = useState("");
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [fields, setFields] = useState<FormFieldBase[]>([]);
  const [submitLabel, setSubmitLabel] = useState("Send");
  const [successMessage, setSuccessMessage] = useState("Takk!");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadForm = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backoffice/forms/${encodeURIComponent(formId)}`);
      if (!res.ok) {
        throw new Error(
          res.status === 404 ? "Skjema ikke funnet" : `Feil ${res.status}`
        );
      }
      const data = await res.json();
      const row = data?.form as FormRow | undefined;
      if (!row) throw new Error("Skjema mangler i respons");
      setForm(row);
      setName(row.name);
      const rawSchema = (row.schema ?? {}) as any;
      const normalized: FormSchema = {
        version: 1,
        fields: Array.isArray(rawSchema.fields) ? (rawSchema.fields as FormFieldBase[]) : [],
        submitLabel:
          typeof rawSchema.submitLabel === "string" ? rawSchema.submitLabel : "Send",
        successMessage:
          typeof rawSchema.successMessage === "string"
            ? rawSchema.successMessage
            : "Takk!",
        honeypotId:
          typeof rawSchema.honeypotId === "string" ? rawSchema.honeypotId : "_hp",
      };
      setSchema(normalized);
      setFields(normalized.fields);
      setSubmitLabel(normalized.submitLabel ?? "Send");
      setSuccessMessage(normalized.successMessage ?? "Takk!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste skjema");
      setForm(null);
      setSchema(null);
      setFields([]);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  const loadSubmissions = useCallback(async () => {
    setSubmissionsLoading(true);
    try {
      const res = await fetch(
        `/api/backoffice/forms/${encodeURIComponent(formId)}/submissions?limit=50`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok && Array.isArray(data.submissions)) {
        setSubmissions(data.submissions as SubmissionRow[]);
      } else {
        setSubmissions([]);
      }
    } catch {
      // ignore, keep previous
    } finally {
      setSubmissionsLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void loadForm();
    void loadSubmissions();
  }, [loadForm, loadSubmissions]);

  const updateField = (index: number, patch: Partial<FormFieldBase>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  };

  const moveField = (index: number, delta: -1 | 1) => {
    setFields((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        id: makeFieldId(prev.length),
        type: "text",
        label: "New field",
        required: false,
      },
    ]);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const addOption = (index: number) => {
    setFields((prev) =>
      prev.map((f, i) =>
        i === index
          ? {
              ...f,
              options: [...(f.options ?? []), { value: "", label: "" }],
            }
          : f
      )
    );
  };

  const updateOption = (
    fieldIndex: number,
    optionIndex: number,
    patch: { value?: string; label?: string }
  ) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const opts = [...(f.options ?? [])];
        const current = opts[optionIndex] ?? { value: "", label: "" };
        opts[optionIndex] = {
          value: patch.value ?? current.value,
          label: patch.label ?? current.label,
        };
        return { ...f, options: opts };
      })
    );
  };

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const opts = [...(f.options ?? [])];
        opts.splice(optionIndex, 1);
        return { ...f, options: opts };
      })
    );
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const nextSchema: FormSchema = {
        version: 1,
        fields,
        submitLabel,
        successMessage,
        honeypotId: schema?.honeypotId ?? "_hp",
      };
      const res = await fetch(`/api/backoffice/forms/${encodeURIComponent(formId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || form.name, schema: nextSchema }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Feil ${res.status}`);
      }
      await loadForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke lagre skjema");
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (s: string) =>
    new Date(s).toLocaleString("nb-NO");

  if (loading) {
    return (
      <div className="p-6 max-w-4xl">
        <p className="text-sm text-slate-600">Laster skjema…</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-6 max-w-4xl">
        <p className="text-sm text-red-600">
          Skjema ikke funnet.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => router.push("/backoffice/forms")}
          >
            Tilbake til liste
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Skjema</h1>
          <p className="mt-1 text-sm text-slate-600">
            {form.environment} · {form.locale}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Lagrer…" : "Lagre skjema"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Innstillinger</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Navn
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Submit-label
              </label>
              <input
                type="text"
                value={submitLabel}
                onChange={(e) => setSubmitLabel(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Suksessmelding
              </label>
              <input
                type="text"
                value={successMessage}
                onChange={(e) => setSuccessMessage(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Felter</h2>
              <button
                type="button"
                onClick={addField}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Legg til felt
              </button>
            </div>
            {fields.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen felter enda.</p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id || index}
                    className="rounded border border-slate-200 bg-slate-50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">
                        Felt {index + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveField(index, -1)}
                          className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
                        >
                          Opp
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(index, 1)}
                          className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
                        >
                          Ned
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(index)}
                          className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-[10px] text-red-700 hover:bg-red-50"
                        >
                          Fjern
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">
                          Label
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) =>
                            updateField(index, { label: e.target.value })
                          }
                          className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">
                          Type
                        </label>
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateField(index, {
                              type: e.target.value as FormFieldType,
                            })
                          }
                          className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">
                          Min length
                        </label>
                        <input
                          type="number"
                          value={field.minLength ?? ""}
                          onChange={(e) =>
                            updateField(index, {
                              minLength:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                          className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">
                          Max length
                        </label>
                        <input
                          type="number"
                          value={field.maxLength ?? ""}
                          onChange={(e) =>
                            updateField(index, {
                              maxLength:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                          className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id={`required-${field.id}`}
                          type="checkbox"
                          checked={!!field.required}
                          onChange={(e) =>
                            updateField(index, { required: e.target.checked })
                          }
                          className="h-3 w-3 rounded border-slate-300 text-slate-700"
                        />
                        <label
                          htmlFor={`required-${field.id}`}
                          className="text-[11px] text-slate-700"
                        >
                          Påkrevd
                        </label>
                      </div>
                    </div>
                    {field.type === "select" && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-slate-700">
                            Alternativer
                          </span>
                          <button
                            type="button"
                            onClick={() => addOption(index)}
                            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
                          >
                            Legg til
                          </button>
                        </div>
                        {(field.options ?? []).length === 0 ? (
                          <p className="text-[11px] text-slate-500">
                            Ingen alternativer.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {(field.options ?? []).map((opt, oi) => (
                              <div
                                key={oi}
                                className="grid grid-cols-[1fr_1fr_auto] gap-1"
                              >
                                <input
                                  type="text"
                                  value={opt.value}
                                  placeholder="Verdi"
                                  onChange={(e) =>
                                    updateOption(index, oi, {
                                      value: e.target.value,
                                    })
                                  }
                                  className="rounded border border-slate-200 px-2 py-0.5 text-[11px]"
                                />
                                <input
                                  type="text"
                                  value={opt.label}
                                  placeholder="Label"
                                  onChange={(e) =>
                                    updateOption(index, oi, {
                                      label: e.target.value,
                                    })
                                  }
                                  className="rounded border border-slate-200 px-2 py-0.5 text-[11px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(index, oi)}
                                  className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-[10px] text-red-700 hover:bg-red-50"
                                >
                                  Fjern
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">
            Innsendelser (siste 50)
          </h2>
          {submissionsLoading ? (
            <p className="text-sm text-slate-500">Laster innsendelser…</p>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen innsendelser enda.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {submissions.map((s) => (
                <li
                  key={s.id}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">
                      {formatDateTime(s.created_at)}
                    </span>
                    <span className="text-slate-500">
                      {s.locale} · {s.environment}
                    </span>
                  </div>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-900/90 px-2 py-1 text-[10px] text-slate-50">
                    {JSON.stringify(s.data, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

