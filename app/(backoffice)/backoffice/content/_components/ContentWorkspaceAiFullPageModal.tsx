"use client";

import type { Block } from "./editorBlockTypes";
import { LivePreviewPanel } from "./LivePreviewPanel";

export type ContentWorkspaceAiFullPageModalProps = {
  open: boolean;
  onClose: () => void;
  prompt: string;
  onPromptChange: (v: string) => void;
  busy: boolean;
  error: string | null;
  preview: { title: string; blocksRaw: unknown[] } | null;
  previewBlocks: Block[];
  replaceOk: boolean;
  onReplaceOkChange: (v: boolean) => void;
  alsoTitle: boolean;
  onAlsoTitleChange: (v: boolean) => void;
  onGenerate: () => void | Promise<void>;
  onApply: () => void;
};

/**
 * Full-page AI draft modal (preview-only; same LivePreviewPanel path as editor).
 * Full-page state fra `useContentWorkspacePageDraftAi` (komponert via `useContentWorkspacePanelRequests`) — ingen alternativ preview-pipeline.
 */
export function ContentWorkspaceAiFullPageModal(props: ContentWorkspaceAiFullPageModalProps) {
  const {
    open,
    onClose,
    prompt,
    onPromptChange,
    busy,
    error,
    preview,
    previewBlocks,
    replaceOk,
    onReplaceOkChange,
    alsoTitle,
    onAlsoTitleChange,
    onGenerate,
    onApply,
  } = props;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-full-page-dialog-title"
        className="flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-visible rounded-xl border border-[rgb(var(--lp-border))] bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--lp-border))] px-4 py-3">
          <h1 id="ai-full-page-dialog-title" className="text-lg font-semibold text-[rgb(var(--lp-text))]">
            Generer side med AI
          </h1>
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] rounded-lg text-sm text-[rgb(var(--lp-muted))] hover:bg-black/5"
            onClick={onClose}
            aria-label="Lukk"
          >
            Lukk
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <p className="text-sm text-[rgb(var(--lp-muted))]">
            Beskriv siden du vil ha. Resultatet vises som forhåndsvisning før du eventuelt bruker det i
            redigeringsfeltet. Lagrer eller publiserer ikke automatisk.
          </p>
          <label className="block text-xs font-medium text-[rgb(var(--lp-muted))]" htmlFor="ai-full-page-prompt">
            Prompt
          </label>
          <textarea
            id="ai-full-page-prompt"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            rows={4}
            disabled={busy}
            className="min-h-[100px] w-full rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 px-3 py-2 text-sm text-[rgb(var(--lp-text))] outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-60"
            placeholder="F.eks. landingsside for bedriftslunsj med hero, to tekstseksjoner og CTA…"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !prompt.trim()}
              onClick={() => void onGenerate()}
              className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]/80 disabled:opacity-50"
            >
              {busy ? "Genererer…" : "Generer forhåndsvisning"}
            </button>
          </div>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {preview ? (
            <div className="space-y-3 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                Forhåndsvisning
              </p>
              <div className="max-h-[min(48vh,420px)] overflow-y-auto overflow-x-hidden rounded-lg border border-[rgb(var(--lp-border))] bg-white/90 p-2">
                <LivePreviewPanel pageTitle={preview.title} blocks={previewBlocks} />
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-medium">Dette erstatter eksisterende blokker i redigeringsfeltet.</p>
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={replaceOk}
                    onChange={(e) => onReplaceOkChange(e.target.checked)}
                  />
                  <span>Jeg forstår at eksisterende innhold (blokkene) i redigeringsfeltet erstattes.</span>
                </label>
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={alsoTitle}
                    onChange={(e) => onAlsoTitleChange(e.target.checked)}
                  />
                  <span>Oppdater også sidetittel fra AI-forslaget.</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!replaceOk}
                  onClick={onApply}
                  className="min-h-[40px] rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  Bruk i redigeringsfeltet
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] px-4 text-sm font-medium text-[rgb(var(--lp-text))]"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
