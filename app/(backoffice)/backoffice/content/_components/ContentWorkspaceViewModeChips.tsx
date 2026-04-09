"use client";

import type { MainWorkspaceView } from "./useContentWorkspaceShell";

type Props = {
  mainView: MainWorkspaceView;
  onOpenGlobal: () => void;
  onOpenDesign: () => void;
};

/**
 * Sidebar row: Global + Design + Recycle Bin (same level as Hjem block in parent).
 * Extracted so ContentWorkspace.tsx does not own this composition chunk inline.
 */
export function ContentWorkspaceViewModeChips({ mainView, onOpenGlobal, onOpenDesign }: Props) {
  return (
    <>
      <div
        className={`flex items-center gap-1 rounded-lg border ${mainView === "global" ? "border-rose-200 bg-rose-50/90" : "border-slate-200/80 bg-white"}`}
      >
        <button
          type="button"
          onClick={onOpenGlobal}
          className="flex min-h-10 flex-1 items-center gap-2 rounded-l-lg px-2 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
          aria-current={mainView === "global" ? "true" : undefined}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-600" aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </span>
          <span className="flex-1 font-medium">Global</span>
        </button>
        <button
          type="button"
          onClick={onOpenGlobal}
          className="flex min-h-10 min-w-10 items-center justify-center rounded-r-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Å Global i hovedvinduet"
          title="Å Global"
        >
          <span className="text-lg leading-none">+</span>
        </button>
      </div>

      <div
        className={`flex items-center gap-1 rounded-lg border ${mainView === "design" ? "border-rose-200 bg-rose-50/90" : "border-slate-200/80 bg-white"}`}
      >
        <button
          type="button"
          onClick={onOpenDesign}
          className="flex min-h-10 flex-1 items-center gap-2 rounded-l-lg px-2 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
          title="Design"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-violet-600" aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M16 3h5v5" />
              <path d="M8 3H3v5" />
              <path d="M3 16v5h5" />
              <path d="M21 16v5h-5" />
              <path d="M4 4 9 9" />
              <path d="m15 9 5-5" />
              <path d="m4 20 5-5" />
              <path d="m15 15 5 5" />
            </svg>
          </span>
          <span className="flex-1 font-medium">Design</span>
        </button>
        <button
          type="button"
          onClick={onOpenDesign}
          className="flex min-h-10 min-w-10 items-center justify-center rounded-r-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Å Design"
          title="Å Design"
        >
          <span className="text-lg leading-none">+</span>
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white">
        <button
          type="button"
          className="flex min-h-10 flex-1 items-center gap-2 rounded-l-lg px-2 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
          title="Papirkurv (kommer senere)"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-600" aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </span>
          <span className="flex-1 font-medium">Recycle Bin</span>
        </button>
      </div>
    </>
  );
}
