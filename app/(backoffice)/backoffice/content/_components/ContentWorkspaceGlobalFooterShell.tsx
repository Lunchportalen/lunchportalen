"use client";

import type { Dispatch, SetStateAction } from "react";

export type ContentWorkspaceGlobalFooterShellProps = {
  exitGlobalSubView: () => void;
  footerTab: "content" | "advanced";
  setFooterTab: Dispatch<SetStateAction<"content" | "advanced">>;
};

/**
 * Global workspace » Footer: underfaner Content/Advanced og lagre-linje.
 * Props-only presentasjon; state eies i `ContentWorkspace.tsx` / overlays-hook.
 */
export function ContentWorkspaceGlobalFooterShell({
  exitGlobalSubView,
  footerTab,
  setFooterTab,
}: ContentWorkspaceGlobalFooterShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => exitGlobalSubView()}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Tilbake til Global"
        >
          –
        </button>
        <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Footer</h1>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[rgb(var(--lp-border))] pb-2">
        {(["content", "advanced"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFooterTab(tab)}
            className={`min-h-9 rounded-t-lg border px-3 text-sm font-medium ${footerTab === tab
              ? "border-[rgb(var(--lp-border))] border-b-0 bg-white text-[rgb(var(--lp-text))] -mb-px"
              : "border-transparent text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
              }`}
          >
            {tab === "content" ? "Content" : "Advanced"}
          </button>
        ))}
      </div>

      {footerTab === "content" ? (
        <div className="space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Footer items</p>
            <div className="space-y-2 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))]"
                >
                  <div className="h-14 w-24 rounded-lg bg-slate-800" aria-hidden />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[rgb(var(--lp-text))]">Code</p>
                    <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                      COMPONENT: CODE · COLUMN WIDTH: DESKTOP: 12 | TABLET: 12
                    </p>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="mt-1 flex h-11 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
              >
                Legg til innhold
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">Copyright message</span>
              <input
                type="text"
                placeholder="Melhus Catering Gruppen"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">Site credit label</span>
              <input
                type="text"
                className="mt-1 h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
              />
            </label>

            <div className="grid gap-1 text-sm">
              <span className="font-medium text-[rgb(var(--lp-text))]">Site credit link</span>
              <button
                type="button"
                className="mt-1 flex h-11 items-center justify-between rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
              >
                <span>Add</span>
                <span className="text-[11px] text-[rgb(var(--lp-muted))]">Add up to 1 items</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[rgb(var(--lp-text))]">Disable delete</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Hvis  ««Yes «» er valgt, vil forsøk på å slette denne noden blokkeres og en advarsel vises.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              YES
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
        <p className="text-xs text-[rgb(var(--lp-muted))]">Global / Footer</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-green-700 hover:bg-slate-50"
          >
            Save
          </button>
          <button
            type="button"
            className="min-h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
          >
            Save and publish
          </button>
        </div>
      </div>
    </div>
  );
}
