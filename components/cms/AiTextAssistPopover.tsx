"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EDITOR_REWRITE_PRESETS,
  fetchEditorRewrite,
  type EditorRewritePreset,
} from "@/lib/ai/editorRewrite";
import { recordEditorRewritePreset } from "@/lib/cms/editorPersonalization";
import { stripHtmlForAssist } from "@/lib/cms/editorSmartHints";

export type AiTextAssistPopoverProps = {
  value: string;
  onApply: (next: string) => void;
  disabled?: boolean;
  /** Rich HTML fields: send plain text to rewrite; result replaces field as plain text. */
  stripHtmlBeforeSend?: boolean;
  /** Accessible name for the trigger */
  fieldLabel?: string;
};

/**
 * ✨ Inline AI assist: opens curated intents, fetches suggestion, user accepts explicitly.
 */
export function AiTextAssistPopover({
  value,
  onApply,
  disabled,
  stripHtmlBeforeSend,
  fieldLabel = "Tekstfelt",
}: AiTextAssistPopoverProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ text: string; preset: EditorRewritePreset } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const sourceText = stripHtmlBeforeSend ? stripHtmlForAssist(value) : value;

  const runPreset = useCallback(
    async (preset: EditorRewritePreset) => {
      setError(null);
      setPreview(null);
      setBusy(true);
      try {
        const out = await fetchEditorRewrite(sourceText, preset);
        if (out.ok === false) {
          setError(out.message);
          return;
        }
        setPreview({ text: out.text, preset: out.preset });
      } finally {
        setBusy(false);
      }
    },
    [sourceText],
  );

  const applyPreview = useCallback(() => {
    if (!preview) return;
    onApply(preview.text);
    recordEditorRewritePreset(preview.preset.id);
    setPreview(null);
    setOpen(false);
    setError(null);
  }, [preview, onApply]);

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          setOpen((o) => !o);
          setError(null);
          setPreview(null);
        }}
        className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-pink-400/35 bg-white text-sm leading-none text-pink-600 shadow-sm transition hover:border-pink-500/50 hover:bg-pink-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/35 disabled:cursor-not-allowed disabled:opacity-50"
        title="AI-forslag (du godkjenner selv)"
        aria-label={`AI-assistent for ${fieldLabel}`}
        aria-expanded={open}
      >
        <span aria-hidden>✨</span>
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,18rem)] rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3 shadow-lg"
          role="dialog"
          aria-label="AI-forslag"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">Forslag (velg)</p>
          <p className="mt-1 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
            Ingenting endres før du trykker «Bruk forslag». Vi bruker trygg, lokal omskriving.
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {EDITOR_REWRITE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy || !sourceText.trim()}
                onClick={() => void runPreset(p)}
                className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-2 py-1.5 text-left text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-pink-50/50 disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          {busy ? <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Henter forslag…</p> : null}
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          {preview ? (
            <div className="mt-3 rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-2">
              <p className="text-[10px] font-medium text-emerald-900">{preview.preset.explain}</p>
              <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-xs text-[rgb(var(--lp-text))]">
                {preview.text}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyPreview}
                  className="rounded-lg bg-pink-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-pink-700"
                >
                  Bruk forslag
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-lg border border-[rgb(var(--lp-border))] px-2.5 py-1 text-xs font-medium text-[rgb(var(--lp-text))]"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
