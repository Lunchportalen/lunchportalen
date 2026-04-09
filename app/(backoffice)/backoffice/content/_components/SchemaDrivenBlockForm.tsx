"use client";

import { useCallback, useMemo } from "react";
import type { EditorBlockFieldSchema } from "./blockFieldSchemas";
import {
  getBlockFormLayout,
  isFieldRequiredForBlockType,
  validateEditorField,
} from "./blockFieldSchemas";
import type { EditableBlock } from "./BlockEditModal";
import { FieldRenderer } from "@/components/backoffice/FieldRenderer";

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

type SchemaDrivenBlockFormProps = {
  blockType: string;
  block: EditableBlock;
  schema: EditorBlockFieldSchema[];
  onChange: (next: EditableBlock) => void;
  errors?: Record<string, string>;
  onValidate?: (key: string, message: string | null) => void;
  onOpenMediaPicker?: (fieldKey: string) => void;
  onClearMediaField?: (fieldKey: string) => void;
  onOpenInternalLinkPicker?: (fieldKey: string) => void;
};

export function SchemaDrivenBlockForm({
  blockType,
  block,
  schema,
  onChange,
  errors = EMPTY,
  onValidate,
  onOpenMediaPicker,
  onClearMediaField,
  onOpenInternalLinkPicker,
}: SchemaDrivenBlockFormProps) {
  const layout = useMemo(() => getBlockFormLayout(blockType), [blockType]);

  const fieldByKey = useMemo(() => {
    const m = new Map<string, EditorBlockFieldSchema>();
    for (const f of schema) m.set(f.key, f);
    return m;
  }, [schema]);

  const groups = useMemo(() => {
    if (!layout?.groups?.length) return null;
    return layout.groups;
  }, [layout]);

  const update = useCallback(
    (key: string, value: string | number) => {
      const next = { ...block, [key]: value } as EditableBlock;
      onChange(next);
      const fieldSchema = schema.find((f) => f.key === key);
      if (!fieldSchema) return;
      const msg = validateEditorField(blockType, fieldSchema, next as Record<string, unknown>);
      onValidate?.(key, msg ?? null);
    },
    [block, onChange, schema, onValidate, blockType]
  );

  const applyPatch = useCallback(
    (patch: Record<string, string | number>) => {
      const next = { ...block, ...patch } as EditableBlock;
      onChange(next);
      const patched = new Set(Object.keys(patch));
      for (const field of schema) {
        if (
          patched.has(field.key) ||
          (field.linkKindKey != null && patched.has(field.linkKindKey))
        ) {
          const msg = validateEditorField(blockType, field, next as Record<string, unknown>);
          onValidate?.(field.key, msg ?? null);
        }
      }
    },
    [block, onChange, schema, onValidate, blockType]
  );

  const handleBlur = useCallback(
    (key: string) => {
      const field = schema.find((f) => f.key === key);
      if (!field) return;
      const value = fieldValue(block, key);
      const msg = validateEditorField(blockType, field, block as Record<string, unknown>);
      onValidate?.(key, msg ?? null);
    },
    [block, schema, onValidate, blockType]
  );

  const renderField = (field: EditorBlockFieldSchema) => {
    const value = fieldValue(block, field.key);
    const error = errors[field.key] ?? null;
    const id = `block-field-${field.key}`;
    const effReq = isFieldRequiredForBlockType(blockType, field.key, field);
    const linkKind =
      field.linkKindKey ? fieldValue(block, field.linkKindKey) : "";

    return (
      <FieldRenderer
        key={field.key}
        field={field}
        value={value}
        error={error}
        id={id}
        onChange={update}
        onBlur={handleBlur}
        effectiveRequired={effReq}
        linkKindValue={linkKind}
        onPatch={field.linkVariant === "dual" ? applyPatch : undefined}
        onOpenMediaPicker={field.kind === "media" ? onOpenMediaPicker : undefined}
        onClearMediaField={field.kind === "media" ? onClearMediaField : undefined}
        onOpenInternalLinkPicker={
          field.kind === "link" && field.linkVariant === "dual" ? onOpenInternalLinkPicker : undefined
        }
      />
    );
  };

  if (groups) {
    return (
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.name} className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-[rgb(var(--lp-text))]">{g.name}</h3>
            <div className="grid gap-3">
              {g.fields.map((fieldKey) => {
                const field = fieldByKey.get(fieldKey);
                if (!field) return null;
                return renderField(field);
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <div className="grid gap-3">{schema.map((field) => renderField(field))}</div>;
}
