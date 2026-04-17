"use client";

/**
 * Bellissima egenskaps-rail: inspector-seksjoner + meta/SEO/layout/scripts/avansert.
 * Ren komposisjon; state kommer fra den kanoniske workspace-konteksten.
 */

import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  useBellissimaWorkspaceModel,
  useBellissimaWorkspaceShellState,
} from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import { type ContentBellissimaInspectorSectionId } from "@/lib/cms/backofficeWorkspaceContextModel";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import type { PageStatus } from "./contentWorkspace.types";
import type { ContentPage } from "./ContentWorkspaceState";
import type { DocumentTypeEntry } from "./documentTypes";
import type { Block } from "./editorBlockTypes";
import type { BlockInspectorFieldsCtx } from "./BlockInspectorFields";
import { ContentWorkspacePropertiesInspectorCard } from "./ContentWorkspacePropertiesInspectorCard";
import { useContentWorkspaceInspectorPanels } from "./useContentWorkspaceInspectorPanels";

export type ContentWorkspacePropertiesRailProps = {
  inspectorSection: ContentBellissimaInspectorSectionId;
  setInspectorSection: Dispatch<SetStateAction<ContentBellissimaInspectorSectionId>>;
  documentTypeAlias: string | null;
  setDocumentTypeAlias: Dispatch<SetStateAction<string | null>>;
  /** Tømmer invariant + culture scalar-lag (f.eks. ved dokumenttypeskifte). */
  clearEnvelopeScalarLayers: () => void;
  invariantEnvelopeFields: Record<string, unknown>;
  cultureEnvelopeFields: Record<string, unknown>;
  setInvariantEnvelopeFields: Dispatch<SetStateAction<Record<string, unknown>>>;
  setCultureEnvelopeFields: Dispatch<SetStateAction<Record<string, unknown>>>;
  editorLocale: string;
  setEditorLocale: Dispatch<SetStateAction<string>>;
  documentTypes: DocumentTypeEntry[];
  meta: Record<string, unknown>;
  setMeta: Dispatch<SetStateAction<Record<string, unknown>>>;
  page: ContentPage | null;
  title: string;
  slug: string;
  setSlug: (v: string) => void;
  setSlugTouched: (v: boolean) => void;
  showBlocks: boolean;
  blocks: Block[];
  selectedBlockForInspector: Block | null;
  blockInspectorCtx: BlockInspectorFieldsCtx;
  statusLabel: PageStatus;
  isOffline: boolean;
  effectiveId: string | null;
  aiBusyToolId: string | null;
  handleAiSeoOptimize: (
    input: { goal: "lead" | "info" | "signup"; audience: string },
    opts?: { fromInline?: boolean }
  ) => void;
  /** U95 — merged data types fra settings (null = baseline i resolver) */
  mergedBlockEditorDataTypes: Record<string, BlockEditorDataTypeDefinition> | null;
  /** U96 — merged document types (property → data type) */
  mergedDocumentTypeDefinitions: Record<string, DocumentTypeDefinition> | null;
};

export function ContentWorkspacePropertiesRail(props: ContentWorkspacePropertiesRailProps) {
  const {
    inspectorSection,
    setInspectorSection,
    page,
    title,
    showBlocks,
    selectedBlockForInspector,
    blockInspectorCtx,
  } = props;

  const workspaceModel = useBellissimaWorkspaceModel();
  const { setActiveSideApp } = useBellissimaWorkspaceShellState();

  const panels = useContentWorkspaceInspectorPanels({ ...props, flatDocumentSurface: false });

  const {
    designScopePanels,
    layoutPanel,
    listingPanel,
    seoPanel,
    governancePanel,
    runtimePanel,
    variantAndScalarsPanel,
    selectedBlockOrdinal,
  } = panels;

  const isMainColumnDocumentForm = false;

  const fallbackInspectorTabs: { id: ContentBellissimaInspectorSectionId; label: string }[] = [
    { id: "content", label: "Innhold" },
    { id: "design", label: "Design" },
    { id: "seo", label: "SEO" },
    { id: "governance", label: "Governance" },
    { id: "runtime", label: "Runtime" },
  ];
  const inspectorTabs =
    workspaceModel?.inspectorSections?.length ? workspaceModel.inspectorSections : fallbackInspectorTabs;

  const detailInspectorSelectionFirst = false;

  const inspectorTabStrip = (
    <div
      className="flex flex-wrap gap-1.5 border-b border-[rgb(var(--lp-border))] pb-3"
      role="tablist"
      aria-label="Inspector-faner"
    >
      {inspectorTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={inspectorSection === tab.id}
          onClick={() => {
            setActiveSideApp("workspace");
            setInspectorSection(tab.id);
          }}
          className={`min-h-11 rounded-md px-3 text-sm font-medium ${
            inspectorSection === tab.id
              ? "bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-text))] shadow-sm ring-1 ring-[rgb(var(--lp-border))]"
              : "text-[rgb(var(--lp-muted))] hover:bg-slate-50/80 hover:text-[rgb(var(--lp-text))]"
          }`}
          title={"description" in tab ? tab.description : tab.label}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const documentMetaBehindFold =
    detailInspectorSelectionFirst ? (
      <details className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/25">
        <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-medium text-[rgb(var(--lp-muted))] marker:content-none [&::-webkit-details-marker]:hidden">
          Språk, varianter og dokumentfelt
        </summary>
        <div className="border-t border-[rgb(var(--lp-border))]/80 p-2">{variantAndScalarsPanel}</div>
      </details>
    ) : (
      variantAndScalarsPanel
    );

  const mainColumnPanelShell = (children: ReactNode) => <>{children}</>;

  return (
    <div className="space-y-4" data-lp-document-form-surface="rail">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">
          Inspector
        </p>
        <p className="text-xs leading-relaxed text-[rgb(var(--lp-muted))]">
          Velg ett fokusområde om gangen. Innhold, design, SEO, governance og runtime styres fra samme
          workspace-kontekst.
        </p>
        <div className="mt-2">{inspectorTabStrip}</div>
      </div>

      {inspectorSection === "content"
        ? mainColumnPanelShell(
            <div className="space-y-3">
              {detailInspectorSelectionFirst ? (
                <>
                  <ContentWorkspacePropertiesInspectorCard
                    showBlocks={showBlocks}
                    selectedBlockForInspector={selectedBlockForInspector}
                    selectedBlockOrdinal={selectedBlockOrdinal}
                    ctx={blockInspectorCtx}
                  />
                  {documentMetaBehindFold}
                  <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 px-3 py-2 text-xs">
                    <p className="font-medium text-[rgb(var(--lp-text))]">Side</p>
                    <dl className="mt-2 space-y-1">
                      <div>
                        <dt className="text-[rgb(var(--lp-muted))]">Slug</dt>
                        <dd className="font-mono text-[rgb(var(--lp-text))]">{page?.slug || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[rgb(var(--lp-muted))]">Node-ID</dt>
                        <dd className="font-mono text-[11px] text-[rgb(var(--lp-text))]">{page?.id ?? "—"}</dd>
                      </div>
                    </dl>
                  </div>
                  {listingPanel}
                </>
              ) : (
                <>
                  {documentMetaBehindFold}
                  <ContentWorkspacePropertiesInspectorCard
                    showBlocks={showBlocks}
                    selectedBlockForInspector={selectedBlockForInspector}
                    selectedBlockOrdinal={selectedBlockOrdinal}
                    ctx={blockInspectorCtx}
                  />
                  <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 px-3 py-2 text-xs">
                    <p className="font-medium text-[rgb(var(--lp-text))]">Side</p>
                    <dl className="mt-2 space-y-1">
                      <div>
                        <dt className="text-[rgb(var(--lp-muted))]">Slug</dt>
                        <dd className="font-mono text-[rgb(var(--lp-text))]">{page?.slug || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[rgb(var(--lp-muted))]">Node-ID</dt>
                        <dd className="font-mono text-[11px] text-[rgb(var(--lp-text))]">{page?.id ?? "—"}</dd>
                      </div>
                    </dl>
                  </div>
                  {listingPanel}
                </>
              )}
            </div>,
          )
        : null}

      {inspectorSection === "design"
        ? mainColumnPanelShell(
            <div className="space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
              <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Design, layout og komponenter</h3>
              {designScopePanels}
              {layoutPanel}
              <details className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/20 p-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[rgb(var(--lp-text))]">
                  Ekstra designflater og globale komponenter
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-[rgb(var(--lp-muted))]">
                  Disse flatene beholdes for kontekst, men skjules som standard for å redusere inspector-støy.
                </p>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul globale toppkomponenter</p>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">
                        Skjul komponenter som er satt globalt øverst på siden.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={false}
                      className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200"
                    >
                      <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                    </button>
                    <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Over hovedinnhold</p>
                    <p className="text-xs text-[rgb(var(--lp-muted))]">
                      Plassert over hovedinnholdet og spenner full bredde av siden.
                    </p>
                    <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3">
                      <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f] font-mono text-xs text-white">
                          &lt;/&gt;
                        </span>
                        <div>
                          <p className="font-medium text-[rgb(var(--lp-text))]">Code</p>
                          <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                            COMPONENT: CODE
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-white py-3 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                      >
                        <span className="text-lg leading-none">+</span> Legg til innhold
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Under hovedinnhold</p>
                    <p className="text-xs text-[rgb(var(--lp-muted))]">
                      Plassert under hovedinnholdet og spenner full bredde av siden.
                    </p>
                    <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3">
                      <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f] font-mono text-xs text-white">
                          &lt;/&gt;
                        </span>
                        <div>
                          <p className="font-medium text-[rgb(var(--lp-text))]">Code</p>
                          <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                            COMPONENT: CODE
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-white py-3 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                      >
                        <span className="text-lg leading-none">+</span> Legg til innhold
                      </button>
                    </div>
                  </div>
                </div>
              </details>
            </div>,
          )
        : null}

      {inspectorSection === "seo" ? mainColumnPanelShell(seoPanel) : null}
      {inspectorSection === "governance" ? mainColumnPanelShell(governancePanel) : null}
      {inspectorSection === "runtime" ? mainColumnPanelShell(runtimePanel) : null}
    </div>
  );
}
