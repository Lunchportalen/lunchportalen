"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  listScalarDocumentTypeProperties,
  listScalarDocumentTypePropertiesForDetailContentTab,
} from "@/lib/cms/contentNodeEnvelope";
import type {
  DocumentTypeDefinition,
  PropertyTypeDefinition,
} from "@/lib/cms/schema/documentTypeDefinitions";
import { DocumentScalarPropertyEditors } from "./contentDocumentScalarEditors";
import type { ContentWorkspacePropertiesRailProps } from "./ContentWorkspacePropertiesRail";
import type { ContentDetailEditorMode } from "./useContentWorkspaceUi";

/* =========================================================
   TYPES
========================================================= */

export type ContentDetailEditorTabId = "content" | "seo" | "settings";

type ScalarSection = {
  groupId: string;
  title: string;
  description?: string;
  propsList: PropertyTypeDefinition[];
};

/* =========================================================
   CONSTANTS
========================================================= */

const CONTENT_GROUP_ORDER = ["intro", "content"] as const;
const SEO_GROUP_IDS = new Set(["seo"]);
const SETTINGS_GROUP_IDS = new Set(["design", "layout", "settings"]);

/* =========================================================
   HELPERS
========================================================= */

function statusPresentation(
  status: ContentWorkspacePropertiesRailProps["statusLabel"],
): string {
  return status === "published" ? "Publisert" : "Utkast";
}

function groupScalarsIntoSections(
  propsList: PropertyTypeDefinition[],
  mergedDoc: DocumentTypeDefinition | null,
  explicitOrder?: readonly string[],
): ScalarSection[] {
  const byGroup = new Map<string, PropertyTypeDefinition[]>();

  for (const prop of propsList) {
    const arr = byGroup.get(prop.groupId) ?? [];
    arr.push(prop);
    byGroup.set(prop.groupId, arr);
  }

  const keys = Array.from(byGroup.keys());

  const orderedKeys = explicitOrder
    ? [
        ...explicitOrder.filter((id) => byGroup.has(id)),
        ...keys.filter((id) => !explicitOrder.includes(id)),
      ]
    : keys;

  return orderedKeys.map((groupId) => {
    const props = byGroup.get(groupId)!;
    const meta = mergedDoc?.groups.find((g) => g.id === groupId);

    return {
      groupId,
      title: meta?.title ?? groupId,
      description: meta?.description,
      propsList: props,
    };
  });
}

/* =========================================================
   UI COMPONENTS
========================================================= */

function EditorTabs(props: {
  activeTab: ContentDetailEditorTabId;
  onChange: (tab: ContentDetailEditorTabId) => void;
  hasSeo: boolean;
  hasSettings: boolean;
}) {
  const { activeTab, onChange, hasSeo, hasSettings } = props;

  const tabs: { id: ContentDetailEditorTabId; label: string; hidden: boolean }[] = [
    { id: "content", label: "Innhold", hidden: false },
    { id: "seo", label: "SEO", hidden: !hasSeo },
    { id: "settings", label: "Innstillinger", hidden: !hasSettings },
  ];

  return (
    <nav
      className="flex flex-wrap gap-0 border-b border-slate-300/90 bg-[#e8eaed] px-1 pt-1.5"
      role="tablist"
      aria-label="Dokumentfaner"
    >
      {tabs
        .filter((t) => !t.hidden)
        .map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={`relative -mb-px min-h-10 shrink-0 rounded-t border border-b-0 px-4 py-2 text-[13px] font-semibold transition-colors ${
                active
                  ? "z-[1] border-slate-400/90 bg-white text-slate-900 shadow-sm"
                  : "border-transparent bg-transparent text-slate-600 hover:bg-white/60 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          );
        })}
    </nav>
  );
}

function PropertySection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="space-y-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{title}</h2>
        {description ? (
          <p className="text-[12px] leading-snug text-slate-400">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function TechnicalFields({
  nodeId,
  slug,
  setSlug,
  setSlugTouched,
}: {
  nodeId: string;
  slug: string;
  setSlug: (s: string) => void;
  setSlugTouched: (b: boolean) => void;
}) {
  return (
    <section className="mt-2 space-y-3 border-t border-slate-200/70 pt-4" data-lp-detail-technical-fields>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">Teknisk</h2>
      <div className="space-y-2">
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-400" htmlFor="lp-detail-node-id">
            Node-ID
          </label>
          <input
            id="lp-detail-node-id"
            readOnly
            value={nodeId}
            className="w-full rounded border border-slate-200/80 bg-slate-50/80 px-2 py-1.5 font-mono text-[11px] text-slate-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-400" htmlFor="lp-detail-slug">
            Slug
          </label>
          <input
            id="lp-detail-slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className="w-full rounded border border-slate-200/90 bg-white px-2 py-1.5 text-[13px] text-slate-700 shadow-none focus:border-slate-400 focus:outline-none focus:ring-0"
          />
        </div>
      </div>
    </section>
  );
}

function DetailEditorModeSwitch({
  mode,
  onChange,
}: {
  mode: ContentDetailEditorMode;
  onChange: (next: ContentDetailEditorMode) => void;
}) {
  const seg =
    "inline-flex min-h-9 rounded-md border border-slate-300/85 bg-[#e8eaed] p-0.5 text-[11px] font-semibold text-slate-700 shadow-sm";
  const item = (m: ContentDetailEditorMode, label: string) => {
    const on = mode === m;
    return (
      <button
        key={m}
        type="button"
        onClick={() => onChange(m)}
        aria-pressed={on}
        className={`rounded px-3 py-1.5 transition-colors ${
          on ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Arbeidsflate for dokument">
      <span className={seg}>
        {item("structure", "Struktur")}
        {item("visual", "Visuell")}
      </span>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export function ContentDetailDocumentEditor({
  documentFormProps,
  onDocumentTitleChange,
  blocksSlot,
  /** Visuell modus: kompakt dokumentflate — kun modusbryter + canvas (ingen tittel/faner/Oppsett). */
  detailModuleWorkspaceActive = false,
  detailEditorMode = "structure",
  setDetailEditorMode = () => {},
}: {
  documentFormProps: ContentWorkspacePropertiesRailProps;
  onDocumentTitleChange: (next: string) => void;
  blocksSlot?: ReactNode | null;
  detailModuleWorkspaceActive?: boolean;
  detailEditorMode?: ContentDetailEditorMode;
  setDetailEditorMode?: (mode: ContentDetailEditorMode) => void;
}) {
  const {
    documentTypeAlias,
    mergedDocumentTypeDefinitions,
    invariantEnvelopeFields,
    cultureEnvelopeFields,
    setInvariantEnvelopeFields,
    setCultureEnvelopeFields,
    title,
    slug,
    setSlug,
    setSlugTouched,
    statusLabel,
    effectiveId,
    page,
  } = documentFormProps;

  const mergedDoc = useMemo(() => {
    return documentTypeAlias
      ? mergedDocumentTypeDefinitions?.[documentTypeAlias] ?? null
      : null;
  }, [documentTypeAlias, mergedDocumentTypeDefinitions]);

  const all = useMemo(
    () => (mergedDoc ? listScalarDocumentTypeProperties(mergedDoc) : []),
    [mergedDoc],
  );

  const content = useMemo(
    () =>
      mergedDoc
        ? listScalarDocumentTypePropertiesForDetailContentTab(mergedDoc)
        : [],
    [mergedDoc],
  );

  const seo = useMemo(
    () => all.filter((p) => SEO_GROUP_IDS.has(p.groupId)),
    [all],
  );

  const settings = useMemo(
    () => all.filter((p) => SETTINGS_GROUP_IDS.has(p.groupId)),
    [all],
  );

  const technical = useMemo(
    () =>
      all.filter(
        (p) =>
          !SEO_GROUP_IDS.has(p.groupId) &&
          !SETTINGS_GROUP_IDS.has(p.groupId) &&
          !(CONTENT_GROUP_ORDER as readonly string[]).includes(p.groupId),
      ),
    [all],
  );

  const contentSections = useMemo(
    () => groupScalarsIntoSections(content, mergedDoc, CONTENT_GROUP_ORDER),
    [content, mergedDoc],
  );

  const seoSections = useMemo(
    () => groupScalarsIntoSections(seo, mergedDoc),
    [seo, mergedDoc],
  );

  const settingsSections = useMemo(
    () => groupScalarsIntoSections(settings, mergedDoc),
    [settings, mergedDoc],
  );

  const technicalSections = useMemo(
    () => groupScalarsIntoSections(technical, mergedDoc),
    [technical, mergedDoc],
  );

  const [tab, setTab] = useState<ContentDetailEditorTabId>("content");

  const nodeId = effectiveId ?? page?.id ?? "";

  /** Visuell modus: ingen full dokument-header over canvas — modusbryter + blocksSlot. */
  if (detailModuleWorkspaceActive && blocksSlot != null) {
    return (
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white"
        data-lp-content-detail-document-surface="true"
        data-lp-detail-module-workspace-chrome="compact"
      >
        <div className="flex shrink-0 items-center border-b border-slate-200/75 bg-[#f6f7fa] px-2 py-1 sm:px-3">
          <DetailEditorModeSwitch mode={detailEditorMode} onChange={setDetailEditorMode} />
        </div>
        {blocksSlot}
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col space-y-3 px-2 pb-3 pt-0 sm:px-4 sm:pb-4 sm:pt-0 md:px-6 md:pb-5 md:pt-0 lg:px-8"
      data-lp-content-detail-document-surface="true"
    >
      <header className="space-y-2">
        <div className="space-y-0">
          <label className="sr-only" htmlFor="lp-detail-document-title">
            Dokumenttittel
          </label>
          <input
            id="lp-detail-document-title"
            value={title}
            onChange={(e) => onDocumentTitleChange(e.target.value)}
            placeholder="Sidetittel"
            className="w-full rounded-sm border border-slate-300/90 bg-white px-3 py-2.5 text-lg font-semibold leading-snug tracking-tight text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#3544b1]/80 focus:outline-none focus:ring-1 focus:ring-[#3544b1]/25 sm:text-xl"
            autoComplete="off"
          />
        </div>

        <EditorTabs
          activeTab={tab}
          onChange={setTab}
          hasSeo={seoSections.length > 0}
          hasSettings={settingsSections.length > 0 || technicalSections.length > 0}
        />

        <div className="border-t border-slate-200/70 pt-2">
          <DetailEditorModeSwitch mode={detailEditorMode} onChange={setDetailEditorMode} />
        </div>

        <p className="pt-0.5 text-[11px] leading-snug text-slate-400">
          {statusPresentation(statusLabel)}
          {documentTypeAlias ? (
            <>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-mono text-[10px] text-slate-400">{documentTypeAlias}</span>
            </>
          ) : null}
        </p>
      </header>

      {/* CONTENT — page builder: kompakte toppkontroller, deretter hovedinnhold som moduler */}
      {tab === "content" && (
        <div className="flex min-h-0 flex-1 flex-col space-y-4" data-lp-detail-content-tab="component-builder">
          {contentSections.length > 0 ? (
            <div
              className="rounded-lg border border-slate-300/70 bg-gradient-to-b from-[#eef1f6] to-[#e8ebf2] px-3 py-2.5 shadow-sm"
              data-lp-detail-component-builder-top-controls="true"
            >
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Oppsett og sidevalg
                  </p>
                  <p className="text-[11px] leading-snug text-slate-500">
                    Mal, sidefelt og dokumentvalg før hovedflaten — samme rytme som en komponentbygger.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {contentSections.map((s) => (
                  <div key={s.groupId}>
                    {contentSections.length > 1 ? (
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {s.title}
                      </p>
                    ) : null}
                    <DocumentScalarPropertyEditors
                      tone="builderTop"
                      sectionHeading=""
                      showTopRule={false}
                      propsList={s.propsList}
                      invariantEnvelopeFields={invariantEnvelopeFields}
                      cultureEnvelopeFields={cultureEnvelopeFields}
                      setInvariantEnvelopeFields={setInvariantEnvelopeFields}
                      setCultureEnvelopeFields={setCultureEnvelopeFields}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {blocksSlot ?
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-300/80 bg-white shadow-md"
              data-lp-detail-component-builder-main="true"
              data-lp-detail-blocks-in-flow
            >
              <div className="shrink-0 border-b border-slate-200/90 bg-[#f6f7fa] px-3 py-2 sm:px-4">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
                  Hovedinnhold
                </h2>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                  Velg en modul for å jobbe i full visuell redigeringsflate. Uten valg: forhåndsvisning og modulliste
                  under.
                </p>
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-[#fafbfc] p-2 sm:p-3">
                {blocksSlot}
              </div>
            </div>
          : null}
        </div>
      )}

      {/* SEO */}
      {tab === "seo" && (
        <div className="space-y-4">
          {seoSections.map((s) => (
            <PropertySection key={s.groupId} title={s.title} description={s.description}>
              <DocumentScalarPropertyEditors
                tone="detail"
                sectionHeading=""
                showTopRule={false}
                propsList={s.propsList}
                invariantEnvelopeFields={invariantEnvelopeFields}
                cultureEnvelopeFields={cultureEnvelopeFields}
                setInvariantEnvelopeFields={setInvariantEnvelopeFields}
                setCultureEnvelopeFields={setCultureEnvelopeFields}
              />
            </PropertySection>
          ))}
        </div>
      )}

      {/* SETTINGS */}
      {tab === "settings" && (
        <div className="space-y-4">
          {[...settingsSections, ...technicalSections].map((s) => (
            <PropertySection key={s.groupId} title={s.title} description={s.description}>
              <DocumentScalarPropertyEditors
                tone="detail"
                sectionHeading=""
                showTopRule={false}
                propsList={s.propsList}
                invariantEnvelopeFields={invariantEnvelopeFields}
                cultureEnvelopeFields={cultureEnvelopeFields}
                setInvariantEnvelopeFields={setInvariantEnvelopeFields}
                setCultureEnvelopeFields={setCultureEnvelopeFields}
              />
            </PropertySection>
          ))}

          <TechnicalFields
            nodeId={nodeId}
            slug={slug}
            setSlug={setSlug}
            setSlugTouched={setSlugTouched}
          />
        </div>
      )}
    </div>
  );
}