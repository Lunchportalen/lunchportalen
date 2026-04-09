"use client";

import * as ShellUi from "./contentWorkspaceShellUiConstants";

export type ContentWorkspaceGlobalReusableShellProps = {
  exitGlobalSubView: () => void;
};

/**
 * Global workspace » Reusable Components: liste over placeholder-grupper og lagre-linje.
 * Props-only presentasjon; state eies i `ContentWorkspace.tsx`.
 */
export function ContentWorkspaceGlobalReusableShell({ exitGlobalSubView }: ContentWorkspaceGlobalReusableShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => exitGlobalSubView()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Tilbake til Global"
          >
            –
          </button>
          <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">Reusable Components</h1>
        </div>
        <button
          type="button"
          className="hidden h-9 w-9 items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))] md:flex"
          aria-label="Søk"
        >
          –
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="min-h-9 rounded-lg bg-[rgb(var(--lp-text))] px-4 text-sm font-medium text-white hover:bg-slate-900"
        >
          Create Component Group
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ShellUi.REUSABLE_COMPONENT_GROUPS_PLACEHOLDER.map((group) => (
          <article
            key={group.title}
            className="flex flex-col rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4"
          >
            <h2 className="text-base font-semibold text-[rgb(var(--lp-text))]">{group.title}</h2>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[rgb(var(--lp-muted))]">
              <div>
                <dt className="font-medium text-[rgb(var(--lp-text))]">Components</dt>
                <dd>{group.components}</dd>
              </div>
              <div>
                <dt className="font-medium text-[rgb(var(--lp-text))]">Status</dt>
                <dd>Published</dd>
              </div>
              <div>
                <dt className="font-medium text-[rgb(var(--lp-text))]">Last edited</dt>
                <dd>{group.updated}</dd>
              </div>
              <div>
                <dt className="font-medium text-[rgb(var(--lp-text))]">Updated by</dt>
                <dd>{group.createdBy}</dd>
              </div>
              <div>
                <dt className="font-medium text-[rgb(var(--lp-text))]">Created by</dt>
                <dd>{group.createdBy}</dd>
              </div>
            </dl>

            <div className="mt-3 flex gap-2">
              {Array.from({ length: group.components }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-16 flex-1 rounded-lg bg-slate-800"
                  aria-label="Komponentforhåndsvisning"
                />
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
        <p className="text-xs text-[rgb(var(--lp-muted))]">Global / Reusable Components</p>
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
