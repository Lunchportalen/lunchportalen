"use client";

type PageStatus = "draft" | "published";

export type ContentInfoPanelPage = {
  id: string;
  slug: string;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

export type ContentInfoPanelProps = {
  page: ContentInfoPanelPage | null;
  statusLabel: PageStatus;
  isForsidePage: () => boolean;
  formatDate: (value: string | null | undefined) => string;
};

export function ContentInfoPanel({
  page,
  statusLabel,
  isForsidePage,
  formatDate,
}: ContentInfoPanelProps) {
  return (
    <aside className="sticky top-20 self-start rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 py-3 text-sm">
      <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Info</h2>
      <dl className="mt-3 space-y-2">
        <div>
          <dt className="text-xs text-[rgb(var(--lp-muted))]">Node-ID</dt>
          <dd className="text-sm text-[rgb(var(--lp-text))]">{page?.id ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[rgb(var(--lp-muted))]">Slug</dt>
          <dd className="text-sm text-[rgb(var(--lp-text))]">{page?.slug || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[rgb(var(--lp-muted))]">Status</dt>
          <dd className="text-sm text-[rgb(var(--lp-text))]">
            {statusLabel === "published" ? "Publisert" : "Kladd"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[rgb(var(--lp-muted))]">Opprettet</dt>
          <dd className="text-sm text-[rgb(var(--lp-text))]">
            {formatDate(page?.created_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[rgb(var(--lp-muted))]">Sist oppdatert</dt>
          <dd className="text-sm text-[rgb(var(--lp-text))]">
            {formatDate(page?.updated_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[rgb(var(--lp-muted))]">Publisert</dt>
          <dd className="text-sm text-[rgb(var(--lp-text))]">
            {formatDate(page?.published_at)}
          </dd>
        </div>
        {isForsidePage() && (
          <div className="mt-1 rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2">
            <p className="text-xs font-medium text-[rgb(var(--lp-text))]">
              Systemnode – kan ikke slettes
            </p>
          </div>
        )}
      </dl>
    </aside>
  );
}

