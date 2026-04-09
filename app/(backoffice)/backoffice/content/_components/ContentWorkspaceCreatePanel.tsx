"use client";

// STATUS: KEEP

import { getDocType } from "./_stubs";
import { normalizeSlug } from "./contentWorkspace.helpers";

export type ContentWorkspaceCreatePanelProps = {
  open: boolean;
  onClose: () => void;
  mode: "choose" | "form";
  onModeChoose: () => void;
  onModeForm: (alias: string) => void;
  selectedParentId: string | null;
  parentLoading: boolean;
  allowedChildTypes: string[];
  documentTypeAlias: string | null;
  createTitle: string;
  setCreateTitle: (v: string) => void;
  createSlug: string;
  setCreateSlug: (v: string) => void;
  setCreateSlugTouched: (v: boolean) => void;
  createError: string | null;
  creating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
};

export function ContentWorkspaceCreatePanel({
  open,
  onClose,
  mode,
  onModeChoose,
  onModeForm,
  selectedParentId,
  parentLoading,
  allowedChildTypes,
  documentTypeAlias,
  createTitle,
  setCreateTitle,
  createSlug,
  setCreateSlug,
  setCreateSlugTouched,
  createError,
  creating,
  onSubmit,
  onBack,
}: ContentWorkspaceCreatePanelProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="lp-motion-overlay lp-glass-overlay fixed inset-0 z-40 md:z-30"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="lp-glass-panel lp-motion-overlay fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col md:z-40"
        role="dialog"
        aria-labelledby="create-panel-title"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="create-panel-title" className="text-sm font-semibold text-slate-800">
            Opprett
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Lukk"
          >
            –
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-4 text-sm text-slate-600">
            {selectedParentId ? "Opprett undernode under valgt side." : "Opprett ny side."}
          </p>
          {mode === "choose" ? (
            <>
              {parentLoading ? (
                <p className="text-sm text-slate-500">Laster tillatte typer…</p>
              ) : allowedChildTypes.length === 0 ? (
                <p className="text-sm text-slate-500">Tilordne dokumenttype til forelder for å opprette undernoder, eller velg en forelder.</p>
              ) : null}
              {allowedChildTypes.map((alias) => {
                const dt = getDocType(alias);
                const name = dt?.name ?? alias;
                return (
                  <button
                    key={alias}
                    type="button"
                    onClick={() => onModeForm(alias)}
                    className="lp-motion-card mb-3 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-slate-200 bg-white p-6 text-left hover:border-slate-300 hover:bg-slate-50"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-2xl text-slate-600">
                      ⊞
                    </span>
                    <span className="font-medium text-slate-800">{name}</span>
                    <span className="text-xs text-slate-500">
                      Opprett en ny side med typen «{name}».
                    </span>
                  </button>
                );
              })}
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Avbryt
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Tittel</span>
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="F.eks. Kontakt"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Slug</span>
                <input
                  value={createSlug}
                  onChange={(e) => {
                    setCreateSlugTouched(true);
                    setCreateSlug(e.target.value);
                  }}
                  onBlur={() => setCreateSlug(normalizeSlug(createSlug))}
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="kontakt"
                />
              </label>
              {createError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {createError}
                </div>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Tilbake
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="min-h-[40px] flex-1 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {creating
                    ? "Oppretter…"
                    : `Opprett ${documentTypeAlias ? (getDocType(documentTypeAlias)?.name ?? documentTypeAlias) : "side"}`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
