"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Icon } from "@/components/ui/Icon";
import { getBlockFieldSchema, hasSchemaForBlockType } from "./blockFieldSchemas";
import { SchemaDrivenBlockForm } from "./SchemaDrivenBlockForm";
import type { EditorBlockFieldSchema } from "./blockFieldSchemas";

export type EditableBlock = {
  id: string;
  type: string;
} & Record<string, unknown>;

type BlockEditModalProps = {
  open: boolean;
  block: EditableBlock | null;
  blockIndex: number | null;
  onClose: () => void;
  onChange: (next: EditableBlock) => void;
  onDelete: () => void;
};

function validateBlock(
  block: EditableBlock,
  schema: EditorBlockFieldSchema[]
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of schema) {
    const value = String((block as Record<string, unknown>)[field.key] ?? "").trim();
    if (field.required && !value) errors[field.key] = "Påkrevd felt.";
    else if (field.maxLength != null && value.length > field.maxLength)
      errors[field.key] = `Maks ${field.maxLength} tegn.`;
    else if (field.kind === "url" && value) {
      if (!value.startsWith("http") && !value.startsWith("/"))
        errors[field.key] = "Skriv en gyldig URL eller bane.";
    }
  }
  return errors;
}

export function BlockEditModal({
  open,
  block,
  blockIndex,
  onClose,
  onChange,
  onDelete,
}: BlockEditModalProps) {
  const [draft, setDraft] = useState<EditableBlock | null>(null);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showRawJson, setShowRawJson] = useState(false);

  const blockType = block?.type ?? null;
  const schema = useMemo(
    () => (blockType ? getBlockFieldSchema(blockType) : []),
    [blockType]
  );
  const useSchemaForm = block && schema.length > 0 && !showRawJson;

  useEffect(() => {
    if (!open || !block) return;
    setDraft({ ...block });
    setJsonError(null);
    setFieldErrors({});
    setShowRawJson(false);
    try {
      setJsonDraft(JSON.stringify(block, null, 2));
    } catch {
      setJsonDraft('{"id":"","type":"richText"}');
    }
  }, [open, block]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleSchemaSave = useCallback(() => {
    if (!draft || !block) return;
    const errors = validateBlock(draft, schema);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onChange(draft);
    onClose();
  }, [draft, block, schema, onChange, onClose]);

  const handleJsonSave = useCallback(() => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(jsonDraft) as EditableBlock;
      if (!parsed || typeof parsed !== "object") {
        setJsonError("Blokken må være et gyldig objekt.");
        return;
      }
      if (typeof parsed.id !== "string" || !parsed.id.trim()) {
        setJsonError('Feltet "id" må være en ikke-tom streng.');
        return;
      }
      if (typeof parsed.type !== "string" || !parsed.type.trim()) {
        setJsonError('Feltet "type" må være en ikke-tom streng.');
        return;
      }
      if (parsed.type !== block?.type) {
        setJsonError('Blokkens "type" kan ikke endres her. Opprett en ny blokk for annen type.');
        return;
      }
      onChange(parsed);
      onClose();
    } catch (e) {
      setJsonError(
        e instanceof Error ? `Ugyldig JSON: ${e.message}` : "Ugyldig JSON. Kontroller strukturen."
      );
    }
  }, [jsonDraft, block?.type, onChange, onClose]);

  if (!open || !block) return null;

  return (
    <div
      className="lp-motion-overlay lp-glass-overlay fixed inset-0 z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Rediger blokk"
    >
      <div
        className="lp-motion-card lp-glass-panel flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgb(var(--lp-border))] px-4 py-3">
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">
              Rediger blokk
            </h2>
            <p className="text-[11px] text-[rgb(var(--lp-muted))]">
              {useSchemaForm
                ? "Fyll ut feltene under. Endringer lagres når du trykker Lagre."
                : "JSON-representasjon. Endringer oppdaterer blokken ved Lagre."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            aria-label="Lukk"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
        <div className="flex items-center justify-between border-b border-[rgb(var(--lp-border))] px-4 py-2 text-[11px] text-[rgb(var(--lp-muted))]">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <span className="rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-2 py-0.5 font-mono text-[10px] text-[rgb(var(--lp-text))]">
              #{(blockIndex ?? 0) + 1}
            </span>
            <span className="font-mono text-[rgb(var(--lp-text))]">id: {block.id}</span>
            <span className="font-mono text-[rgb(var(--lp-text))]">type: {block.type}</span>
            {hasSchemaForBlockType(block.type) && (
              <button
                type="button"
                onClick={() => setShowRawJson((v) => !v)}
                className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-0.5 text-[10px] hover:bg-[rgb(var(--lp-card))]"
              >
                {showRawJson ? "Vis skjemafelter" : "Avansert: vis JSON"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Slett blokk
          </button>
        </div>
        {(jsonError || Object.keys(fieldErrors).length > 0) && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
            {jsonError ?? Object.values(fieldErrors).join(" ")}
          </div>
        )}
        <div className="flex-1 overflow-auto px-4 py-3">
          {useSchemaForm && draft ? (
            <SchemaDrivenBlockForm
              block={draft}
              schema={schema}
              onChange={setDraft}
              errors={fieldErrors}
              onValidate={(key, msg) =>
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  if (msg) next[key] = msg;
                  else delete next[key];
                  return next;
                })
              }
            />
          ) : (
            <>
              <textarea
                className="h-full min-h-[280px] w-full rounded border border-[rgb(var(--lp-border))] bg-slate-50 px-3 py-2 text-xs font-mono text-[rgb(var(--lp-text))]"
                value={jsonDraft}
                onChange={(e) => setJsonDraft(e.target.value)}
                spellCheck={false}
              />
              <p className="mt-2 text-[10px] text-[rgb(var(--lp-muted))]">
                Hold strukturen enkel. id og type må være gyldige.
              </p>
            </>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] px-4 py-2">
          <p className="text-[10px] text-[rgb(var(--lp-muted))]">
            {useSchemaForm ? "Feltene matcher blokktypen. Lagre for å overføre til editoren." : null}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="lp-motion-btn rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={useSchemaForm ? handleSchemaSave : handleJsonSave}
              className="lp-motion-btn rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            >
              Lagre blokk
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
