"use client";

/**
 * Usikrede navigasjonsendringer — ren shell-banner (samme tekst og knapper som før).
 */

export type ContentWorkspacePendingNavigationBannerProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

export function ContentWorkspacePendingNavigationBanner(props: ContentWorkspacePendingNavigationBannerProps) {
  const { onConfirm, onCancel } = props;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
    >
      <p className="min-w-0 flex-1 font-medium">Du har usikrede endringer. Vil du forlate siden?</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-[40px] rounded-lg border border-amber-600 bg-amber-600 px-3 text-sm font-medium text-white hover:bg-amber-700"
        >
          Ja
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}
