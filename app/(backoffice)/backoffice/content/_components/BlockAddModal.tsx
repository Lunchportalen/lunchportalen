"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";

type BlockAddModalProps<TType extends string = string> = {
  open: boolean;
  onClose: () => void;
  onAdd: (type: TType) => void;
};

const BLOCK_OPTIONS: { type: string; label: string; description: string }[] = [
  {
    type: "hero",
    label: "Hero",
    description: "Stor toppseksjon med overskrift, tekst, bilde og CTA.",
  },
  {
    type: "richText",
    label: "Tekstseksjon",
    description: "Vanlig brødtekst med overskrift.",
  },
  {
    type: "image",
    label: "Bilde",
    description: "Enkelt bilde fra mediearkivet.",
  },
  {
    type: "cta",
    label: "CTA / Knappe-seksjon",
    description: "Kort seksjon med tittel, tekst og knapp.",
  },
  {
    type: "banners",
    label: "Bannere",
    description: "En eller flere bannere/hero-varianter.",
  },
  {
    type: "divider",
    label: "Skillelinje",
    description: "Visuell inndeling mellom seksjoner.",
  },
  {
    type: "code",
    label: "Kode",
    description: "Teknisk innhold eller embed i kodeblokk.",
  },
];

export function BlockAddModal<TType extends string = string>({
  open,
  onClose,
  onAdd,
}: BlockAddModalProps<TType>) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const handlePick = (type: string) => {
    onAdd(type as TType);
    onClose();
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Legg til blokk"
      onClick={onClose}
    >
      <div
        className="lp-motion-overlay lp-glass-overlay absolute inset-0"
        aria-hidden="true"
      />
      <div
        className="lp-motion-card lp-glass-panel relative z-[81] max-h-[80vh] w-full max-w-md rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgb(var(--lp-border))] px-4 py-3">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Legg til blokk</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            aria-label="Lukk"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
        <div className="divide-y divide-[rgb(var(--lp-border))]">
          <div className="px-4 py-2 text-xs text-[rgb(var(--lp-muted))]">
            Velg hvilken type blokk du vil legge til. Valget oppretter en ekte blokk i listen – ingen
            lokal fake state.
          </div>
          <div className="max-h-[60vh] overflow-auto px-2 py-2">
            <ul className="space-y-2">
              {BLOCK_OPTIONS.map((option) => (
                <li key={option.type}>
                  <button
                    type="button"
                    onClick={() => handlePick(option.type)}
                    className="lp-motion-card flex w-full flex-col items-start rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 text-left text-xs hover:border-slate-300 hover:bg-white hover:shadow-[var(--lp-shadow-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
                  >
                    <span className="text-sm font-medium text-[rgb(var(--lp-text))]">
                      {option.label}
                    </span>
                    <span className="mt-0.5 text-[11px] text-[rgb(var(--lp-muted))]">
                      {option.description}
                    </span>
                    <span className="mt-1 text-[10px] font-mono text-[rgb(var(--lp-muted))]">
                      type: {option.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

