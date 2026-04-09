"use client";

// STATUS: KEEP

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

const INSERT_AI_BLOCK_TYPES = [
  { type: "richText", label: "Tekstseksjon", description: "Brødtekst med overskrift" },
  { type: "hero", label: "Hero", description: "Toppseksjon med overskrift, bilde og CTA" },
  { type: "cta", label: "CTA", description: "Oppfordring med tittel, tekst og knapp" },
  { type: "image", label: "Bilde", description: "Bilde med alt-tekst" },
  { type: "divider", label: "Skillelinje", description: "Visuell inndeling" },
] as const;

export type InsertAiBlockType = (typeof INSERT_AI_BLOCK_TYPES)[number]["type"];

type InsertAiBlockModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (context: string, blockType: string) => void;
  busy?: boolean;
};

export function InsertAiBlockModal({
  open,
  onClose,
  onInsert,
  busy = false,
}: InsertAiBlockModalProps) {
  const [context, setContext] = useState("");
  const [blockType, setBlockType] = useState<InsertAiBlockType>("richText");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setContext("");
      setBlockType("richText");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    onInsert(context.trim() || "Ny seksjon", blockType);
  };

  return (
    <div
      className="lp-motion-overlay lp-glass-overlay fixed inset-0 z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Sett inn AI-generert blokk"
    >
      <div
        className="lp-motion-card lp-glass-panel max-h-[85vh] w-full max-w-md rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgb(var(--lp-border))] px-4 py-3">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">
            Sett inn AI-generert blokk
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            aria-label="Lukk"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
        <div className="space-y-4 px-4 py-3">
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Beskriv innholdet eller la feltet stå tomt for en standard blokk. Blokken settes inn
            nederst i listen.
          </p>
          <div>
            <label htmlFor="insert-ai-block-context" className="sr-only">
              Beskrivelse av blokken
            </label>
            <textarea
              id="insert-ai-block-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="F.eks. Introduksjon til våre tjenester, rolig tone"
              rows={3}
              disabled={busy}
              className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))] placeholder:text-[rgb(var(--lp-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))] disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="insert-ai-block-type" className="mb-1 block text-xs font-medium text-[rgb(var(--lp-text))]">
              Blokktype
            </label>
            <select
              id="insert-ai-block-type"
              value={blockType}
              onChange={(e) => setBlockType(e.target.value as InsertAiBlockType)}
              disabled={busy}
              className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))] disabled:opacity-50"
            >
              {INSERT_AI_BLOCK_TYPES.map((opt) => (
                <option key={opt.type} value={opt.type}>
                  {opt.label} – {opt.description}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="flex-1 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-text))] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
              aria-label="Sett inn blokk"
            >
              {busy ? "Setter inn…" : "Sett inn blokk"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
