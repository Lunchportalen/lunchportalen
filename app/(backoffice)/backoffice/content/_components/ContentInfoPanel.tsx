"use client";

import type { PageStatus } from "./contentTypes";

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
    <aside className="lp-glass-panel lp-motion-card sticky top-20 self-start rounded-lg px-4 py-3 text-sm">
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
          <dt className="text-xs text-[rgb(var(--lp-muted))]">Sist publisert</dt>
          <dd className="text-sm text-[rgb(var(--lp-text))]">
            {formatDate(page?.published_at)}
          </dd>
        </div>
        {statusLabel === "published" ? (
          <div className="mt-1 rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 space-y-1">
            <p className="text-xs text-[rgb(var(--lp-text))]">
              Det som vises på nettsiden nå = innhold da siden ble sist publisert.
            </p>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              For å ta siden ut av live: bruk «Sett til kladd» i topplinjen. Systemet har ikke versjonshistorikk – avpublisering er ikke rollback til en tidligere versjon.
            </p>
          </div>
        ) : statusLabel === "draft" ? (
          <div className="mt-1 rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2">
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Kladd er ikke synlig på nettsiden. Publiser for å gjøre endringene live.
            </p>
          </div>
        ) : null}
        {isForsidePage() && (
          <div className="mt-1 rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2">
            <p className="text-xs font-medium text-[rgb(var(--lp-text))]">
              Systemnode – kan ikke slettes
            </p>
          </div>
        )}
        <div className="mt-3 rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-3 py-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
            Hva systemet støtter
          </h3>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-[rgb(var(--lp-muted))]">
            <li>Media: opplasting, valg i blokk, alt fra arkiv for bilde- og hero-blokk</li>
            <li>Workflow: kladd / publisert</li>
            <li>Publisering: publiser eller sett til kladd; ingen versjonshistorikk</li>
            <li>AI: diagnostikk, SEO, side-/blokk-generering, referanse→blokker, bilde til mediearkiv</li>
          </ul>
        </div>
      </dl>
    </aside>
  );
}

