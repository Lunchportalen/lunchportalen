"use client";

import { useState, useCallback } from "react";
import type { EditorBlockFieldSchema } from "./blockFieldSchemas";
import type { EditableBlock } from "./BlockEditModal";

const EMPTY: Record<string, string> = {};

function safeStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return String(v).trim();
}

function fieldValue(block: EditableBlock, key: string): string {
  const v = (block as Record<string, unknown>)[key];
  if (v === true) return "true";
  if (v === false) return "false";
  return safeStr(v);
}

/** Simple URL check: allow path or http(s). */
function looksLikeUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (t.startsWith("http://") || t.startsWith("https://")) return true;
  if (t.startsWith("/")) return true;
  return false;
}

function validateField(
  schema: EditorBlockFieldSchema,
  value: string,
  block: EditableBlock
): string | null {
  const trimmed = value.trim();
  if (schema.required && !trimmed) return "Påkrevd felt.";
  if (schema.maxLength != null && trimmed.length > schema.maxLength) {
    return `Maks ${schema.maxLength} tegn (${trimmed.length}).`;
  }
  if (schema.kind === "url" && trimmed && !looksLikeUrl(trimmed)) {
    return "Skriv en gyldig URL eller bane (f.eks. https://... eller /path/).";
  }
  if (schema.kind === "select" && schema.options && !(trimmed in schema.options)) {
    const first = Object.keys(schema.options)[0];
    if (first !== undefined && !trimmed) return null;
    if (trimmed) return "Velg en gyldig verdi.";
  }
  return null;
}

type SchemaDrivenBlockFormProps = {
  block: EditableBlock;
  schema: EditorBlockFieldSchema[];
  onChange: (next: EditableBlock) => void;
  errors?: Record<string, string>;
  onValidate?: (key: string, message: string | null) => void;
};

export function SchemaDrivenBlockForm({
  block,
  schema,
  onChange,
  errors = EMPTY,
  onValidate,
}: SchemaDrivenBlockFormProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const update = useCallback(
    (key: string, value: string | number) => {
      const next = { ...block, [key]: value } as EditableBlock;
      onChange(next);
      const msg = validateField(
        schema.find((f) => f.key === key)!,
        String(value),
        next
      );
      onValidate?.(key, msg ?? null);
    },
    [block, onChange, schema, onValidate]
  );

  const handleBlur = useCallback(
    (key: string) => {
      setTouched((t) => ({ ...t, [key]: true }));
      const field = schema.find((f) => f.key === key);
      if (!field) return;
      const value = fieldValue(block, key);
      const msg = validateField(field, value, block);
      onValidate?.(key, msg ?? null);
    },
    [block, schema, onValidate]
  );

  return (
    <div className="grid gap-3">
      {schema.map((field) => {
        const value = fieldValue(block, field.key);
        const error = errors[field.key] ?? null;
        const id = `block-field-${field.key}`;

        if (field.kind === "textarea") {
          return (
            <label key={field.key} className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--lp-muted))]">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <textarea
                id={id}
                value={value}
                onChange={(e) => update(field.key, e.target.value)}
                onBlur={() => handleBlur(field.key)}
                placeholder={field.placeholder}
                maxLength={field.maxLength ?? undefined}
                className={`min-h-24 rounded-lg border px-3 py-2 text-sm ${
                  error ? "border-amber-400 bg-amber-50/50" : "border-[rgb(var(--lp-border))]"
                }`}
              />
              {error && <p className="text-xs text-amber-700" role="alert">{error}</p>}
            </label>
          );
        }

        if (field.kind === "select") {
          const options = field.options ?? {};
          return (
            <label key={field.key} className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--lp-muted))]">{field.label}</span>
              <select
                id={id}
                value={value || Object.keys(options)[0]}
                onChange={(e) => update(field.key, e.target.value)}
                onBlur={() => handleBlur(field.key)}
                className={`h-10 rounded-lg border px-3 text-sm ${
                  error ? "border-amber-400 bg-amber-50/50" : "border-[rgb(var(--lp-border))]"
                }`}
              >
                {Object.entries(options).map(([optValue, label]) => (
                  <option key={optValue} value={optValue}>
                    {label}
                  </option>
                ))}
              </select>
              {error && <p className="text-xs text-amber-700" role="alert">{error}</p>}
            </label>
          );
        }

        if (field.kind === "number") {
          const num = value === "" ? "" : Number(value);
          return (
            <label key={field.key} className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--lp-muted))]">{field.label}</span>
              <input
                id={id}
                type="number"
                value={num}
                onChange={(e) => {
                  const v = e.target.value;
                  update(field.key, v === "" ? "" : Number(v));
                }}
                onBlur={() => handleBlur(field.key)}
                placeholder={field.placeholder}
                className={`h-10 rounded-lg border px-3 text-sm ${
                  error ? "border-amber-400 bg-amber-50/50" : "border-[rgb(var(--lp-border))]"
                }`}
              />
              {error && <p className="text-xs text-amber-700" role="alert">{error}</p>}
            </label>
          );
        }

        return (
          <label key={field.key} className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">
              {field.label}
              {field.required ? " *" : ""}
            </span>
            <input
              id={id}
              type={field.kind === "url" ? "url" : "text"}
              value={value}
              onChange={(e) => update(field.key, e.target.value)}
              onBlur={() => handleBlur(field.key)}
              placeholder={field.placeholder}
              maxLength={field.maxLength ?? undefined}
              className={`h-10 rounded-lg border px-3 text-sm ${
                error ? "border-amber-400 bg-amber-50/50" : "border-[rgb(var(--lp-border))]"
              }`}
            />
            {field.maxLength != null && !error && (
              <span className="text-[10px] text-[rgb(var(--lp-muted))]">
                {value.length}/{field.maxLength}
              </span>
            )}
            {error && <p className="text-xs text-amber-700" role="alert">{error}</p>}
          </label>
        );
      })}
    </div>
  );
}
