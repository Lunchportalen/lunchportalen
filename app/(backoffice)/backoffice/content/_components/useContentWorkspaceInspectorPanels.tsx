"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { getPropertyEditorFlowForDocumentType } from "@/lib/cms/backofficeSchemaSettingsModel";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { getBlockEditorDataTypeForDocument } from "@/lib/cms/blocks/blockEditorDataTypes";
import { listReferencesForBlockEditorDataTypeAlias } from "@/lib/cms/blocks/blockEditorDataTypeReferences";
import { validateBlockTypesForDocumentTypeAlias } from "@/lib/cms/legacyEnvelopeGovernance";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
import { getPropertyVariation, listScalarDocumentTypeProperties } from "@/lib/cms/contentNodeEnvelope";
import { parseBodyEnvelope } from "./_stubs";
import { formatDate, safeObj, safeStr } from "./contentWorkspace.helpers";
import type { PageStatus } from "./contentWorkspace.types";
import type { ContentPage } from "./ContentWorkspaceState";
import type { DocumentTypeEntry } from "./documentTypes";
import type { Block } from "./editorBlockTypes";
import type { BlockInspectorFieldsCtx } from "./BlockInspectorFields";
import { CmsBlockDesignSection } from "./CmsBlockDesignSection";
import { CmsPageScopeDesignSection, CmsSectionScopeDesignSection } from "./CmsPageSectionDesignPanels";
import type { ContentWorkspacePropertiesRailProps } from "./ContentWorkspacePropertiesRail";

function LayoutThumbnail({ layout }: { layout: "full" | "left" | "right" | "centerNavLeft" | "centerNavRight" }) {
  const base = "rounded-sm bg-slate-300";
  const main = "rounded-sm bg-slate-500";
  if (layout === "full") {
    return <div className={`h-10 w-14 ${main}`} />;
  }
  if (layout === "left") {
    return (
      <div className="flex h-10 w-14 gap-0.5">
        <div className={`w-3 ${base}`} />
        <div className={`flex-1 ${main}`} />
      </div>
    );
  }
  if (layout === "right") {
    return (
      <div className="flex h-10 w-14 gap-0.5">
        <div className={`flex-1 ${main}`} />
        <div className={`w-3 ${base}`} />
      </div>
    );
  }
  if (layout === "centerNavLeft") {
    return (
      <div className="flex h-10 w-14 gap-0.5">
        <div className={`w-2 ${base}`} />
        <div className={`flex-1 ${main}`} />
      </div>
    );
  }
  if (layout === "centerNavRight") {
    return (
      <div className="flex h-10 w-14 gap-0.5">
        <div className={`flex-1 ${main}`} />
        <div className={`w-2 ${base}`} />
      </div>
    );
  }
  return <div className={`h-10 w-14 ${main}`} />;
}

export type ContentWorkspaceInspectorPanelsInput = ContentWorkspacePropertiesRailProps & {
  flatDocumentSurface: boolean;
};

export function useContentWorkspaceInspectorPanels(props: ContentWorkspaceInspectorPanelsInput) {
  const {
    flatDocumentSurface,
    documentTypeAlias,
    setDocumentTypeAlias,
    clearEnvelopeScalarLayers,
    invariantEnvelopeFields,
    cultureEnvelopeFields,
    setInvariantEnvelopeFields,
    setCultureEnvelopeFields,
    editorLocale,
    setEditorLocale,
    documentTypes,
    meta,
    setMeta,
    page,
    title,
    slug,
    showBlocks,
    blocks,
    selectedBlockForInspector,
    blockInspectorCtx,
    statusLabel,
    isOffline,
    effectiveId,
    aiBusyToolId,
    handleAiSeoOptimize,
    mergedBlockEditorDataTypes,
    mergedDocumentTypeDefinitions,
  } = props;

  const pathname = usePathname() ?? "";
  const isContentDetailEditor = resolveBackofficeContentRoute(pathname).kind === "detail";
  const isMainColumnDocumentForm = flatDocumentSurface;
  const detailInspectorSelectionFirst =
    !isMainColumnDocumentForm && isContentDetailEditor && selectedBlockForInspector != null;

  const { push: pushToast } = useToast();
  const propertyEditorFlow = documentTypeAlias ? getPropertyEditorFlowForDocumentType(documentTypeAlias) : null;

  const blockEditorDtResolved = useMemo(
    () =>
      documentTypeAlias
        ? getBlockEditorDataTypeForDocument(documentTypeAlias, mergedBlockEditorDataTypes, mergedDocumentTypeDefinitions)
        : null,
    [documentTypeAlias, mergedBlockEditorDataTypes, mergedDocumentTypeDefinitions],
  );
  const dataTypeUsageLines = useMemo(
    () => (blockEditorDtResolved ? listReferencesForBlockEditorDataTypeAlias(blockEditorDtResolved.alias) : []),
    [blockEditorDtResolved],
  );

  const onNormalizeToGovernedEnvelope = useCallback(() => {
    const defaultAlias = documentTypes[0]?.alias ?? "page";
    const check = validateBlockTypesForDocumentTypeAlias(
      defaultAlias,
      blocks.map((b) => b.type),
      mergedBlockEditorDataTypes,
      mergedDocumentTypeDefinitions,
    );
    if (check.ok === false) {
      pushToast({
        kind: "error",
        title: "Kan ikke oppgradere",
        message: `Fjern eller endre blokker med typer som ikke er tillatt for «${defaultAlias}»: ${check.forbidden.join(", ")}`,
      });
      return;
    }
    setDocumentTypeAlias(defaultAlias);
    clearEnvelopeScalarLayers();
    pushToast({
      kind: "success",
      title: "Dokumenttype satt",
      message: `«${defaultAlias}» er valgt. Lagre for å skrive kanonisk envelope til serveren.`,
    });
  }, [
    blocks,
    documentTypes,
    mergedBlockEditorDataTypes,
    mergedDocumentTypeDefinitions,
    pushToast,
    setDocumentTypeAlias,
    clearEnvelopeScalarLayers,
  ]);

  const selectedBlockOrdinal =
    selectedBlockForInspector == null
      ? null
      : (() => {
          const i = blocks.findIndex((b) => b.id === selectedBlockForInspector.id);
          return i >= 0 ? i + 1 : null;
        })();

  const designScopePanels = (
    <>
      <CmsPageScopeDesignSection meta={meta} setMeta={setMeta} />
      <CmsSectionScopeDesignSection meta={meta} setMeta={setMeta} />
      {selectedBlockForInspector ? (
        <CmsBlockDesignSection
          block={selectedBlockForInspector}
          setBlockById={blockInspectorCtx.setBlockById}
          meta={meta}
        />
      ) : null}
    </>
  );

  const mergedDocForScalars =
    documentTypeAlias && mergedDocumentTypeDefinitions?.[documentTypeAlias]
      ? mergedDocumentTypeDefinitions[documentTypeAlias]!
      : null;
  const scalarPropsList = mergedDocForScalars ? listScalarDocumentTypeProperties(mergedDocForScalars) : [];

  const variantAndScalarsPanel = (
    <section
      className={
        isMainColumnDocumentForm
          ? "space-y-4 border-0 bg-transparent p-0"
          : "space-y-3 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 p-3"
      }
      data-lp-cms-variant-context
      data-lp-current-culture={editorLocale}
      data-lp-publish-state={page?.status ?? ""}
    >
      <h3
        className={
          isMainColumnDocumentForm
            ? "text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            : "text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]"
        }
      >
        Språk / varianter (U98)
      </h3>
      <p className="text-[11px] text-[rgb(var(--lp-muted))]">
        Aktiv variant-rad: <span className="font-mono">{editorLocale === "en" ? "en (English)" : "nb (Norsk)"}</span>
        . Kulturfelt lagres per språk; invariante felt deles mellom alle språk.
      </p>
      <div className="flex flex-wrap gap-2" data-lp-cms-locale-switch>
        {(["nb", "en"] as const).map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => setEditorLocale(loc)}
            className={`min-h-10 rounded-full border px-3 text-xs font-semibold ${
              editorLocale === loc
                ? "border-pink-500 bg-pink-50 text-pink-950"
                : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-text))]"
            }`}
            data-lp-cms-locale={loc}
          >
            {loc === "nb" ? "nb · Norsk" : "en · English"}
          </button>
        ))}
      </div>
      {page?.body ? (
        <div
          className={
            isMainColumnDocumentForm
              ? "rounded-md border border-slate-200/80 bg-slate-50/50 px-3 py-2 text-[11px] text-slate-600"
              : "rounded-lg border border-[rgb(var(--lp-border))] bg-white/80 px-2 py-2 text-[11px] text-[rgb(var(--lp-muted))]"
          }
        >
          <span className="font-semibold text-[rgb(var(--lp-text))]">Publiseringslag (variant-rad):</span>{" "}
          <span data-lp-cms-variant-publish>
            {parseBodyEnvelope(page.body).cmsVariantPublish?.state === "published" ? "Publisert (echo)" : "Utkast (echo)"}
          </span>
          <span className="mx-1">·</span>
          <span className="font-semibold">Side:</span> {page.status}
        </div>
      ) : null}
      {documentTypeAlias && scalarPropsList.length > 0 ? (
        <div className="space-y-2 border-t border-[rgb(var(--lp-border))] pt-3" data-lp-cms-scalar-properties>
          <p className="text-[10px] font-bold uppercase tracking-wide text-pink-900/55">Document type · scalar</p>
          {scalarPropsList.map((prop) => {
            const variation = getPropertyVariation(prop);
            const isInv = variation === "invariant";
            const value = String(
              (isInv ? invariantEnvelopeFields[prop.alias] : cultureEnvelopeFields[prop.alias]) ?? "",
            );
            return (
              <div key={prop.alias} className="space-y-1" data-lp-property-variation={variation}>
                <label className="block text-[11px] font-medium text-[rgb(var(--lp-text))]">
                  {prop.title}
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-mono text-slate-600">
                    {isInv ? "invariant" : "culture"}
                  </span>
                </label>
                {prop.dataTypeAlias === "cms_text_area" ? (
                  <textarea
                    className="mt-0.5 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 py-1.5 text-sm"
                    value={value}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (isInv) {
                        setInvariantEnvelopeFields((prev) => ({ ...prev, [prop.alias]: v }));
                      } else {
                        setCultureEnvelopeFields((prev) => ({ ...prev, [prop.alias]: v }));
                      }
                    }}
                    data-lp-scalar-input={prop.alias}
                    data-lp-field-layer={isInv ? "invariant" : "culture"}
                    {...(isInv ? { "data-lp-invariant-field": prop.alias } : { "data-lp-culture-field": prop.alias })}
                  />
                ) : (
                  <input
                    type="text"
                    className="mt-0.5 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 py-1.5 text-sm"
                    value={value}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (isInv) {
                        setInvariantEnvelopeFields((prev) => ({ ...prev, [prop.alias]: v }));
                      } else {
                        setCultureEnvelopeFields((prev) => ({ ...prev, [prop.alias]: v }));
                      }
                    }}
                    data-lp-scalar-input={prop.alias}
                    data-lp-field-layer={isInv ? "invariant" : "culture"}
                    {...(isInv ? { "data-lp-invariant-field": prop.alias } : { "data-lp-culture-field": prop.alias })}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );

  const documentGovernancePanel = (
    <section
      className={
        isMainColumnDocumentForm
          ? "space-y-3 border-0 bg-transparent p-0"
          : "space-y-3 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 p-3"
      }
    >
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          Dokumenttype og styring
        </h3>
        <div className="border-b border-[rgb(var(--lp-border))]" aria-hidden />
        <div className="pt-1">
          <label htmlFor="doc-type-select-rp" className="sr-only">
            Dokumenttype
          </label>
          <select
            id="doc-type-select-rp"
            value={documentTypeAlias ?? ""}
            onChange={(e) => {
              const next = e.target.value.trim() || null;
              setDocumentTypeAlias(next);
              if (next !== documentTypeAlias) clearEnvelopeScalarLayers();
            }}
            className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))] outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
            aria-label="Velg dokumenttype"
          >
            <option value="">— Ingen dokumenttype —</option>
            {documentTypes.map((dt) => (
              <option key={dt.alias} value={dt.alias}>
                {dt.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
            Dokumenttypen styrer tillatte undernoder og egenskapsfelt.
          </p>
          {!documentTypeAlias ? (
            <>
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50/90 px-2 py-1.5 text-[11px] text-amber-950">
                <span className="font-medium">Legacy / uten envelope:</span> Ingen dokumenttype i lagret innhold
                — blokkliste håndheves ikke ved lagring før du velger type.
              </p>
              {showBlocks ? (
                <button
                  type="button"
                  onClick={onNormalizeToGovernedEnvelope}
                  disabled={isOffline}
                  className="mt-2 w-full min-h-[40px] rounded-lg border border-slate-800 bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Oppgrader til kanonisk envelope ({documentTypes[0]?.name ?? "Page"})
                </button>
              ) : null}
            </>
          ) : (
            <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/80 px-2 py-1.5 text-[11px] text-emerald-950">
              <span className="font-medium">Kanonisk envelope:</span> Blokktyper sjekkes ved lagring mot
              dokumenttype «{documentTypeAlias}».
            </p>
          )}
          {documentTypeAlias && blockEditorDtResolved ? (
            <div className="mt-2 space-y-1 rounded-md border border-slate-200 bg-slate-50/90 px-2 py-2 text-[11px] text-slate-800">
              <p>
                <span className="font-semibold">Block Editor Data Type:</span>{" "}
                <code className="rounded bg-white px-1 py-0.5 text-[10px]">{blockEditorDtResolved.alias}</code>
                <span className="text-slate-600"> · felt </span>
                <code className="text-[10px]">{blockEditorDtResolved.propertyKey}</code>
              </p>
              <p>
                <Link
                  href={`/backoffice/settings/block-editor-data-types/${encodeURIComponent(blockEditorDtResolved.alias)}`}
                  className="font-medium text-slate-900 underline underline-offset-4"
                >
                  Åpne data type i innstillinger
                </Link>
              </p>
              {dataTypeUsageLines.length > 0 ? (
                <p className="text-slate-600">
                  Brukes av dokumenttype(r):{" "}
                  {dataTypeUsageLines.map((r) => r.documentTypeName).join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
          {documentTypeAlias && propertyEditorFlow ? (
            <div className="mt-3 space-y-3 rounded-lg border border-[rgb(var(--lp-border))] bg-white p-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  Hva styrer denne editoren
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[rgb(var(--lp-muted))]">
                  Workspace-konteksten peker direkte til management-objektene som faktisk eier feltkontraktene.
                </p>
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-3 py-2">
                  <p className="font-semibold text-[rgb(var(--lp-text))]">Configured instances</p>
                  <p className="mt-1 text-[rgb(var(--lp-muted))]">{propertyEditorFlow.configuredInstances.length} feltbindinger</p>
                </div>
                <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-3 py-2">
                  <p className="font-semibold text-[rgb(var(--lp-text))]">UI mapping</p>
                  <p className="mt-1 text-[rgb(var(--lp-muted))]">
                    {propertyEditorFlow.uiMappings.length > 0
                      ? propertyEditorFlow.uiMappings.map((mapping) => mapping.labelNb).join(", ")
                      : "Ingen registrert"}
                  </p>
                </div>
                <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-3 py-2">
                  <p className="font-semibold text-[rgb(var(--lp-text))]">Presets</p>
                  <p className="mt-1 text-[rgb(var(--lp-muted))]">{propertyEditorFlow.presets.length} default-kilder</p>
                </div>
                <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-3 py-2">
                  <p className="font-semibold text-[rgb(var(--lp-text))]">Coverage gaps</p>
                  <p className="mt-1 text-[rgb(var(--lp-muted))]">
                    {propertyEditorFlow.coverageGaps.length > 0
                      ? propertyEditorFlow.coverageGaps.map((gap) => gap.blockLabel).join(", ")
                      : "Ingen kjente gaps"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/backoffice/settings/document-types/${encodeURIComponent(documentTypeAlias)}`}
                  className="rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-white"
                >
                  Åpne document type
                </Link>
                <Link
                  href="/backoffice/settings/schema"
                  className="rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-white"
                >
                  Åpne schema
                </Link>
                {propertyEditorFlow.documentType?.fieldKinds.slice(0, 3).map((kind) => (
                  <Link
                    key={kind}
                    href={`/backoffice/settings/data-types/${encodeURIComponent(kind)}`}
                    className="rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 text-xs font-mono text-[rgb(var(--lp-text))] hover:bg-white"
                  >
                    {kind}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );

  const layoutPanel = (
    <section
      className={
        isMainColumnDocumentForm
          ? "space-y-3 border-0 bg-transparent p-0"
          : "space-y-2 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 p-3"
      }
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
        Layout og sidevisning
      </h3>
      <div className="border-b border-[rgb(var(--lp-border))]" aria-hidden />
      <div className="grid gap-2 pt-1">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["full", "FULL"],
              ["left", "LEFT"],
              ["right", "RIGHT"],
              ["centerNavLeft", "CENTER (NAV L)"],
              ["centerNavRight", "CENTER (NAV R)"],
            ] as const
          ).map(([value, label]) => {
            const currentLayout = safeStr((meta as { layout?: unknown }).layout) || "full";
            const selected = currentLayout === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMeta((prev) => ({ ...prev, layout: value }))}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition ${
                  selected
                    ? "border-slate-400 bg-slate-50"
                    : "border-[rgb(var(--lp-border))] bg-white hover:border-slate-300"
                }`}
                title={label}
              >
                <LayoutThumbnail layout={value} />
                <span className="text-[10px] font-medium text-[rgb(var(--lp-text))]">{label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[rgb(var(--lp-muted))]">Skjul sidetitler</span>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(safeObj(meta).hidePageHeadings)}
            onClick={() =>
              setMeta((prev) => ({ ...prev, hidePageHeadings: !safeObj(prev).hidePageHeadings }))
            }
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors ${
              safeObj(meta).hidePageHeadings
                ? "border-slate-500 bg-slate-500"
                : "border-[rgb(var(--lp-border))] bg-slate-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                safeObj(meta).hidePageHeadings ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-[11px] font-medium text-[rgb(var(--lp-muted))]">
            {safeObj(meta).hidePageHeadings ? "JA" : "NEI"}
          </span>
        </div>
      </div>
    </section>
  );

  const listingPanel = (
    <div
      className={
        isMainColumnDocumentForm
          ? "space-y-4 border-t border-slate-100 pt-6"
          : "space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4"
      }
    >
      <div>
        <h3
          className={
            isMainColumnDocumentForm
              ? "text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              : "text-sm font-semibold text-[rgb(var(--lp-text))]"
          }
        >
          Listing og sammendrag
        </h3>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Meta som brukes i lister, relaterte flater og oppsummeringskort.
        </p>
      </div>
      <div
        className={
          isMainColumnDocumentForm
            ? "text-xs leading-relaxed text-slate-500"
            : "rounded-xl border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3 text-xs text-[rgb(var(--lp-muted))]"
        }
      >
        Dette innholdet vises kun på Listing- eller Related Content-pod.
      </div>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-[rgb(var(--lp-text))]">Overskrift</span>
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Sidenavn brukes som standard hvis ingenting er fylt inn.
        </p>
        <input
          value={safeStr((meta as { summaryHeading?: unknown }).summaryHeading) || title}
          onChange={(e) => setMeta((prev) => ({ ...prev, summaryHeading: e.target.value }))}
          className="mt-1 h-11 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
          placeholder={title || "Overskrift for listing"}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-[rgb(var(--lp-text))]">Underoverskrift</span>
        <input
          value={safeStr((meta as { summarySecondaryHeading?: unknown }).summarySecondaryHeading)}
          onChange={(e) => setMeta((prev) => ({ ...prev, summarySecondaryHeading: e.target.value }))}
          className="mt-1 h-11 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
          placeholder="Valgfri underoverskrift"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-[rgb(var(--lp-text))]">Tekst</span>
        <textarea
          value={safeStr((meta as { summary?: unknown }).summary)}
          onChange={(e) => setMeta((prev) => ({ ...prev, summary: e.target.value }))}
          rows={6}
          className="mt-1 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
          placeholder="Rich tekst for listing og relatert innhold."
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-[rgb(var(--lp-text))]">Bilde</span>
        <p className="text-xs text-[rgb(var(--lp-muted))]">Fokuspunkt defineres i Media-seksjonen.</p>
        <div className="mt-2 flex h-24 w-32 items-center justify-center rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-muted))]">
          <span className="text-xs">Last opp / erstatt</span>
        </div>
      </label>
    </div>
  );

  const governancePanel = (
    <div
      className={
        isMainColumnDocumentForm
          ? "space-y-6 border-0 bg-transparent p-0"
          : "space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4"
      }
    >
      <h3
        className={
          isMainColumnDocumentForm
            ? "text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            : "text-sm font-semibold text-[rgb(var(--lp-text))]"
        }
      >
        Governance og navigasjon
      </h3>
      <details
        className={
          isMainColumnDocumentForm
            ? "border-t border-slate-100 bg-transparent pt-4"
            : "rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/20 p-3"
        }
        open
      >
        <summary className="cursor-pointer list-none text-sm font-semibold text-[rgb(var(--lp-text))]">
          Dokumenttype, envelope og policy
        </summary>
        <div className="mt-3">{documentGovernancePanel}</div>
      </details>
      <details
        className={
          isMainColumnDocumentForm
            ? "border-t border-slate-100 bg-transparent pt-4"
            : "rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/20 p-3"
        }
        open
      >
        <summary className="cursor-pointer list-none text-sm font-semibold text-[rgb(var(--lp-text))]">
          Synlighet, navigasjon og lenketekster
        </summary>
        <div className="mt-3 space-y-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul fra all navigasjon</p>
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  Velg Ja for å skjule denne siden fra all auto-generert navigasjon, manuelt lagt til navigasjon, knapper og lister.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={!(meta as { nav?: { show?: boolean } }).nav?.show !== false}
                  className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200"
                  onClick={() =>
                    setMeta((prev) => ({
                      ...prev,
                      nav: {
                        ...safeObj((prev as { nav?: unknown }).nav),
                        show: (meta as { nav?: { show?: boolean } }).nav?.show === false,
                      },
                    }))
                  }
                >
                  <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                </button>
                <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul fra intern søk</p>
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  Velg Ja for å skjule denne siden fra nettstedets interne søk.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                  <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                </button>
                <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul brødsmule</p>
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  Velg Ja for å skjule den auto-genererte brødsmulenavigasjonen fra denne siden.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                  <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                </button>
                <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
              </div>
            </div>
          </div>
          <div>
            <p className="pt-2 text-sm font-medium text-[rgb(var(--lp-text))]">Lenketekster</p>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Sidenavn brukes som standard hvis ingenting er fylt inn.
            </p>
            <div className="grid gap-3 pt-2">
              {(
                [
                  ["subNavLinkText", "Subnavigasjon lenketekst"],
                  ["sitemapLinkText", "HTML sitemap lenketekst"],
                  ["breadcrumbLinkText", "Brødsmule lenketekst"],
                  ["searchResultsLinkText", "Søkeresultat lenketekst"],
                ] as const
              ).map(([navKey, navLabel]) => (
                <label key={navKey} className="grid gap-1 text-sm">
                  <span className="font-medium text-[rgb(var(--lp-text))]">{navLabel}</span>
                  <input
                    value={
                      safeStr((meta as { nav?: Record<string, unknown> }).nav?.[navKey]) ||
                      (navKey === "breadcrumbLinkText" ? title : "")
                    }
                    onChange={(e) =>
                      setMeta((prev) => ({
                        ...prev,
                        nav: { ...safeObj((prev as { nav?: unknown }).nav), [navKey]: e.target.value },
                      }))
                    }
                    className="h-11 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]"
                    placeholder={title || "Lenketekst"}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );

  const seoPanel = (
    <div
      className={
        isMainColumnDocumentForm
          ? "space-y-5 border-0 bg-transparent p-0"
          : "space-y-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4"
      }
    >
      <h3
        className={
          isMainColumnDocumentForm
            ? "text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            : "text-sm font-semibold text-[rgb(var(--lp-text))]"
        }
      >
        SEO &amp; deling
      </h3>

      {(() => {
        const root = safeObj(meta);
        const rawSeo = safeObj((root as { seo?: unknown }).seo);
        const seoTitle = safeStr(rawSeo.title) || title;
        const seoDescription = safeStr(rawSeo.description);
        const canonicalUrl = safeStr(rawSeo.canonicalUrl);
        const noIndex = rawSeo.noIndex === true;
        const noFollow = rawSeo.noFollow === true;
        const ogImage = safeStr(rawSeo.ogImage);
        const twitterCreator = safeStr(rawSeo.twitterCreator);
        const sitemapPriority = Number((rawSeo as { sitemapPriority?: unknown }).sitemapPriority) || 0;
        const sitemapChangeFreq = safeStr((rawSeo as { sitemapChangeFreq?: unknown }).sitemapChangeFreq) || "";
        const alternativeUrl = safeStr((rawSeo as { alternativeUrl?: unknown }).alternativeUrl);
        const alternativeName = safeStr((rawSeo as { alternativeName?: unknown }).alternativeName);
        const titleLen = seoTitle.length;
        const descLen = seoDescription.length;

        return (
          <>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Tittel og beskrivelse</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">Slik kan siden vises i søkeresultat.</p>
              <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-slate-50 p-3 text-sm">
                <p className="truncate text-xs text-[rgb(var(--lp-muted))]">{slug ? `${slug}/` : "..."}</p>
                <p className="mt-1 font-medium text-blue-600">{seoTitle || "Sidetittel"}</p>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-[rgb(var(--lp-muted))]">
                  {seoDescription || "Meta-beskrivelse"}
                </p>
              </div>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--lp-muted))]">SEO-tittel</span>
              <input
                value={seoTitle}
                onChange={(e) => {
                  const value = e.target.value;
                  setMeta((prev) => {
                    const nextRoot = safeObj(prev);
                    const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
                    return { ...nextRoot, seo: { ...nextSeo, title: value } };
                  });
                }}
                className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                placeholder={title || "Tittel for søkeresultat"}
              />
              <span className={titleLen >= 50 && titleLen <= 60 ? "text-xs text-green-600" : "text-xs text-[rgb(var(--lp-muted))]"}>
                {titleLen} tegn — anbefalt 50–60
              </span>
            </label>

            <label className="grid gap-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[rgb(var(--lp-muted))]">Meta-beskrivelse</span>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
                  disabled={isOffline || !effectiveId || aiBusyToolId === "seo.optimize.page"}
                  onClick={() =>
                    handleAiSeoOptimize?.({ goal: "lead", audience: "" }, { fromInline: true })
                  }
                >
                  {aiBusyToolId === "seo.optimize.page" ? "Kjører..." : "Generer SEO-forslag"}
                </button>
              </div>
              <textarea
                value={seoDescription}
                onChange={(e) => {
                  const value = e.target.value;
                  setMeta((prev) => {
                    const nextRoot = safeObj(prev);
                    const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
                    return { ...nextRoot, seo: { ...nextSeo, description: value } };
                  });
                }}
                className="min-h-20 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
                placeholder="Kort og tydelig oppsummering for søkemotorer."
              />
              <span className={descLen >= 155 && descLen <= 160 ? "text-xs text-green-600" : "text-xs text-[rgb(var(--lp-muted))]"}>
                {descLen} tegn — anbefalt 155–160
              </span>
            </label>

            <div className="space-y-1">
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Delingsbilde</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Bilde som brukes når siden deles på sosiale medier. Bruk minst 1200×630 px. Hvis tomt brukes standard fra Global &gt; Innhold og innstillinger.
              </p>
              <input
                value={ogImage}
                onChange={(e) => {
                  const value = e.target.value;
                  setMeta((prev) => {
                    const nextRoot = safeObj(prev);
                    const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
                    return { ...nextRoot, seo: { ...nextSeo, ogImage: value } };
                  });
                }}
                className="h-10 w-full rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                placeholder="/images/..."
              />
            </div>

            <label className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--lp-muted))]">Twitter-brukernavn (creator)</span>
              <input
                value={twitterCreator}
                onChange={(e) => {
                  const value = e.target.value;
                  setMeta((prev) => {
                    const nextRoot = safeObj(prev);
                    const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo);
                    return { ...nextRoot, seo: { ...nextSeo, twitterCreator: value } };
                  });
                }}
                className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                placeholder="@brukernavn"
              />
            </label>

            <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul fra søkemotorer</p>
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  Legger til noindex og ekskluderer siden fra sitemap.xml.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" role="switch" aria-checked={noIndex} onClick={() => setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, noIndex: !s.noIndex } }; })} className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${noIndex ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"}`}>
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${noIndex ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
                <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{noIndex ? "JA" : "NEI"}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Stopp at søkemotorer følger lenker</p>
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  Legger til nofollow slik at lenker på siden ikke følges.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" role="switch" aria-checked={noFollow} onClick={() => setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, noFollow: !s.noFollow } }; })} className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors ${noFollow ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"}`}>
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${noFollow ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
                <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{noFollow ? "JA" : "NEI"}</span>
              </div>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Sitemap XML-prioritet</p>
              <div className="flex items-center gap-3">
                <input type="number" min={0} max={1} step={0.1} value={sitemapPriority} onChange={(e) => { const v = Number(e.target.value); setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, sitemapPriority: v } }; }); }} className="h-10 w-20 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm" />
                <input type="range" min={0} max={1} step={0.1} value={sitemapPriority} onChange={(e) => { const v = Number(e.target.value); setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, sitemapPriority: v } }; }); }} className="flex-1" />
              </div>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Sitemap XML endringsfrekvens</p>
              <div className="flex flex-wrap gap-1">
                {(["ALWAYS", "HOURLY", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "NEVER"] as const).map((freq) => (
                  <button key={freq} type="button" onClick={() => setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, sitemapChangeFreq: freq } }; })} className={`rounded border px-2 py-1 text-xs font-medium ${sitemapChangeFreq === freq ? "border-slate-400 bg-slate-100 text-slate-900" : "border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))]"}`}>
                    {freq}
                  </button>
                ))}
              </div>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--lp-muted))]">Override canonical URL</span>
              <p className="text-xs text-[rgb(var(--lp-muted))]">Full URL inkl. scheme, f.eks. https://www.nettsted.no</p>
              <input value={canonicalUrl} onChange={(e) => { const value = e.target.value; setMeta((prev) => { const nextRoot = safeObj(prev); const nextSeo = safeObj((nextRoot as { seo?: unknown }).seo); return { ...nextRoot, seo: { ...nextSeo, canonicalUrl: value } }; }); }} className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm" placeholder="https://..." />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--lp-muted))]">Alternativ URL</span>
              <p className="text-xs text-[rgb(var(--lp-muted))]">Flere URL-er for samme side, kommaseparert, små bokstaver, uten ledende / og uten filending.</p>
              <input value={alternativeUrl} onChange={(e) => { const value = e.target.value; setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, alternativeUrl: value } }; }); }} className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm" placeholder="eksempel1,eksempel2/sti" />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-[rgb(var(--lp-muted))]">Alternativt navn</span>
              <p className="text-xs text-[rgb(var(--lp-muted))]">Overstyrer standard nodenavn som brukes i URL.</p>
              <input value={alternativeName} onChange={(e) => { const value = e.target.value; setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { seo?: unknown }).seo); return { ...r, seo: { ...s, alternativeName: value } }; }); }} className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm" placeholder="" />
            </label>
          </>
        );
      })()}
    </div>
  );

  const runtimePanel = (
    <div className={isMainColumnDocumentForm ? "space-y-8" : "space-y-4"}>
      <div
        className={
          isMainColumnDocumentForm
            ? "space-y-3 border-0 bg-transparent p-0"
            : "rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 p-4"
        }
      >
        <h3
          className={
            isMainColumnDocumentForm
              ? "text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              : "text-sm font-semibold text-[rgb(var(--lp-text))]"
          }
        >
          Runtime og teknikk
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-[rgb(var(--lp-muted))]">
          Scripts, tekniske overstyringer og sporbar runtime-kontekst ligger samlet i ett fokusomrade.
        </p>
        <dl
          className={`mt-3 grid gap-2 text-xs sm:grid-cols-2 ${
            isMainColumnDocumentForm ? "gap-3" : ""
          }`}
        >
          <div
            className={
              isMainColumnDocumentForm
                ? "rounded-md border border-slate-200/80 bg-slate-50/40 px-3 py-2"
                : "rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2"
            }
          >
            <dt className="text-[rgb(var(--lp-muted))]">Node-ID</dt>
            <dd className="font-mono text-[rgb(var(--lp-text))]">{effectiveId ?? page?.id ?? "—"}</dd>
          </div>
          <div
            className={
              isMainColumnDocumentForm
                ? "rounded-md border border-slate-200/80 bg-slate-50/40 px-3 py-2"
                : "rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2"
            }
          >
            <dt className="text-[rgb(var(--lp-muted))]">Status</dt>
            <dd className="text-[rgb(var(--lp-text))]">{statusLabel === "published" ? "Publisert" : "Kladd"}</dd>
          </div>
          <div
            className={
              isMainColumnDocumentForm
                ? "rounded-md border border-slate-200/80 bg-slate-50/40 px-3 py-2"
                : "rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2"
            }
          >
            <dt className="text-[rgb(var(--lp-muted))]">Slug</dt>
            <dd className="font-mono text-[rgb(var(--lp-text))]">{page?.slug || slug || "—"}</dd>
          </div>
          <div
            className={
              isMainColumnDocumentForm
                ? "rounded-md border border-slate-200/80 bg-slate-50/40 px-3 py-2"
                : "rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2"
            }
          >
            <dt className="text-[rgb(var(--lp-muted))]">Sist oppdatert</dt>
            <dd className="text-[rgb(var(--lp-text))]">{formatDate(page?.updated_at)}</dd>
          </div>
        </dl>
      </div>

      <div
        className={
          isMainColumnDocumentForm
            ? "space-y-4 border-t border-slate-100 pt-6"
            : "space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4"
        }
      >
        <h3
          className={
            isMainColumnDocumentForm
              ? "text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              : "text-sm font-semibold text-[rgb(var(--lp-text))]"
          }
        >
          Scripts
        </h3>

        {(() => {
          const root = safeObj(meta);
          const rawScripts = safeObj((root as { scripts?: unknown }).scripts);
          const headScript = String(rawScripts.head ?? "");
          const bodyScript = String(rawScripts.body ?? "");
          const disableHeadGlobal = (rawScripts as { disableGlobal?: boolean }).disableGlobal === true;
          const disableBodyGlobal = (rawScripts as { disableBodyGlobal?: boolean }).disableBodyGlobal === true;
          return (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                  <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Deaktiver globale scripts (head)</p>
                  <div className="flex items-center gap-2">
                    <button type="button" role="switch" aria-checked={disableHeadGlobal} onClick={() => setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { scripts?: unknown }).scripts); return { ...r, scripts: { ...s, disableGlobal: !(s as { disableGlobal?: boolean }).disableGlobal } }; })} className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 ${disableHeadGlobal ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"}`}>
                      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow ${disableHeadGlobal ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                    <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{disableHeadGlobal ? "JA" : "NEI"}</span>
                  </div>
                </div>
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  Scripts som injiseres etter åpning av &lt;head&gt;. Husk &lt;script&gt;&lt;/script&gt; rundt JavaScript.
                </p>
                <label className="grid gap-1 text-sm">
                  <span className="text-[rgb(var(--lp-muted))]">Scripts</span>
                  <textarea value={headScript} onChange={(e) => { const v = e.target.value; setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { scripts?: unknown }).scripts); return { ...r, scripts: { ...s, head: v } }; }); }} rows={4} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]" placeholder="<script>...</script>" />
                </label>
              </div>

              <div className="space-y-3 border-t border-[rgb(var(--lp-border))] pt-4">
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Scripts før lukking av &lt;/body&gt;</p>
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  Disse scriptene plasseres før &lt;/body&gt; på denne siden. Husk &lt;script&gt;&lt;/script&gt; rundt JavaScript.
                </p>
                <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
                  <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Deaktiver globale scripts</p>
                  <div className="flex items-center gap-2">
                    <button type="button" role="switch" aria-checked={disableBodyGlobal} onClick={() => setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { scripts?: unknown }).scripts); return { ...r, scripts: { ...s, disableBodyGlobal: !(s as { disableBodyGlobal?: boolean }).disableBodyGlobal } }; })} className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 ${disableBodyGlobal ? "border-slate-500 bg-slate-500" : "border-slate-300 bg-slate-200"}`}>
                      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow ${disableBodyGlobal ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                    <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">{disableBodyGlobal ? "JA" : "NEI"}</span>
                  </div>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="text-[rgb(var(--lp-muted))]">Scripts</span>
                  <textarea value={bodyScript} onChange={(e) => { const v = e.target.value; setMeta((prev) => { const r = safeObj(prev); const s = safeObj((r as { scripts?: unknown }).scripts); return { ...r, scripts: { ...s, body: v } }; }); }} rows={4} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]" placeholder="<script>...</script>" />
                </label>
              </div>
            </>
          );
        })()}
      </div>

      <div
        className={
          isMainColumnDocumentForm
            ? "space-y-4 border-t border-slate-100 pt-6"
            : "space-y-6 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4"
        }
      >
        <h3
          className={
            isMainColumnDocumentForm
              ? "text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              : "text-sm font-semibold text-[rgb(var(--lp-text))]"
          }
        >
          Avansert
        </h3>

        <div className="grid gap-4">
          <div>
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Override global node</p>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Velg Global node som gjelder for denne siden og alle undersider. Overstyrer valg på forsiden.
            </p>
            <button type="button" className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]">
              Legg til
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul nettstedets header</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">Fjern global header-innhold øverst på denne siden.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
              </button>
              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Skjul nettstedets footer</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">Fjern global footer-innhold nederst på denne siden.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
              </button>
              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Override designstil</p>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Velg designstil for denne siden og alle undersider. Overstyrer valg på forsiden eller i Global &gt; Innstillinger.
            </p>
            <button type="button" className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]">
              Legg til
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Override nettstedets logo</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
              </button>
              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Override innholdsretning</p>
            <p className="text-xs text-[rgb(var(--lp-muted))]">Overstyr standard innholdsretning fra Global &gt; Innhold og innstillinger.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="rounded-lg border-2 border-slate-400 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800">
                LTR
              </button>
              <button type="button" className="rounded-lg border-2 border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300">
                RTL
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Egendefinerte sidemapper</p>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Overstyr standardstiler ved å legge til sidemapper. Mellomrom mellom hver klasse, f.eks. min-klasse annen-klasse.
            </p>
            <textarea rows={3} className="mt-2 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--lp-border))]" placeholder="custom-class annen-klasse" />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Deaktiver sletting</p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Når Ja er valgt vil forsøk på å slette denne noden blokkeres og en advarsel vises.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" role="switch" aria-checked={false} className="relative inline-flex h-7 w-12 items-center rounded-full border-2 border-slate-300 bg-slate-200">
                <span className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
              </button>
              <span className="text-xs font-semibold text-[rgb(var(--lp-muted))]">NEI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  return {
    designScopePanels,
    layoutPanel,
    listingPanel,
    seoPanel,
    governancePanel,
    runtimePanel,
    variantAndScalarsPanel,
    documentGovernancePanel,
    mergedDocForScalars,
    scalarPropsList,
    selectedBlockOrdinal,
  };
}
