"use client";

import { Fragment, useState } from "react";
import { EDITOR_AI_CAPABILITY_LABELS } from "@/domain/backoffice/ai/editorAiCapabilities";
import { Icon } from "@/components/ui/Icon";

export type AiCapabilityStatus = "loading" | "available" | "unavailable";

export type MediaHealthStatus = "idle" | "checking" | "available" | "unavailable";

export type ContentAiToolsProps = {
  disabled?: boolean;
  /** Editor focus (page + section + selected block) for UI contextualization only. */
  contextLabel?: string | null;
  /** Focused block type for visual action prioritization only (UI-only). */
  focusedBlockType?: string | null;
  /** Human-readable label for the focused block (e.g. from getBlockTreeLabel). */
  focusedBlockLabel?: string | null;
  aiCapabilityStatus?: AiCapabilityStatus;
  /** Media API health (probe when page selected). */
  mediaHealthStatus?: MediaHealthStatus;
  /** Content API health (page load success/fail). */
  contentHealthStatus?: "idle" | "checking" | "available" | "unavailable";
  busyToolId?: string | null;
  errorMessage?: string | null;
  lastSummary?: string | null;
  lastBlockBuilderResult?: { block: Record<string, unknown>; message: string } | null;
  lastAppliedTool?: string | null;
  onImprovePage?: (input: { goal: "lead" | "info" | "signup"; audience: string }) => void;
  onSeoOptimize?: (input: { goal: "lead" | "info" | "signup"; audience: string }) => void;
  onGenerateSections?: (input: { goal: string; audience: string }) => void;
  onStructuredIntent?: (input: { variantCount: 2 | 3; target: "hero_cta" | "hero_only" }) => void;
  onLayoutSuggestions?: () => void;
  /** Last layout/design suggestions from "Hent layoutforslag" (deterministic). */
  lastLayoutSuggestionsResult?: {
    suggestions: Array<{
      kind: string;
      title: string;
      reason: string;
      priority: string;
      previewLabel?: string;
      applyPatch?: unknown;
    }>;
    message: string;
  } | null;
  /** Apply a single design suggestion (only called when suggestion has applyPatch). */
  onApplyDesignSuggestion?: (suggestion: {
    kind: string;
    title: string;
    reason: string;
    priority: string;
    previewLabel?: string;
    applyPatch?: unknown;
  }) => void;
  /** Dismiss a suggestion (parent uses kind+title as stable key). */
  onDismissDesignSuggestion?: (suggestion: { kind: string; title: string }) => void;
  onBlockBuilder?: (input: { description: string }) => void;
  onBlockBuilderInsert?: () => void;
  onImageGenerate?: (input: { purpose: "hero" | "section" | "social"; topic: string }) => void;
  onScreenshotBuilder?: (input: { screenshotUrl?: string; description?: string }) => void;
  lastScreenshotBuilderResult?: {
    message?: string;
    blocks: unknown[];
    blockTypes?: string[];
    warnings?: string[];
  } | null;
  onScreenshotBuilderReplace?: () => void;
  onScreenshotBuilderAppend?: () => void;
  onImageImproveMetadata?: (input: { mediaItemId: string; url: string }) => void;
  onPageBuilder?: (input: {
    prompt?: string;
    goal?: string;
    audience?: string;
    tone?: "enterprise" | "warm" | "neutral";
    pageType?: "landing" | "contact" | "info" | "pricing" | "generic";
    ctaIntent?: "demo" | "contact" | "quote" | "start";
    sectionsInclude?: string[];
    sectionsExclude?: string[];
  }) => void;
  pageBuilderBusy?: boolean;
  lastPageBuilderResult?: {
    title?: string;
    summary?: string;
    blocks: Array<{ id: string; type: string; data: Record<string, unknown> }>;
    warnings?: string[];
    /** Blocks that could not be normalized (unknown type or invalid data). */
    droppedBlocks?: Array<{ index: number; type: string }>;
  } | null;
  onPageBuilderReplace?: () => void;
  onPageBuilderAppend?: () => void;
  /** After image-generator: url/id so user can open media and use the image. */
  lastGeneratedImageResult?: import("./editorAiContracts").ImageGeneratorResult | null;
  /** Samlet sidediagnostikk (Improve page + SEO). */
  onRunDiagnostics?: () => Promise<void>;
  diagnosticsResult?: {
    improvePage: { summary: string; applied: boolean };
    seo: { summary: string; applied: boolean };
  } | null;
  diagnosticsBusy?: boolean;
  /** Siste AI-handlinger (editor-state). */
  aiHistory?: Array<{ id: string; tool: string; label: string; detail?: string; at: string }>;
  /** Kalles når bruker lukker/sletter feilmelding (fail-safe UI). */
  onClearError?: () => void;
  /** Åpne den felles AI-assistent-modalen (første native AI-shell). */
  onOpenAiAssist?: () => void;
}

const MAX_FIELD_PREVIEW = 80;

function BlockBuilderResultView({
  result,
}: {
  result: { block: Record<string, unknown>; message: string };
}) {
  const { block, message } = result;
  const type = typeof block.type === "string" ? block.type : "unknown";
  const id = typeof block.id === "string" ? block.id : "";
  const data = block.data != null && typeof block.data === "object" && !Array.isArray(block.data)
    ? (block.data as Record<string, unknown>)
    : null;
  const dataEntries = data ? Object.entries(data).filter(([, v]) => v != null && v !== "") : [];
  const truncate = (s: string) =>
    s.length <= MAX_FIELD_PREVIEW ? s : s.slice(0, MAX_FIELD_PREVIEW) + "…";

  return (
    <div className="space-y-1.5 text-right">
      <p className="text-xs uppercase tracking-wide text-[rgb(var(--lp-muted))]">
        Generert blokk
      </p>
      <p className="text-xs font-medium text-[rgb(var(--lp-text))]">
        type: <span className="font-mono">{type}</span>
        {id ? ` · id: ${id.slice(0, 12)}…` : ""}
      </p>
      {message ? (
        <p className="text-xs text-[rgb(var(--lp-muted))]">{message}</p>
      ) : null}
      {dataEntries.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-left text-xs text-[rgb(var(--lp-muted))]">
          {dataEntries.slice(0, 8).map(([key, val]) => (
            <li key={key} className="flex gap-1">
              <span className="shrink-0 font-medium text-[rgb(var(--lp-text))]">{key}:</span>
              <span className="min-w-0 truncate">
                {typeof val === "string" ? truncate(val) : JSON.stringify(val)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <pre className="mt-1 max-h-32 overflow-auto rounded border border-[rgb(var(--lp-border))] bg-slate-50 px-2 py-1 text-left text-xs font-mono text-[rgb(var(--lp-text))] whitespace-pre-wrap break-all">
        {JSON.stringify(block, null, 2)}
      </pre>
    </div>
  );
}

export function ContentAiTools({
  disabled,
  contextLabel = null,
  focusedBlockType = null,
  focusedBlockLabel = null,
  aiCapabilityStatus = "loading",
  mediaHealthStatus = "idle",
  contentHealthStatus = "idle",
  busyToolId,
  errorMessage,
  lastSummary,
  lastBlockBuilderResult,
  lastAppliedTool,
  onImprovePage,
  onSeoOptimize,
  onGenerateSections,
  onStructuredIntent,
  onLayoutSuggestions,
  lastLayoutSuggestionsResult = null,
  onApplyDesignSuggestion,
  onDismissDesignSuggestion,
  onBlockBuilder,
  onBlockBuilderInsert,
  onImageGenerate,
  onScreenshotBuilder,
  lastScreenshotBuilderResult,
  onScreenshotBuilderReplace,
  onScreenshotBuilderAppend,
  onImageImproveMetadata,
  onPageBuilder,
  pageBuilderBusy = false,
  lastPageBuilderResult,
  onPageBuilderReplace,
  onPageBuilderAppend,
  lastGeneratedImageResult,
  onRunDiagnostics,
  diagnosticsResult,
  diagnosticsBusy = false,
  aiHistory = [],
  onClearError,
  onOpenAiAssist,
}: ContentAiToolsProps) {
  const cardClass =
    "lp-motion-card rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3 space-y-2";
  const buttonClass =
    "lp-motion-btn mt-1 inline-flex items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50 hover:shadow-[var(--lp-shadow-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2";

  const focusType = (focusedBlockType ?? "").trim();
  const prioritizedCardClass = "border-rose-200 bg-rose-50/40 ring-1 ring-rose-100";

  const [improveGoal, setImproveGoal] = useState<"lead" | "info" | "signup">("lead");
  const [improveAudience, setImproveAudience] = useState("");

  const [seoGoal, setSeoGoal] = useState<"lead" | "info" | "signup">("lead");
  const [seoAudience, setSeoAudience] = useState("");

  const [sectionsGoal, setSectionsGoal] = useState("");
  const [sectionsAudience, setSectionsAudience] = useState("");

  const [intentVariantCount, setIntentVariantCount] = useState<2 | 3>(2);
  const [intentTarget, setIntentTarget] = useState<"hero_cta" | "hero_only">("hero_cta");

  const [layoutFromLocale, setLayoutFromLocale] = useState("nb");
  const [layoutToLocale, setLayoutToLocale] = useState("en");

  const [imagePurpose, setImagePurpose] = useState<"hero" | "section" | "social">("hero");
  const [imageTopic, setImageTopic] = useState("");

  const [blockBuilderDescription, setBlockBuilderDescription] = useState("");
  const [pageBuilderPrompt, setPageBuilderPrompt] = useState("");
  const [pageBuilderGoal, setPageBuilderGoal] = useState("");
  const [pageBuilderAudience, setPageBuilderAudience] = useState("");
  const [pageBuilderTone, setPageBuilderTone] = useState<"enterprise" | "warm" | "neutral">("enterprise");
  const [pageBuilderPageType, setPageBuilderPageType] = useState<"landing" | "contact" | "info" | "pricing" | "generic">("landing");
  const [pageBuilderCtaIntent, setPageBuilderCtaIntent] = useState<"demo" | "contact" | "quote" | "start">("contact");
  const [pageBuilderSectionsInclude, setPageBuilderSectionsInclude] = useState("");
  const [pageBuilderSectionsExclude, setPageBuilderSectionsExclude] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [screenshotDescription, setScreenshotDescription] = useState("");
  const [metaMediaItemId, setMetaMediaItemId] = useState("");
  const [metaUrl, setMetaUrl] = useState("");

  const improveBusy = busyToolId === "content.maintain.page";
  const seoBusy = busyToolId === "seo.optimize.page";
  const sectionsBusy = busyToolId === "landing.generate.sections";
  const intentBusy = busyToolId === "experiment.generate.variants";
  const layoutSuggestionsBusy = busyToolId === "layout.suggestions";
  const blockBuilderBusy = busyToolId === "block.builder";
  const imageGenerateBusy = busyToolId === "image.generate.brand_safe";
  const screenshotBuilderBusy = busyToolId === "screenshot.builder";
  const imageMetaBusy = busyToolId === "image.improve.metadata";
  const pageBuilderBusyId = pageBuilderBusy ?? busyToolId === "page.builder";

  const allDisabled = disabled ?? false;

  // Block type → ordered group ids (UI-only prioritization).
  const BLOCK_TYPE_GROUP_ORDER: Record<string, string[]> = {
    hero: ["Overskrift", "CTA", "Struktur", "SEO"],
    richText: ["Copy", "Struktur", "Lesbarhet", "SEO"],
    cta: ["CTA", "Konvertering"],
    image: ["Metadata", "Alt-tekst"],
    banners: ["Struktur", "Layout"],
    divider: ["Struktur"],
  };
  const DEFAULT_GROUP_ORDER = ["Diagnostikk", "SEO", "Struktur", "Layout"];

  const GROUP_CONFIG: Record<
    string,
    { title: string; helper: string; toolIds: string[] }
  > = {
    Overskrift: {
      title: "Overskrift",
      helper: "Overskrift og intro for hero.",
      toolIds: ["improvePage", "structuredIntent"],
    },
    CTA: {
      title: "CTA",
      helper: "Knapp og handlingsorientering.",
      toolIds: ["structuredIntent"],
    },
    Struktur: {
      title: "Struktur",
      helper: "Seksjoner og oppbygning.",
      toolIds: ["generateSections", "layoutDesign"],
    },
    SEO: {
      title: "SEO",
      helper: "Tittel, beskrivelse og nøkkelord.",
      toolIds: ["seoOptimize"],
    },
    Copy: {
      title: "Copy",
      helper: "Tekst og budskap.",
      toolIds: ["improvePage"],
    },
    Lesbarhet: {
      title: "Lesbarhet",
      helper: "Lesbarhet og struktur.",
      toolIds: ["improvePage"],
    },
    Metadata: {
      title: "Metadata",
      helper: "Bildemetadata.",
      toolIds: ["imageMetadata"],
    },
    "Alt-tekst": {
      title: "Alt-tekst",
      helper: "Alt-tekst og tilgjengelighet.",
      toolIds: ["imageMetadata"],
    },
    Konvertering: {
      title: "Konvertering",
      helper: "CTA og konvertering.",
      toolIds: ["structuredIntent"],
    },
    Layout: {
      title: "Layout",
      helper: "Layout og designforslag.",
      toolIds: ["layoutDesign"],
    },
    Diagnostikk: {
      title: "Diagnostikk",
      helper: "Sidediagnostikk og forbedring.",
      toolIds: ["improvePage"],
    },
  };

  const orderedGroupIds =
    BLOCK_TYPE_GROUP_ORDER[focusType] ?? DEFAULT_GROUP_ORDER;

  return (
    <section
      className="lp-motion-card lp-glass-surface mt-4 rounded-xl p-4"
      aria-label="AI-verktøy"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--lp-text))]">
            <Icon name="ai" size="sm" className="text-[rgb(var(--lp-muted))]" />
            AI-verktøy
          </h3>
          <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
            Ett system: sidedypping, generering, referanse→blokker, bilde. Ingen endringer publiseres uten at du lagrer siden.
          </p>
          {/* Block-aware context header */}
          <div className="mt-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 px-2.5 py-1.5">
            <p className="text-xs font-medium text-[rgb(var(--lp-text))]">AI for valgt innhold</p>
            <p className="mt-0.5 text-[11px] text-[rgb(var(--lp-muted))]">
              Blokk:{" "}
              <span className="text-[rgb(var(--lp-text))]">
                {focusedBlockLabel ?? "Ingen blokk valgt"}
              </span>
            </p>
            {contextLabel ? (
              <p className="mt-0.5 text-[11px] text-[rgb(var(--lp-muted))]">
                Fokus:{" "}
                <span className="inline-block max-w-[220px] truncate align-middle text-[rgb(var(--lp-text))]">
                  {contextLabel}
                </span>
              </p>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                aiCapabilityStatus === "available"
                  ? "border-[rgb(var(--lp-success))]/50 bg-[rgb(var(--lp-success))]/10 text-[rgb(var(--lp-success))]"
                  : aiCapabilityStatus === "loading"
                    ? "border-[rgb(var(--lp-muted))]/50 bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-muted))]"
                    : "border-amber-300 bg-amber-50 text-amber-800"
              }`}
              title={
                aiCapabilityStatus === "available"
                  ? "AI er tilgjengelig"
                  : aiCapabilityStatus === "loading"
                    ? "Sjekker AI-tilgjengelighet"
                    : "AI er ikke tilgjengelig (mangler konfigurasjon)"
              }
            >
              {aiCapabilityStatus === "available"
                ? "AI: Tilgjengelig"
                : aiCapabilityStatus === "loading"
                  ? "AI: Sjekker…"
                  : "AI: Ikke tilgjengelig"}
            </span>
            {(mediaHealthStatus === "checking" || mediaHealthStatus === "available" || mediaHealthStatus === "unavailable") && (
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  mediaHealthStatus === "available"
                    ? "border-[rgb(var(--lp-success))]/50 bg-[rgb(var(--lp-success))]/10 text-[rgb(var(--lp-success))]"
                    : mediaHealthStatus === "checking"
                      ? "border-[rgb(var(--lp-muted))]/50 bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-muted))]"
                      : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
                title={
                  mediaHealthStatus === "available"
                    ? "Mediearkiv er tilgjengelig"
                    : mediaHealthStatus === "checking"
                      ? "Sjekker medietjeneste"
                      : "Mediearkiv svarer ikke – sjekk at API er oppe"
                }
              >
                {mediaHealthStatus === "available"
                  ? "Media: Tilgjengelig"
                  : mediaHealthStatus === "checking"
                    ? "Media: Sjekker…"
                    : "Media: Feil"}
              </span>
            )}
            {(contentHealthStatus === "checking" || contentHealthStatus === "available" || contentHealthStatus === "unavailable") && (
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  contentHealthStatus === "available"
                    ? "border-[rgb(var(--lp-success))]/50 bg-[rgb(var(--lp-success))]/10 text-[rgb(var(--lp-success))]"
                    : contentHealthStatus === "checking"
                      ? "border-[rgb(var(--lp-muted))]/50 bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-muted))]"
                      : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
                title={
                  contentHealthStatus === "available"
                    ? "Innhold (side) er lastet"
                    : contentHealthStatus === "checking"
                      ? "Laster side"
                      : "Kunne ikke laste side eller innhold – sjekk at du har tilgang"
                }
              >
                {contentHealthStatus === "available"
                  ? "Content: OK"
                  : contentHealthStatus === "checking"
                    ? "Content: Laster…"
                    : "Content: Feil"}
              </span>
            )}
            {EDITOR_AI_CAPABILITY_LABELS.map((cap) => (
              <span
                key={cap}
                className="inline-flex rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]"
              >
                {cap}
              </span>
            ))}
            {aiCapabilityStatus === "available" && !allDisabled && onOpenAiAssist ? (
              <button
                type="button"
                onClick={onOpenAiAssist}
                className={buttonClass + " inline-flex items-center gap-1.5"}
                aria-label="Åpne AI-assistent"
              >
                <Icon name="ai" size="sm" aria-hidden />
                AI-assistent
              </button>
            ) : null}
          </div>
        </div>
        <div className="max-w-xs text-right space-y-1">
          {aiCapabilityStatus === "loading" ? (
            <p className="text-xs text-[rgb(var(--lp-muted))]">Sjekker AI-tilgjengelighet…</p>
          ) : aiCapabilityStatus === "unavailable" ? (
            <div className="space-y-1.5 text-right">
              <p className="inline-block rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                AI er ikke tilgjengelig (mangler serverkonfigurasjon).
              </p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Legg dette i <code className="rounded bg-slate-100 px-0.5 font-mono text-xs">.env.local</code> i prosjektroten.
              </p>
              <pre className="overflow-x-auto rounded border border-[rgb(var(--lp-border))] bg-slate-50 px-2 py-1 text-left text-xs font-mono text-[rgb(var(--lp-text))]">
                {"OPENAI_API_KEY=sk-...\nAI_PROVIDER=openai"}
              </pre>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Bruk én av disse variantene. Alternativ: <code className="font-mono text-xs">AI_API_KEY=sk-...</code> og <code className="font-mono text-xs">AI_PROVIDER=openai</code>.
              </p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Start dev-serveren på nytt etter at du har lagret <code className="font-mono text-xs">.env.local</code>.
              </p>
            </div>
          ) : errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <Icon name="warning" size="sm" className="shrink-0 text-red-600" />
                  <p className="text-xs font-medium text-red-800">AI-feil</p>
                </div>
                {onClearError ? (
                  <button
                    type="button"
                    onClick={onClearError}
                    className="shrink-0 rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                    aria-label="Lukk feilmelding"
                  >
                    Lukk
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-red-700">{errorMessage}</p>
              <p className="mt-0.5 text-xs text-red-600">Du kan prøve igjen eller lagre siden uten AI-endringer.</p>
            </div>
          ) : lastBlockBuilderResult ? (
            <BlockBuilderResultView result={lastBlockBuilderResult} />
          ) : diagnosticsResult && lastSummary ? (
            <div className="space-y-1 rounded border border-emerald-200 bg-emerald-50/80 px-2 py-1.5 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Diagnostikk-resultat
              </p>
              <p className="text-xs text-emerald-800">{lastSummary}</p>
              <p className="text-xs text-emerald-700">
                {diagnosticsResult.improvePage.applied || diagnosticsResult.seo.applied
                  ? "Endringer er applisert i editoren. Lagre siden for å beholde dem."
                  : "Se under for detaljer. Ingen endringer ble applisert automatisk."}
              </p>
            </div>
          ) : lastSummary ? (
            <div className="space-y-0.5">
              <p className="text-xs uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                Sist AI-kjøring
              </p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">{lastSummary}</p>
              {lastAppliedTool && (
                <p className="text-xs text-[rgb(var(--lp-muted))]">
                  AI oppdaterte innholdet i editoren. Husk å lagre siden når du er fornøyd.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Kjør Improve Page for å få forslag til forbedringer.
            </p>
          )}
        </div>
      </div>

      {/* Samlet sidediagnostikk */}
      <div className="mb-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
        <h4 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Diagnostikk</h4>
        <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
          Kjør Improve page og SEO optimize og se samlet resultat.
        </p>
        {diagnosticsResult ? (
          <div className="mt-3 space-y-3 border-t border-[rgb(var(--lp-border))] pt-3">
            <div className="grid gap-2 text-xs">
              <div className="flex items-start gap-2 rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 px-3 py-2">
                <span className="shrink-0 text-[rgb(var(--lp-text))]" aria-hidden>
                  {diagnosticsResult.improvePage.applied ? (
                    <Icon name="success" size="sm" className="text-[rgb(var(--lp-success))]" />
                  ) : (
                    <Icon name="warning" size="sm" className="text-amber-600" />
                  )}
                </span>
                <div>
                  <p className="font-medium text-[rgb(var(--lp-text))]">Struktur / Innhold</p>
                  <p className="mt-0.5 text-[rgb(var(--lp-muted))]">
                    {diagnosticsResult.improvePage.summary || "Ingen oppsummering."}
                  </p>
                  <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                    {diagnosticsResult.improvePage.applied
                      ? "✔ Endringer applisert i editoren. Lagre for å beholde."
                      : "⚠ Vurder forslag manuelt."}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 px-3 py-2">
                <span className="shrink-0 text-[rgb(var(--lp-text))]" aria-hidden>
                  {diagnosticsResult.seo.applied ? (
                    <Icon name="success" size="sm" className="text-[rgb(var(--lp-success))]" />
                  ) : (
                    <Icon name="warning" size="sm" className="text-amber-600" />
                  )}
                </span>
                <div>
                  <p className="font-medium text-[rgb(var(--lp-text))]">SEO</p>
                  <p className="mt-0.5 text-[rgb(var(--lp-muted))]">
                    {diagnosticsResult.seo.summary || "Ingen oppsummering."}
                  </p>
                  <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                    {diagnosticsResult.seo.applied
                      ? "✔ Endringer applisert i editoren. Lagre for å beholde."
                      : "⚠ Vurder forslag manuelt."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="mt-3 inline-flex items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
            disabled={allDisabled || !onRunDiagnostics || diagnosticsBusy}
            onClick={() => void onRunDiagnostics?.()}
          >
            {diagnosticsBusy ? "Kjører sidediagnostikk…" : "Kjør sidediagnostikk"}
          </button>
        )}
      </div>

      {/* Siste AI-handlinger */}
      {aiHistory.length > 0 ? (
        <div className="mb-4 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
            Siste AI-handlinger
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-[rgb(var(--lp-text))]">
            {aiHistory.slice(0, 5).map((entry) => (
              <li key={entry.id} className="flex items-baseline gap-2">
                <span className="font-medium">{entry.label}</span>
                {entry.detail ? (
                  <span className="text-[rgb(var(--lp-muted))]">– {entry.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Block-aware AI groups */}
      {orderedGroupIds.map((groupId, i) => {
        const config = GROUP_CONFIG[groupId];
        if (!config) return null;
        const isFirst = i === 0;
        return (
          <div
            key={groupId}
            className={`mb-4 rounded-xl border p-4 ${
              isFirst
                ? "border-rose-200 bg-rose-50/30 ring-1 ring-rose-100"
                : "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40"
            }`}
          >
            {isFirst && (
              <span className="mb-2 inline-block rounded-full border border-rose-200 bg-rose-100/50 px-2.5 py-0.5 text-[11px] font-medium text-rose-800">
                Anbefalt nå
              </span>
            )}
            <h4 className="text-sm font-semibold text-[rgb(var(--lp-text))]">{config.title}</h4>
            <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">{config.helper}</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {config.toolIds.map((toolId) => (
                <Fragment key={toolId}>
                  {toolId === "improvePage" && (
                    <div className={cardClass}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Improve Page</p>
                        <span className="inline-flex items-center rounded-full border border-[rgb(var(--lp-border))] px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                          Diagnostikk
                        </span>
                      </div>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">
                        Analyserer siden for SEO, struktur og innholdshull. Gir konkrete forbedringsforslag i editoren.
                      </p>
                      <div className="mt-1 grid gap-1.5 text-xs">
                        <label className="grid gap-0.5">
                          <span className="text-[rgb(var(--lp-muted))]">Mål</span>
                          <select
                            className="h-7 rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-xs"
                            value={improveGoal}
                            onChange={(e) => setImproveGoal(e.target.value as "lead" | "info" | "signup")}
                          >
                            <option value="lead">Få forespørsler</option>
                            <option value="info">Informasjon</option>
                            <option value="signup">Registrering</option>
                          </select>
                        </label>
                        <label className="grid gap-0.5">
                          <span className="text-[rgb(var(--lp-muted))]">Målgruppe (valgfritt)</span>
                          <input
                            className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                            value={improveAudience}
                            onChange={(e) => setImproveAudience(e.target.value)}
                            placeholder="HR, ledelse …"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={allDisabled || !onImprovePage || improveBusy}
                        onClick={() =>
                          onImprovePage?.({
                            goal: improveGoal,
                            audience: improveAudience.trim(),
                          })
                        }
                      >
                        {improveBusy ? "Kjører…" : "Kjør forbedringsforslag"}
                      </button>
                      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                        Når det er trygt, oppdaterer AI blokker direkte i editoren. Husk å lagre siden for å gjøre endringene permanente.
                      </p>
                    </div>
                  )}
                  {toolId === "seoOptimize" && (
                    <div className={cardClass}>
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">SEO optimize side</p>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">
                        Diagnostikk: tittel, beskrivelse og nøkkelord. Foreslår forbedringer uten å endre blokkstruktur.
                      </p>
                      <div className="mt-1 grid gap-1.5 text-xs">
                        <label className="grid gap-0.5">
                          <span className="text-[rgb(var(--lp-muted))]">Mål</span>
                          <select
                            className="h-7 rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-xs"
                            value={seoGoal}
                            onChange={(e) => setSeoGoal(e.target.value as "lead" | "info" | "signup")}
                          >
                            <option value="lead">Få forespørsler</option>
                            <option value="info">Informasjon</option>
                            <option value="signup">Registrering</option>
                          </select>
                        </label>
                        <label className="grid gap-0.5">
                          <span className="text-[rgb(var(--lp-muted))]">Målgruppe (valgfritt)</span>
                          <input
                            className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                            value={seoAudience}
                            onChange={(e) => setSeoAudience(e.target.value)}
                            placeholder="Beslutningstakere …"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={allDisabled || !onSeoOptimize || seoBusy}
                        onClick={() =>
                          onSeoOptimize?.({
                            goal: seoGoal,
                            audience: seoAudience.trim(),
                          })
                        }
                      >
                        {seoBusy ? "Kjører…" : "Foreslå SEO-forbedringer"}
                      </button>
                    </div>
                  )}
                  {toolId === "generateSections" && (
                    <div className={cardClass}>
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Generate sections</p>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">
                        Utkast til nye seksjoner basert på kort beskrivelse.
                      </p>
                      <div className="mt-1 grid gap-1.5 text-xs">
                        <label className="grid gap-0.5">
                          <span className="text-[rgb(var(--lp-muted))]">Mål</span>
                          <input
                            className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                            value={sectionsGoal}
                            onChange={(e) => setSectionsGoal(e.target.value)}
                            placeholder="Få demo-forespørsler …"
                          />
                        </label>
                        <label className="grid gap-0.5">
                          <span className="text-[rgb(var(--lp-muted))]">Målgruppe</span>
                          <input
                            className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                            value={sectionsAudience}
                            onChange={(e) => setSectionsAudience(e.target.value)}
                            placeholder="HR, kontoransvarlig …"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={allDisabled || !onGenerateSections || sectionsBusy}
                        onClick={() =>
                          onGenerateSections?.({
                            goal: sectionsGoal.trim(),
                            audience: sectionsAudience.trim(),
                          })
                        }
                      >
                        {sectionsBusy ? "Kjører…" : "Foreslå seksjoner"}
                      </button>
                    </div>
                  )}
                  {toolId === "structuredIntent" && (
                    <div className={cardClass}>
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Structured intent</p>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">
                        Strukturer brukerintensjon som grunnlag for A/B-varianter.
                      </p>
                      <div className="mt-1 grid gap-1.5 text-xs">
                        <label className="grid gap-0.5">
                          <span className="text-[rgb(var(--lp-muted))]">Antall varianter</span>
                          <select
                            className="h-7 rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-xs"
                            value={intentVariantCount}
                            onChange={(e) => setIntentVariantCount(Number(e.target.value) === 3 ? 3 : 2)}
                          >
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                          </select>
                        </label>
                        <label className="grid gap-0.5">
                          <span className="text-[rgb(var(--lp-muted))]">Målområde</span>
                          <select
                            className="h-7 rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-xs"
                            value={intentTarget}
                            onChange={(e) =>
                              setIntentTarget(e.target.value === "hero_only" ? "hero_only" : "hero_cta")
                            }
                          >
                            <option value="hero_cta">Hero + CTA</option>
                            <option value="hero_only">Kun hero</option>
                          </select>
                        </label>
                      </div>
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={allDisabled || !onStructuredIntent || intentBusy}
                        onClick={() =>
                          onStructuredIntent?.({
                            variantCount: intentVariantCount,
                            target: intentTarget,
                          })
                        }
                      >
                        {intentBusy ? "Kjører…" : "Generer A/B-varianter"}
                      </button>
                    </div>
                  )}
                  {toolId === "layoutDesign" && (
                    <div className={cardClass}>
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Layout &amp; design</p>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">
                        Får layout- og designforslag basert på sidens blokker og tittel.
                      </p>
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={allDisabled || !onLayoutSuggestions || layoutSuggestionsBusy}
                        onClick={() => onLayoutSuggestions?.()}
                      >
                        {layoutSuggestionsBusy ? "Kjører…" : "Hent layoutforslag"}
                      </button>
                      {lastLayoutSuggestionsResult && lastLayoutSuggestionsResult.suggestions.length > 0 ? (
                        <ul className="mt-2 space-y-2 border-t border-[rgb(var(--lp-border))] pt-2 text-xs">
                          {lastLayoutSuggestionsResult.suggestions.map((s, si) => (
                            <li
                              key={si}
                              className="rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 px-2 py-1.5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-1.5">
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium text-[rgb(var(--lp-text))]">{s.title}</span>
                                  {s.priority ? (
                                    <span className="ml-1.5 text-xs uppercase text-[rgb(var(--lp-muted))]">
                                      {s.priority}
                                    </span>
                                  ) : null}
                                  <p className="mt-0.5 text-[rgb(var(--lp-muted))]">{s.reason}</p>
                                  {s.previewLabel ? (
                                    <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
                                      Vil: {s.previewLabel}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-1">
                                  {s.applyPatch != null && onApplyDesignSuggestion ? (
                                    <button
                                      type="button"
                                      className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                      onClick={() => onApplyDesignSuggestion(s)}
                                      aria-label={`Bruk forslag: ${s.title}`}
                                    >
                                      Bruk
                                    </button>
                                  ) : null}
                                  {onDismissDesignSuggestion ? (
                                    <button
                                      type="button"
                                      className="rounded border border-[rgb(var(--lp-border))] bg-white px-2 py-1 text-xs font-medium text-[rgb(var(--lp-muted))] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-1"
                                      onClick={() => onDismissDesignSuggestion({ kind: s.kind, title: s.title })}
                                      aria-label={`Avvis forslag: ${s.title}`}
                                    >
                                      Avvis
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )}
                  {toolId === "imageMetadata" && (
                    <div className={cardClass}>
                      <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Image metadata helper</p>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">
                        Bruker eksisterende bilder til å foreslå alt-tekst, bildetekst og tags.
                      </p>
                      <div className="mt-1 grid gap-1.5 text-xs">
                        <label className="grid gap-0.5">
                          <span className="text-[rgb(var(--lp-muted))]">Media item ID</span>
                          <input
                            className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                            value={metaMediaItemId}
                            onChange={(e) => setMetaMediaItemId(e.target.value)}
                            placeholder="UUID fra mediearkiv"
                          />
                        </label>
                        <label className="grid gap-0.5">
                          <span className="text-[rgb(var(--lp-muted))]">Bilde-URL (valgfritt)</span>
                          <input
                            className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                            value={metaUrl}
                            onChange={(e) => setMetaUrl(e.target.value)}
                            placeholder="https://…"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={
                          allDisabled ||
                          !onImageImproveMetadata ||
                          imageMetaBusy ||
                          (!metaMediaItemId.trim() && !metaUrl.trim())
                        }
                        onClick={() =>
                          onImageImproveMetadata?.({
                            mediaItemId: metaMediaItemId.trim(),
                            url: metaUrl.trim(),
                          })
                        }
                      >
                        {imageMetaBusy ? "Kjører…" : "Foreslå metadata"}
                      </button>
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mb-4">
        <h4 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Flere verktøy</h4>
        <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
          Sidegenerering, blokk-bygger, bilde og referanse.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">AI Page Composer</p>
            <span className="inline-flex rounded-full border border-[rgb(var(--lp-border))] px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              Full side · kun kladd
            </span>
          </div>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Generer en full sidestruktur fra beskrivelse eller strukturt intent. Resultatet er kun kladd; du må gjennomgå og lagre før publisering.
          </p>
          <label className="mt-1 grid gap-0.5">
            <span className="text-[rgb(var(--lp-muted))]">Beskrivelse / tittel</span>
            <textarea
              className="min-h-18 rounded border border-[rgb(var(--lp-border))] px-2 py-1.5 text-xs"
              value={pageBuilderPrompt}
              onChange={(e) => setPageBuilderPrompt(e.target.value)}
              placeholder="F.eks. Landingsside for bedriftslunsj med hero, verdier og CTA."
              rows={3}
            />
          </label>
          <details className="mt-2 rounded border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40">
            <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))]">
              Strukturt intent (valgfritt)
            </summary>
            <div className="space-y-1.5 border-t border-[rgb(var(--lp-border))] px-2 py-2 text-xs">
              <label className="grid gap-0.5">
                <span className="text-[rgb(var(--lp-muted))]">Mål</span>
                <input
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1"
                  value={pageBuilderGoal}
                  onChange={(e) => setPageBuilderGoal(e.target.value)}
                  placeholder="F.eks. lead, signup"
                />
              </label>
              <label className="grid gap-0.5">
                <span className="text-[rgb(var(--lp-muted))]">Målgruppe</span>
                <input
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1"
                  value={pageBuilderAudience}
                  onChange={(e) => setPageBuilderAudience(e.target.value)}
                  placeholder="F.eks. HR, beslutningstakere"
                />
              </label>
              <label className="grid gap-0.5">
                <span className="text-[rgb(var(--lp-muted))]">Tone</span>
                <select
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1 bg-white"
                  value={pageBuilderTone}
                  onChange={(e) => setPageBuilderTone(e.target.value as "enterprise" | "warm" | "neutral")}
                >
                  <option value="enterprise">Enterprise</option>
                  <option value="warm">Varm</option>
                  <option value="neutral">Nøytral</option>
                </select>
              </label>
              <label className="grid gap-0.5">
                <span className="text-[rgb(var(--lp-muted))]">Sidetype</span>
                <select
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1 bg-white"
                  value={pageBuilderPageType}
                  onChange={(e) => setPageBuilderPageType(e.target.value as "landing" | "contact" | "info" | "pricing" | "generic")}
                >
                  <option value="landing">Landing</option>
                  <option value="contact">Kontakt</option>
                  <option value="info">Info / Slik fungerer</option>
                  <option value="pricing">Priser</option>
                  <option value="generic">Generisk</option>
                </select>
              </label>
              <label className="grid gap-0.5">
                <span className="text-[rgb(var(--lp-muted))]">CTA-intent</span>
                <select
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1 bg-white"
                  value={pageBuilderCtaIntent}
                  onChange={(e) => setPageBuilderCtaIntent(e.target.value as "demo" | "contact" | "quote" | "start")}
                >
                  <option value="contact">Kontakt</option>
                  <option value="demo">Demo</option>
                  <option value="quote">Tilbud</option>
                  <option value="start">Start nå</option>
                </select>
              </label>
              <label className="grid gap-0.5">
                <span className="text-[rgb(var(--lp-muted))]">Inkluder seksjoner (kommaseparert)</span>
                <input
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1"
                  value={pageBuilderSectionsInclude}
                  onChange={(e) => setPageBuilderSectionsInclude(e.target.value)}
                  placeholder="hero, richText, cta"
                />
              </label>
              <label className="grid gap-0.5">
                <span className="text-[rgb(var(--lp-muted))]">Ekskluder seksjoner (kommaseparert)</span>
                <input
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1"
                  value={pageBuilderSectionsExclude}
                  onChange={(e) => setPageBuilderSectionsExclude(e.target.value)}
                  placeholder="image, banners"
                />
              </label>
            </div>
          </details>
          {(() => {
            const hasStructured =
              pageBuilderGoal.trim() ||
              pageBuilderAudience.trim() ||
              pageBuilderTone !== "enterprise" ||
              pageBuilderPageType !== "landing" ||
              pageBuilderCtaIntent !== "contact" ||
              pageBuilderSectionsInclude.trim() ||
              pageBuilderSectionsExclude.trim();
            const canGenerate = pageBuilderPrompt.trim() || hasStructured;
            return (
              <button
                type="button"
                className={buttonClass}
                disabled={allDisabled || !onPageBuilder || pageBuilderBusyId || !canGenerate}
                onClick={() => {
                  const include = pageBuilderSectionsInclude.trim()
                    ? pageBuilderSectionsInclude.split(",").map((s) => s.trim()).filter(Boolean)
                    : undefined;
                  const exclude = pageBuilderSectionsExclude.trim()
                    ? pageBuilderSectionsExclude.split(",").map((s) => s.trim()).filter(Boolean)
                    : undefined;
                  onPageBuilder?.({
                    prompt: pageBuilderPrompt.trim() || undefined,
                    goal: pageBuilderGoal.trim() || undefined,
                    audience: pageBuilderAudience.trim() || undefined,
                    tone: pageBuilderTone,
                    pageType: pageBuilderPageType,
                    ctaIntent: pageBuilderCtaIntent,
                    sectionsInclude: include,
                    sectionsExclude: exclude,
                  });
                }}
              >
                {pageBuilderBusyId ? "Genererer…" : "Generer side"}
              </button>
            );
          })()}
          {lastPageBuilderResult && lastPageBuilderResult.blocks.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-[rgb(var(--lp-border))] pt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                Generert resultat
              </h5>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                {lastPageBuilderResult.blocks.length} blokker generert
                {lastPageBuilderResult.title ? ` · ${lastPageBuilderResult.title}` : ""}
              </p>
              <div>
                <p className="text-xs font-medium text-[rgb(var(--lp-text))]">Blokker:</p>
                <p className="mt-0.5 font-mono text-xs text-[rgb(var(--lp-muted))]">
                  {(() => {
                    const types = lastPageBuilderResult.blocks
                      .map((b) => (typeof b.type === "string" ? b.type : "?"))
                      .filter((t) => t);
                    return types.length ? types.join(", ") : "—";
                  })()}
                </p>
              </div>
              {lastPageBuilderResult.droppedBlocks && lastPageBuilderResult.droppedBlocks.length > 0 ? (
                <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
                  <p className="text-xs font-medium text-amber-800">Droppet:</p>
                  <ul className="mt-0.5 space-y-0.5 text-xs text-amber-700">
                    {lastPageBuilderResult.droppedBlocks.map((d, i) => (
                      <li key={i}>blokk {d.index + 1} (type: {d.type || "unknown"})</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-amber-700">
                    Denne blokktypen støttes ikke av Lunchportalen-editoren.
                  </p>
                </div>
              ) : null}
              {lastPageBuilderResult.summary ? (
                <p className="text-xs text-[rgb(var(--lp-muted))]">{lastPageBuilderResult.summary}</p>
              ) : null}
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Erstatt alle nåværende blokker eller legg til under. Forstå resultatet før du klikker.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => onPageBuilderReplace?.()}
                >
                  Erstatt innhold
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => onPageBuilderAppend?.()}
                >
                  Legg til under
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">AI Block Builder</p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Beskriv blokken du ønsker; AI foreslår en ferdig blokk.
          </p>
          <label className="mt-1 grid gap-0.5">
            <span className="text-[rgb(var(--lp-muted))]">Beskrivelse</span>
            <input
              className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
              value={blockBuilderDescription}
              onChange={(e) => setBlockBuilderDescription(e.target.value)}
              placeholder="F.eks. hero med overskrift og CTA"
            />
          </label>
          <button
            type="button"
            className={buttonClass}
            disabled={
              allDisabled ||
              !onBlockBuilder ||
              blockBuilderBusy ||
              !blockBuilderDescription.trim()
            }
            onClick={() =>
              onBlockBuilder?.({ description: blockBuilderDescription.trim() })
            }
          >
            {blockBuilderBusy ? "Kjører…" : "Bygg blokk"}
          </button>
          {lastBlockBuilderResult && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--lp-border))] pt-2">
              <button
                type="button"
                className={buttonClass}
                onClick={() => onBlockBuilderInsert?.()}
              >
                Sett inn blokk
              </button>
              <span className="text-xs text-[rgb(var(--lp-muted))]">
                {typeof lastBlockBuilderResult.block?.type === "string"
                  ? lastBlockBuilderResult.block.type
                  : "blokk"}
              </span>
            </div>
          )}
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">AI Image Generator</p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Prompt → generert bilde → lagres i mediearkiv med metadata → velg i hero- eller bildeblokk.
          </p>
          <div className="mt-1 grid gap-1.5 text-xs">
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Formål</span>
              <select
                className="h-7 rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-xs"
                value={imagePurpose}
                onChange={(e) =>
                  setImagePurpose(
                    e.target.value === "section"
                      ? "section"
                      : e.target.value === "social"
                      ? "social"
                      : "hero",
                  )
                }
              >
                <option value="hero">Hero</option>
                <option value="section">Seksjon</option>
                <option value="social">Sosiale medier</option>
              </select>
            </label>
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Tema</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={imageTopic}
                onChange={(e) => setImageTopic(e.target.value)}
                placeholder="F.eks. firmalunsj på kontor"
              />
            </label>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={allDisabled || !onImageGenerate || imageGenerateBusy || !imageTopic.trim()}
            onClick={() =>
              onImageGenerate?.({
                purpose: imagePurpose,
                topic: imageTopic.trim(),
              })
            }
          >
            {imageGenerateBusy ? "Kjører…" : "Foreslå bilder"}
          </button>
          {lastGeneratedImageResult && lastGeneratedImageResult.prompts.length > 0 ? (
            <div className="mt-3 space-y-2 border-t border-[rgb(var(--lp-border))] pt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                Promptforslag for bilde
              </h5>
              <p className="text-xs text-[rgb(var(--lp-text))]">
                Ingen bilder er generert. Bruk promptene nedenfor i et bildeverktøy (f.eks. DALL·E, Midjourney), last opp resultatet til mediearkivet, og velg det i blokken.
              </p>
              <ul className="list-inside list-decimal space-y-1 text-xs text-[rgb(var(--lp-text))]">
                {lastGeneratedImageResult.prompts.map((p, i) => (
                  <li key={i}>
                    <span className="font-medium">Prompt:</span> {p.prompt}
                    {p.alt ? ` — Alt: ${p.alt}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Foreslår merkesikre bilde-prompter. Bruk dem i et bildeverktøy og last opp til mediearkiv.
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Screenshot / referanse → blokker</p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Konverter en referanseside eller layout til Lunchportalen-blokker (ikke rå HTML). URL eller beskrivelse.
          </p>
          <div className="mt-1 grid gap-1.5 text-xs">
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Skjermbilde-URL (valgfritt)</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={screenshotUrl}
                onChange={(e) => setScreenshotUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Beskrivelse (valgfritt)</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={screenshotDescription}
                onChange={(e) => setScreenshotDescription(e.target.value)}
                placeholder="F.eks. landing med hero og CTA"
              />
            </label>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={
              allDisabled ||
              !onScreenshotBuilder ||
              screenshotBuilderBusy ||
              (!screenshotUrl.trim() && !screenshotDescription.trim())
            }
            onClick={() =>
              onScreenshotBuilder?.({
                screenshotUrl: screenshotUrl.trim() || undefined,
                description: screenshotDescription.trim() || undefined,
              })
            }
          >
            {screenshotBuilderBusy ? "Kjører…" : "Bygg fra skjermbilde"}
          </button>
          {lastScreenshotBuilderResult && Array.isArray(lastScreenshotBuilderResult.blocks) && lastScreenshotBuilderResult.blocks.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-[rgb(var(--lp-border))] pt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                Resultat fra referanse
              </h5>
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                {lastScreenshotBuilderResult.blocks.length} blokker
              </p>
              {lastScreenshotBuilderResult.blockTypes && lastScreenshotBuilderResult.blockTypes.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-[rgb(var(--lp-text))]">Blokktyper:</p>
                  <p className="mt-0.5 font-mono text-xs text-[rgb(var(--lp-muted))]">
                    {lastScreenshotBuilderResult.blockTypes.join(", ")}
                  </p>
                </div>
              ) : null}
              {lastScreenshotBuilderResult.warnings && lastScreenshotBuilderResult.warnings.length > 0 ? (
                <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
                  <p className="text-xs font-medium text-amber-800">Advarsler:</p>
                  <ul className="mt-0.5 list-inside list-disc text-xs text-amber-700">
                    {lastScreenshotBuilderResult.warnings.map((w, i) => (
                      <li key={i}>{typeof w === "string" ? w : String(w)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {lastScreenshotBuilderResult.message ? (
                <p className="text-xs text-[rgb(var(--lp-muted))]">{lastScreenshotBuilderResult.message}</p>
              ) : null}
              <p className="text-xs text-[rgb(var(--lp-muted))]">
                Lunchportalen bruker blokkbasert struktur. Elementer som ikke passer i blokkmodellen blir droppet.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => onScreenshotBuilderReplace?.()}
                >
                  Erstatt innhold
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => onScreenshotBuilderAppend?.()}
                >
                  Legg til under
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
      </div>
    </section>
  );
}
