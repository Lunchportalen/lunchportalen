"use client";

/**
 * Page- and section-scoped design (Phase 2A): same token shape as global `designSettings`,
 * stored in body `meta.pageDesign` and `meta.sectionDesign[id]` — merged global → page → section → block.
 */

import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import {
  CMS_META_PAGE_DESIGN_KEY,
  CMS_META_SECTION_DESIGN_KEY,
  mergeDesignSettingsIntoGlobalContentData,
  type ContainerWidthToken,
  type DesignSettingsDocument,
  type SectionSpacingToken,
  type SectionSurfaceToken,
  type TypographyBodyToken,
  type TypographyHeadingToken,
} from "@/lib/cms/design/designContract";
import { safeObj } from "./contentWorkspace.helpers";

const SURFACES: SectionSurfaceToken[] = ["default", "alt", "contrast"];
const SPACINGS: SectionSpacingToken[] = ["tight", "normal", "wide"];
const TYPO_H: TypographyHeadingToken[] = ["default", "display"];
const TYPO_B: TypographyBodyToken[] = ["default", "compact"];
const CONTAINERS: ContainerWidthToken[] = ["normal", "wide", "full"];

function readSection(raw: unknown, allowed: string[], fallback: string): string {
  const o = safeObj(raw);
  const s = o.section;
  return typeof s === "string" && allowed.includes(s) ? s : fallback;
}

export type CmsPageScopeDesignSectionProps = {
  meta: Record<string, unknown>;
  setMeta: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
};

/** Sideomfang: overstyrer globalt design for denne siden (tokens). */
export function CmsPageScopeDesignSection({ meta, setMeta }: CmsPageScopeDesignSectionProps) {
  const inner = useMemo(() => {
    const raw = meta[CMS_META_PAGE_DESIGN_KEY];
    return safeObj(raw);
  }, [meta]);

  const surfaceSection = readSection(inner.surface, SURFACES, "default") as SectionSurfaceToken;
  const spacingSection = readSection(inner.spacing, SPACINGS, "normal") as SectionSpacingToken;
  const ty = safeObj(inner.typography);
  const typoHeading = (ty.heading === "display" ? "display" : "default") as TypographyHeadingToken;
  const typoBody = (ty.body === "compact" ? "compact" : "default") as TypographyBodyToken;
  const ly = safeObj(inner.layout);
  const layoutContainer = (ly.container === "wide" || ly.container === "full" ? ly.container : "normal") as ContainerWidthToken;

  const patchPage = useCallback(
    (patch: DesignSettingsDocument) => {
      setMeta((m) => {
        const prevRoot = safeObj(m);
        const prevInner = safeObj(prevRoot[CMS_META_PAGE_DESIGN_KEY]);
        const merged = mergeDesignSettingsIntoGlobalContentData({ designSettings: { ...prevInner } }, patch)
          .designSettings as Record<string, unknown>;
        return { ...prevRoot, [CMS_META_PAGE_DESIGN_KEY]: merged };
      });
    },
    [setMeta],
  );

  return (
    <section
      className="space-y-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 p-3 shadow-[var(--lp-shadow-soft)]"
      aria-labelledby="cms-page-scope-design-heading"
    >
      <div>
        <h3 id="cms-page-scope-design-heading" className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          CMS-design (side)
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
          <span className="font-medium text-[rgb(var(--lp-text))]">Omfang: denne siden.</span> Lagres i{" "}
          <code className="text-[10px]">meta.pageDesign</code> — samme token-kontrakt som globalt design, men gjelder kun denne siden
          før seksjon og blokk.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-[11px]">
          <span className="font-medium text-[rgb(var(--lp-text))]">Overflate (seksjon)</span>
          <select
            className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            value={surfaceSection}
            onChange={(e) =>
              patchPage({
                surface: { section: e.target.value as SectionSurfaceToken },
              })
            }
          >
            {SURFACES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px]">
          <span className="font-medium text-[rgb(var(--lp-text))]">Vertikal rytme</span>
          <select
            className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            value={spacingSection}
            onChange={(e) =>
              patchPage({
                spacing: { section: e.target.value as SectionSpacingToken },
              })
            }
          >
            {SPACINGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px]">
          <span className="font-medium text-[rgb(var(--lp-text))]">Overskrift</span>
          <select
            className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            value={typoHeading}
            onChange={(e) =>
              patchPage({
                typography: { heading: e.target.value as TypographyHeadingToken, body: typoBody },
              })
            }
          >
            {TYPO_H.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px]">
          <span className="font-medium text-[rgb(var(--lp-text))]">Brødtekst</span>
          <select
            className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            value={typoBody}
            onChange={(e) =>
              patchPage({
                typography: { heading: typoHeading, body: e.target.value as TypographyBodyToken },
              })
            }
          >
            {TYPO_B.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px] sm:col-span-2">
          <span className="font-medium text-[rgb(var(--lp-text))]">Containerbredde</span>
          <select
            className="h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
            value={layoutContainer}
            onChange={(e) =>
              patchPage({
                layout: { container: e.target.value as ContainerWidthToken },
              })
            }
          >
            {CONTAINERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

export type CmsSectionScopeDesignSectionProps = {
  meta: Record<string, unknown>;
  setMeta: Dispatch<SetStateAction<Record<string, unknown>>>;
};

/** Seksjonsnivå mellom side og blokk: `meta.sectionDesign[id]` — blokker peker med `config.sectionId`. */
export function CmsSectionScopeDesignSection({ meta, setMeta }: CmsSectionScopeDesignSectionProps) {
  const sectionMap = useMemo(() => safeObj(meta[CMS_META_SECTION_DESIGN_KEY]), [meta]);
  const ids = Object.keys(sectionMap).sort();

  const patchSection = useCallback(
    (sectionId: string, patch: DesignSettingsDocument) => {
      setMeta((m) => {
        const prevRoot = safeObj(m);
        const prevMap = safeObj(prevRoot[CMS_META_SECTION_DESIGN_KEY]);
        const prevInner = safeObj(prevMap[sectionId]);
        const merged = mergeDesignSettingsIntoGlobalContentData({ designSettings: { ...prevInner } }, patch)
          .designSettings as Record<string, unknown>;
        return {
          ...prevRoot,
          [CMS_META_SECTION_DESIGN_KEY]: { ...prevMap, [sectionId]: merged },
        };
      });
    },
    [setMeta],
  );

  const addSection = useCallback(
    (rawId: string) => {
      const id = rawId.trim().replace(/\s+/g, "_");
      if (!id) return;
      setMeta((m) => {
        const prevRoot = safeObj(m);
        const prevMap = safeObj(prevRoot[CMS_META_SECTION_DESIGN_KEY]);
        if (prevMap[id]) return prevRoot;
        return {
          ...prevRoot,
          [CMS_META_SECTION_DESIGN_KEY]: { ...prevMap, [id]: {} },
        };
      });
    },
    [setMeta],
  );

  const removeSection = useCallback(
    (sectionId: string) => {
      setMeta((m) => {
        const prevRoot = safeObj(m);
        const prevMap = safeObj(prevRoot[CMS_META_SECTION_DESIGN_KEY]);
        const nextMap = { ...prevMap };
        delete nextMap[sectionId];
        return { ...prevRoot, [CMS_META_SECTION_DESIGN_KEY]: nextMap };
      });
    },
    [setMeta],
  );

  return (
    <section
      className="space-y-3 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 p-3"
      aria-labelledby="cms-section-scope-design-heading"
    >
      <div>
        <h3 id="cms-section-scope-design-heading" className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          CMS-design (seksjon)
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
          Opprett navngitte seksjoner og tildel dem til blokker under «Seksjon» i blokkdesign. Lagres i{" "}
          <code className="text-[10px]">meta.sectionDesign</code>.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          id="new-section-id"
          placeholder="sec_intro"
          className="min-h-9 min-w-[140px] flex-1 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
          aria-label="Ny seksjons-ID"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addSection((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
        <button
          type="button"
          className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-semibold text-[rgb(var(--lp-text))] shadow-sm hover:border-pink-400/35"
          onClick={() => {
            const el = document.getElementById("new-section-id") as HTMLInputElement | null;
            if (el) {
              addSection(el.value);
              el.value = "";
            }
          }}
        >
          Legg til seksjon
        </button>
      </div>
      {ids.length === 0 ? (
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">Ingen seksjoner ennå — legg til en ID over.</p>
      ) : (
        <ul className="space-y-4">
          {ids.map((sid) => {
            const inner = safeObj(sectionMap[sid]);
            const surfaceSection = readSection(inner.surface, SURFACES, "default") as SectionSurfaceToken;
            const spacingSection = readSection(inner.spacing, SPACINGS, "normal") as SectionSpacingToken;
            const ty = safeObj(inner.typography);
            const typoHeading = (ty.heading === "display" ? "display" : "default") as TypographyHeadingToken;
            const typoBody = (ty.body === "compact" ? "compact" : "default") as TypographyBodyToken;
            const ly = safeObj(inner.layout);
            const layoutContainer = (ly.container === "wide" || ly.container === "full" ? ly.container : "normal") as ContainerWidthToken;
            return (
              <li key={sid} className="rounded-lg border border-[rgb(var(--lp-border))]/80 bg-white/80 p-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-[rgb(var(--lp-text))]">{sid}</span>
                  <button
                    type="button"
                    className="text-[11px] text-rose-700 underline hover:no-underline"
                    onClick={() => removeSection(sid)}
                  >
                    Fjern
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-[10px]">
                    <span className="text-[rgb(var(--lp-muted))]">Overflate</span>
                    <select
                      className="h-8 rounded border border-[rgb(var(--lp-border))] bg-white px-1 text-xs"
                      value={surfaceSection}
                      onChange={(e) =>
                        patchSection(sid, {
                          surface: { section: e.target.value as SectionSurfaceToken },
                        })
                      }
                    >
                      {SURFACES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[10px]">
                    <span className="text-[rgb(var(--lp-muted))]">Rytme</span>
                    <select
                      className="h-8 rounded border border-[rgb(var(--lp-border))] bg-white px-1 text-xs"
                      value={spacingSection}
                      onChange={(e) =>
                        patchSection(sid, {
                          spacing: { section: e.target.value as SectionSpacingToken },
                        })
                      }
                    >
                      {SPACINGS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[10px]">
                    <span className="text-[rgb(var(--lp-muted))]">Overskrift</span>
                    <select
                      className="h-8 rounded border border-[rgb(var(--lp-border))] bg-white px-1 text-xs"
                      value={typoHeading}
                      onChange={(e) =>
                        patchSection(sid, {
                          typography: { heading: e.target.value as TypographyHeadingToken, body: typoBody },
                        })
                      }
                    >
                      {TYPO_H.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[10px]">
                    <span className="text-[rgb(var(--lp-muted))]">Brødtekst</span>
                    <select
                      className="h-8 rounded border border-[rgb(var(--lp-border))] bg-white px-1 text-xs"
                      value={typoBody}
                      onChange={(e) =>
                        patchSection(sid, {
                          typography: { heading: typoHeading, body: e.target.value as TypographyBodyToken },
                        })
                      }
                    >
                      {TYPO_B.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[10px] sm:col-span-2">
                    <span className="text-[rgb(var(--lp-muted))]">Container</span>
                    <select
                      className="h-8 rounded border border-[rgb(var(--lp-border))] bg-white px-1 text-xs"
                      value={layoutContainer}
                      onChange={(e) =>
                        patchSection(sid, {
                          layout: { container: e.target.value as ContainerWidthToken },
                        })
                      }
                    >
                      {CONTAINERS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
