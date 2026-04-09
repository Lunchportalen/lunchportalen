"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";
import type { PageStatus } from "./contentTypes";
import type { StatusLineState } from "./types";

export type ContentInfoPanelPage = {
  id: string;
  slug: string;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

type InfoTab = "innhold" | "seo" | "innstillinger" | "avansert";

export type ContentInfoPanelProps = {
  page: ContentInfoPanelPage | null;
  statusLabel: PageStatus;
  isForsidePage: () => boolean;
  formatDate: (value: string | null | undefined) => string;
  /** Same object as top bar status (single source of truth). */
  editorStatusLine?: StatusLineState | null;
  /** Block fields from parent (single implementation; no duplicated logic). */
  blockInspectorSlot?: ReactNode;
};

export function ContentInfoPanel({
  page,
  statusLabel,
  isForsidePage,
  formatDate,
  editorStatusLine,
  blockInspectorSlot = null,
}: ContentInfoPanelProps) {
  const baseId = useId();
  const [tab, setTab] = useState<InfoTab>("innhold");

  const tabs: { id: InfoTab; label: string }[] = [
    { id: "innhold", label: "Innhold" },
    { id: "seo", label: "SEO" },
    { id: "innstillinger", label: "Innstillinger" },
    { id: "avansert", label: "Avansert" },
  ];

  return (
    <aside className="lp-glass-panel lp-motion-card sticky top-20 self-start rounded-lg px-4 py-3 text-sm">
      <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Egenskaper</h2>

      <div
        role="tablist"
        aria-label="Sideinformasjon"
        className="mt-3 flex flex-wrap gap-1 border-b border-[rgb(var(--lp-border))] pb-2"
      >
        {tabs.map((t) => {
          const selected = tab === t.id;
          const tabId = `${baseId}-tab-${t.id}`;
          const panelId = `${baseId}-panel-${t.id}`;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`min-h-[40px] rounded-md px-2.5 py-1.5 text-xs font-medium transition-[opacity,transform] duration-150 ${
                selected
                  ? "bg-white text-[rgb(var(--lp-text))] shadow-sm ring-1 ring-[rgb(var(--lp-border))]"
                  : "text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {tab === "innhold" ? (
          <div
            role="tabpanel"
            id={`${baseId}-panel-innhold`}
            aria-labelledby={`${baseId}-tab-innhold`}
            className="space-y-3"
          >
            {blockInspectorSlot ? (
              <div
                className="space-y-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/25 p-2"
                aria-label="Egenskaper for valgt blokk"
              >
                {blockInspectorSlot}
              </div>
            ) : null}
            <div
              className={
                blockInspectorSlot
                  ? "space-y-3 border-t border-[rgb(var(--lp-border))] pt-3"
                  : "space-y-3"
              }
            >
              {blockInspectorSlot ? (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  Side
                </p>
              ) : null}
            {editorStatusLine ? (
              <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  Redigeringsstatus
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${editorStatusLine.tone}`}>
                    {editorStatusLine.label}
                  </span>
                  {editorStatusLine.detail ? (
                    <span className="text-xs text-[rgb(var(--lp-muted))]">{editorStatusLine.detail}</span>
                  ) : null}
                </p>
              </div>
            ) : null}
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-[rgb(var(--lp-muted))]">Node-ID</dt>
                <dd className="text-sm text-[rgb(var(--lp-text))]">{page?.id ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[rgb(var(--lp-muted))]">Slug</dt>
                <dd className="text-sm text-[rgb(var(--lp-text))]">{page?.slug || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[rgb(var(--lp-muted))]">Publiseringsstatus</dt>
                <dd className="text-sm text-[rgb(var(--lp-text))]">
                  {statusLabel === "published" ? "Publisert" : "Kladd"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[rgb(var(--lp-muted))]">Opprettet</dt>
                <dd className="text-sm text-[rgb(var(--lp-text))]">{formatDate(page?.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[rgb(var(--lp-muted))]">Sist oppdatert</dt>
                <dd className="text-sm text-[rgb(var(--lp-text))]">{formatDate(page?.updated_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[rgb(var(--lp-muted))]">Sist publisert</dt>
                <dd className="text-sm text-[rgb(var(--lp-text))]">{formatDate(page?.published_at)}</dd>
              </div>
            </dl>
            {statusLabel === "published" ? (
              <div className="rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 space-y-1">
                <p className="text-xs text-[rgb(var(--lp-text))]">
                  Det som vises på nettsiden nå = innhold da siden ble sist publisert.
                </p>
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  For å ta siden ut av live: bruk «Sett til kladd» i topplinjen. Systemet har ikke versjonshistorikk – avpublisering er ikke rollback til en tidligere versjon.
                </p>
              </div>
            ) : statusLabel === "draft" ? (
              <div className="rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2">
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  Kladd er ikke synlig på nettsiden. Publiser for å gjøre endringene live.
                </p>
              </div>
            ) : null}
            {isForsidePage() && (
              <div className="rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2">
                <p className="text-xs font-medium text-[rgb(var(--lp-text))]">Systemnode – kan ikke slettes</p>
              </div>
            )}
            </div>
          </div>
        ) : null}

        {tab === "seo" ? (
          <div
            role="tabpanel"
            id={`${baseId}-panel-seo`}
            aria-labelledby={`${baseId}-tab-seo`}
            className="space-y-2 text-xs text-[rgb(var(--lp-muted))]"
          >
            <p className="text-sm text-[rgb(var(--lp-text))]">SEO-felt</p>
            <p>
              Rediger tittel, metabeskrivelse, kanonisk URL og relaterte SEO-innstillinger under fanen «SEO» i hovedredigeringsområdet. Lagring følger samme flyt som resten av siden.
            </p>
          </div>
        ) : null}

        {tab === "innstillinger" ? (
          <div
            role="tabpanel"
            id={`${baseId}-panel-innstillinger`}
            aria-labelledby={`${baseId}-tab-innstillinger`}
            className="space-y-2 text-xs text-[rgb(var(--lp-muted))]"
          >
            <p className="text-sm text-[rgb(var(--lp-text))]">Innstillinger</p>
            <p>
              Dokumenttype, layout og sidechrome finnes under «Innhold» (Document Type og Layout). Øvrige innstillinger: fanene «Ekstra», «Navigasjon», «Scripts» og «Avansert» i hovedpanelet.
            </p>
          </div>
        ) : null}

        {tab === "avansert" ? (
          <div
            role="tabpanel"
            id={`${baseId}-panel-avansert`}
            aria-labelledby={`${baseId}-tab-avansert`}
            className="space-y-2"
          >
            <div className="rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-3 py-2">
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
          </div>
        ) : null}
      </div>
    </aside>
  );
}
