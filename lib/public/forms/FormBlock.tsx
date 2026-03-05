"use client";

import { useEffect, useState, FormEvent } from "react";
import type { FormSchema, FormFieldBase } from "@/lib/public/forms/types";

type Props = {
  formId: string;
  title?: string;
  env: "prod" | "staging";
  locale: "nb" | "en";
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string; errors?: string[] };

export function FormBlock({ formId, title, env, locale }: Props) {
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FormFieldBase[]>([]);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ env, locale });
        const res = await fetch(`/api/public/forms/${formId}/schema?${params}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Skjema ikke funnet" : "Feil");
        }
        const data = await res.json();
        if (!data?.schema) throw new Error("Ugyldig skjema-respons");
        const s = data.schema as FormSchema;
        if (!cancelled) {
          setSchema(s);
          setFields(Array.isArray(s.fields) ? s.fields : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Kunne ikke laste skjema");
          setSchema(null);
          setFields([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (formId) void load();
    return () => {
      cancelled = true;
    };
  }, [formId, env, locale]);

  const handleChange = (fieldId: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!schema) return;
    setSubmitState({ kind: "submitting" });
    try {
      const honeypotId = schema.honeypotId ?? "_hp";
      const payload = {
        env,
        locale,
        data: formData,
        honeypot: (formData[honeypotId] as string | undefined) ?? "",
      };
      const res = await fetch(`/api/public/forms/${formId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const errors: string[] | undefined =
          (Array.isArray((data as any).errors) && (data as any).errors) ||
          (Array.isArray((data as any).detail?.errors) && (data as any).detail.errors) ||
          undefined;
        setSubmitState({
          kind: "error",
          message: (data as any)?.message || "Feil",
          errors,
        });
        return;
      }
      setSubmitState({ kind: "success", message: (data as any).message || "Takk!" });
    } catch (e) {
      setSubmitState({
        kind: "error",
        message: e instanceof Error ? e.message : "Kunne ikke sende skjema",
      });
    }
  };

  if (!formId) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Skjema er ikke konfigurert.
      </div>
    );
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Laster skjema�</div>;
  }

  if (error || !schema) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error || "Kunne ikke laste skjema."}
      </div>
    );
  }

  const honeypotId = schema.honeypotId ?? "_hp";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {title && <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => {
          const value = formData[field.id] ?? "";
          const commonLabel = (
            <label className="block text-sm font-medium text-slate-700" htmlFor={field.id}>
              {field.label}
              {field.required && <span className="ml-1 text-red-600">*</span>}
            </label>
          );
          const commonInputClass =
            "mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-900";

          if (field.id === honeypotId) {
            return (
              <div key={field.id} className="hidden">
                <input
                  id={field.id}
                  name={field.id}
                  type="text"
                  autoComplete="off"
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                />
              </div>
            );
          }

          return (
            <div key={field.id}>
              {field.type !== "checkbox" && commonLabel}
              {field.type === "text" || field.type === "email" ? (
                <input
                  id={field.id}
                  name={field.id}
                  type={field.type === "email" ? "email" : "text"}
                  className={commonInputClass}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                />
              ) : field.type === "textarea" ? (
                <textarea
                  id={field.id}
                  name={field.id}
                  className={commonInputClass}
                  rows={4}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                />
              ) : field.type === "select" ? (
                <select
                  id={field.id}
                  name={field.id}
                  className={commonInputClass}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                >
                  <option value="">Velg�</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    id={field.id}
                    name={field.id}
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-700"
                    checked={value === true}
                    onChange={(e) => handleChange(field.id, e.target.checked)}
                  />
                  <span>{field.label}</span>
                </label>
              ) : (
                <input
                  id={field.id}
                  name={field.id}
                  type="text"
                  className={commonInputClass}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                />
              )}
            </div>
          );
        })}

        <button
          type="submit"
          disabled={submitState.kind === "submitting"}
          className="inline-flex items-center rounded bg-slate-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitState.kind === "submitting" ? "Sender�" : schema.submitLabel ?? "Send"}
        </button>

        {submitState.kind === "success" && (
          <p className="text-sm text-emerald-700">{submitState.message}</p>
        )}
        {submitState.kind === "error" && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p>{submitState.message}</p>
            {submitState.errors && submitState.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {submitState.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

