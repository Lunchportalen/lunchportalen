/**
 * Locked typography + measure for CMS marketing copy stacks (optional primitive).
 * Prefer over ad-hoc heading/body classes inside new block components.
 */
export function CmsTextBlock({ title, subtitle }: { title?: string; subtitle?: string }) {
  if (!title?.trim() && !subtitle?.trim()) return null;
  return (
    <div className="max-w-xl space-y-4">
      {title?.trim() ?
        <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{title.trim()}</h2>
      : null}
      {subtitle?.trim() ?
        <p className="font-body text-lg text-[rgb(var(--lp-muted))]">{subtitle.trim()}</p>
      : null}
    </div>
  );
}
