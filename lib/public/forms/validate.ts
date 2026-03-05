/**
 * Phase 21: Form schema normalization and submission validation. Server-only usage.
 */

import type { FormFieldBase, FormFieldType, FormSchema } from "./types";

const FIELD_TYPES: FormFieldType[] = ["text", "email", "textarea", "select", "checkbox"];

export function normalizeFormSchema(raw: unknown): FormSchema {
  if (raw == null || typeof raw !== "object") throw new Error("Invalid form schema: not an object");
  const o = raw as Record<string, unknown>;
  const version = o.version;
  if (version !== 1) throw new Error("Invalid form schema: version must be 1");
  const fieldsRaw = o.fields;
  if (!Array.isArray(fieldsRaw)) throw new Error("Invalid form schema: fields must be an array");
  const fields: FormFieldBase[] = [];
  for (let i = 0; i < fieldsRaw.length; i++) {
    const f = fieldsRaw[i];
    if (f == null || typeof f !== "object") throw new Error("Invalid form schema: field " + i + " invalid");
    const fr = f as Record<string, unknown>;
    const id = typeof fr.id === "string" ? fr.id : "f" + i;
    const type = FIELD_TYPES.includes(fr.type as FormFieldType) ? (fr.type as FormFieldType) : "text";
    const label = typeof fr.label === "string" ? fr.label : "Field " + (i + 1);
    const field: FormFieldBase = { id, type, label };
    if (typeof fr.required === "boolean") field.required = fr.required;
    if (typeof fr.minLength === "number" && fr.minLength >= 0) field.minLength = fr.minLength;
    if (typeof fr.maxLength === "number" && fr.maxLength >= 0) field.maxLength = fr.maxLength;
    if (type === "select" && Array.isArray(fr.options)) {
      field.options = fr.options
        .filter((x) => x != null && typeof x === "object" && typeof (x as any).value === "string")
        .map((x) => ({ value: String((x as any).value), label: typeof (x as any).label === "string" ? (x as any).label : String((x as any).value) }));
    }
    fields.push(field);
  }
  const schema: FormSchema = { version: 1, fields };
  if (typeof o.submitLabel === "string") schema.submitLabel = o.submitLabel;
  if (typeof o.successMessage === "string") schema.successMessage = o.successMessage;
  if (typeof o.honeypotId === "string") schema.honeypotId = o.honeypotId;
  return schema;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSubmission(
  schema: FormSchema,
  data: Record<string, unknown>
): { ok: true; cleaned: Record<string, unknown> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const cleaned: Record<string, unknown> = {};
  const fieldIds = new Set(schema.fields.map((f) => f.id));
  const honeypotId = schema.honeypotId ?? "_hp";

  for (const field of schema.fields) {
    const raw = data[field.id];
    const isEmpty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "") || (typeof raw === "boolean" && !raw);
    if (field.required && isEmpty) {
      errors.push(field.label + " er påkrevd");
      continue;
    }
    if (isEmpty && field.type !== "checkbox") {
      cleaned[field.id] = "";
      continue;
    }
    if (field.type === "checkbox") {
      cleaned[field.id] = raw === true || raw === "true" || raw === "on";
      continue;
    }
    const str = String(raw ?? "");
    if (field.minLength != null && str.length < field.minLength)
      errors.push(field.label + " må ha minst " + field.minLength + " tegn");
    if (field.maxLength != null && str.length > field.maxLength)
      errors.push(field.label + " kan ha maks " + field.maxLength + " tegn");
    if (field.type === "email" && str.length > 0 && !EMAIL_REGEX.test(str))
      errors.push(field.label + " må være en gyldig e-post");
    if (field.type === "select" && field.options?.length) {
      const values = field.options.map((o) => o.value);
      if (!values.includes(str)) errors.push(field.label + " må være ett av valgene");
    }
    cleaned[field.id] = str;
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, cleaned };
}
