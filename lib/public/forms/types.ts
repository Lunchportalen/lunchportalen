/**
 * Phase 21: Form schema types. Shared by validate and API.
 */

export type FormFieldType = "text" | "email" | "textarea" | "select" | "checkbox";

export type FormFieldBase = {
  id: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  options?: { value: string; label: string }[];
};

export type FormSchema = {
  version: 1;
  fields: FormFieldBase[];
  submitLabel?: string;
  successMessage?: string;
  honeypotId?: string;
};
