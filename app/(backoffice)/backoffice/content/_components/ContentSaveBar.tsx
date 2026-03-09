"use client";

export type ContentSaveBarProps = {
  selectedId: string;
  saving: boolean;
  canSave: boolean;
  onSaveAndPreview: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
};

export function ContentSaveBar({
  selectedId,
  saving,
  canSave,
  onSaveAndPreview,
  onSave,
}: ContentSaveBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[rgb(var(--lp-border))] bg-white px-3 py-2">
      <button
        type="button"
        onClick={() => void onSaveAndPreview()}
        disabled={!selectedId || saving}
        className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Lagre og forhåndsvis
      </button>
      <button
        type="button"
        onClick={() => void onSave()}
        disabled={!canSave}
        className="min-h-[40px] rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Lagre
      </button>
    </div>
  );
}

