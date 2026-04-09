"use client";

import { AiTextAssistPopover } from "@/components/cms";
import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import type {
  BannerBlock,
  DividerBlock,
  FormBlock,
  ImageBlock,
  RichTextBlock,
} from "../editorBlockTypes";
import { PropertyEditorSection } from "../PropertyEditorSection";
import { useBlockDatasetAdapter } from "../useBlockDatasetAdapter";
import { PropertyEditorPreviewHint } from "./PropertyEditorPreviewHint";

/**
 * Enkel tekstflate — deles fordi den er lineær (overskrift + brødtekst) og ikke konkurrerer med
 * markedsføringsblokkene over. AI-inline fortsettelse er bundet til richText-typen.
 */
export function RichTextPropertyEditor(props: { block: RichTextBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);
  const {
    isOffline,
    richTextDirectAiBusy,
    richTextInline,
    setRichTextInline,
    inlineAbortRef,
    inlineBodyRunRef,
    inlineBodyDebounceRef,
    fetchRichTextInlineBody,
    runRichTextContinueAtCursor,
    runRichTextRewriteSelection,
    richTextInlineRef,
  } = ctx;

  return (
    <div className="grid gap-3" data-lp-property-editor-root="richText">
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Innhold">
        <label className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[rgb(var(--lp-muted))]">Overskrift</span>
            <AiTextAssistPopover
              fieldLabel="Rich text overskrift"
              value={block.heading || ""}
              disabled={isOffline}
              onApply={(t) => commit((c) => (c.type === "richText" ? { ...c, heading: t } : c))}
            />
          </div>
          <input
            value={block.heading || ""}
            onChange={(e) => commit((c) => (c.type === "richText" ? { ...c, heading: e.target.value } : c))}
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="flex flex-wrap items-baseline justify-between gap-2 text-[rgb(var(--lp-muted))]">
            <span className="flex items-center gap-1">
              Brødtekst
              <AiTextAssistPopover
                fieldLabel="Rich text brødtekst"
                value={block.body}
                stripHtmlBeforeSend
                disabled={isOffline}
                onApply={(t) => commit((c) => (c.type === "richText" ? { ...c, body: t } : c))}
              />
            </span>
            <span className="flex max-w-full flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-[10px] font-normal normal-case text-slate-400">
              {richTextDirectAiBusy?.blockId === block.id ? (
                <span aria-live="polite">
                  {richTextDirectAiBusy.op === "continue" ? "AI fortsetter…" : "AI omskriver…"}
                </span>
              ) : null}
              {richTextInline.blockId === block.id && richTextInline.suffix ? (
                <span>Tab godtar · Esc skjuler</span>
              ) : null}
              <span>Ctrl+Enter fortsett · Ctrl+K omskriv valg</span>
            </span>
          </span>
          <div className="relative isolate min-h-32 rounded-lg border border-[rgb(var(--lp-border))] bg-white focus-within:ring-2 focus-within:ring-black/10">
            {richTextInline.blockId === block.id && richTextInline.suffix ? (
              <div
                className="pointer-events-none absolute inset-0 z-10 overflow-clip rounded-[inherit]"
                aria-hidden
              >
                <span className="absolute left-3 top-2 inline-block max-w-[calc(100%-1.5rem)] whitespace-pre-wrap break-words text-left text-sm italic leading-6 tracking-wide text-slate-300/40 opacity-[0.32]">
                  {richTextInline.suffix}
                </span>
              </div>
            ) : null}
            <textarea
              value={block.body}
              onChange={(e) => {
                const value = e.target.value;
                inlineAbortRef.current?.abort();
                setRichTextInline((g) => (g.blockId === block.id ? { blockId: block.id, suffix: "" } : g));
                commit((c) => (c.type === "richText" ? { ...c, body: value } : c));
                const heading = block.heading || "";
                inlineBodyRunRef.current = () => {
                  void fetchRichTextInlineBody(block.id, value, heading);
                };
                inlineBodyDebounceRef.current();
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  void runRichTextContinueAtCursor(
                    block.id,
                    e.currentTarget,
                    block.body,
                    block.heading || "",
                  );
                  return;
                }
                if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
                  e.preventDefault();
                  void runRichTextRewriteSelection(block.id, e.currentTarget, block.body, "clearer");
                  return;
                }
                if (e.key === "Escape") {
                  const g = richTextInlineRef.current;
                  if (g.blockId === block.id && g.suffix) {
                    e.preventDefault();
                    setRichTextInline({ blockId: null, suffix: "" });
                  }
                  return;
                }
                if (e.key === "Tab") {
                  const g = richTextInlineRef.current;
                  const ta = e.currentTarget;
                  if (
                    g.blockId !== block.id ||
                    !g.suffix ||
                    ta.selectionStart !== ta.value.length ||
                    ta.selectionEnd !== ta.value.length
                  ) {
                    return;
                  }
                  e.preventDefault();
                  const merged = ta.value + g.suffix;
                  commit((c) => (c.type === "richText" ? { ...c, body: merged } : c));
                  setRichTextInline({ blockId: null, suffix: "" });
                }
              }}
              className={
                "relative z-20 min-h-32 w-full resize-y bg-transparent px-3 py-2 text-sm leading-6 text-[rgb(var(--lp-text))] caret-[rgb(var(--lp-text))] selection:bg-sky-200/40 outline-none" +
                (richTextDirectAiBusy?.blockId === block.id ? " opacity-80" : "")
              }
              aria-busy={richTextDirectAiBusy?.blockId === block.id}
              spellCheck
            />
          </div>
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="Veiledning">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">HTML tillates i brødtekst der malen støtter det.</p>
      </PropertyEditorSection>
    </div>
  );
}

export function ImagePropertyEditor(props: { block: ImageBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);
  const {
    cmsAiImagePromptByBlockId,
    setCmsAiImagePromptByBlockId,
    cmsAiImageBusyBlockId,
    onCmsAiGenerateImageForBlock,
  } = ctx;

  return (
    <div className="grid gap-3" data-lp-property-editor-root="image">
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Innhold · bilde og tekst">
        <label className="grid gap-1">
          <span className="text-[rgb(var(--lp-muted))]">Bilde (ID / URL)</span>
          <input
            value={block.imageId || ""}
            onChange={(e) => commit((c) => (c.type === "image" ? { ...c, imageId: e.target.value } : c))}
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            placeholder="cms:*, media-ID, https://…"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[rgb(var(--lp-muted))]">Alt-tekst</span>
          <input
            value={block.alt || ""}
            onChange={(e) => commit((c) => (c.type === "image" ? { ...c, alt: e.target.value } : c))}
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[rgb(var(--lp-muted))]">Bildetekst</span>
          <input
            value={block.caption || ""}
            onChange={(e) => commit((c) => (c.type === "image" ? { ...c, caption: e.target.value } : c))}
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="AI-bilde (valgfri)">
        <label className="grid gap-1">
          <span className="text-[rgb(var(--lp-muted))]">Prompt</span>
          <input
            type="text"
            value={cmsAiImagePromptByBlockId[block.id] ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setCmsAiImagePromptByBlockId((prev) => ({ ...prev, [block.id]: v }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            disabled={cmsAiImageBusyBlockId === block.id}
            placeholder="Beskriv bildet du vil generere…"
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-60"
            aria-label="Beskriv bildet du vil generere med AI"
          />
        </label>
        <button
          type="button"
          disabled={
            cmsAiImageBusyBlockId === block.id || !(cmsAiImagePromptByBlockId[block.id] ?? "").trim()
          }
          onClick={() =>
            void onCmsAiGenerateImageForBlock(block.id, cmsAiImagePromptByBlockId[block.id] ?? "")
          }
          className="min-h-[40px] w-fit rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]/80 disabled:opacity-50"
        >
          {cmsAiImageBusyBlockId === block.id ? "Genererer…" : "Generer bilde (AI)"}
        </button>
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          URL fra AI settes i feltet over. Ingen auto-lagring eller publisering.
        </p>
      </PropertyEditorSection>
    </div>
  );
}

/** Kort budskap på bakgrunnsbilde — ikke full CTA-seksjon. */
export function BannerPropertyEditor(props: { block: BannerBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);

  return (
    <div className="grid gap-3" data-lp-property-editor-root="banner">
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Innhold · budskap og knapp">
        <p className="text-[11px] text-[rgb(var(--lp-muted))]">
          Strip med én knapp. CTA-blokken er for lengre seksjon med sekundær lenke og mer tekst.
        </p>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Tekst</span>
          <textarea
            value={block.text || ""}
            onChange={(e) => commit((c) => (c.type === "banner" ? { ...c, text: e.target.value } : c))}
            className="min-h-24 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
          />
        </label>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Knappetekst</span>
            <input
              value={block.ctaLabel || ""}
              onChange={(e) => commit((c) => (c.type === "banner" ? { ...c, ctaLabel: e.target.value } : c))}
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[rgb(var(--lp-muted))]">Knappelenke</span>
            <input
              value={block.ctaHref || ""}
              onChange={(e) => commit((c) => (c.type === "banner" ? { ...c, ctaHref: e.target.value } : c))}
              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          </label>
        </div>
      </PropertyEditorSection>
      <PropertyEditorSection section="settings" overline="Presentasjon · bakgrunn">
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Bakgrunnsbilde (ID / URL)</span>
          <input
            value={block.backgroundImageId || ""}
            onChange={(e) =>
              commit((c) => (c.type === "banner" ? { ...c, backgroundImageId: e.target.value } : c))
            }
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
      </PropertyEditorSection>
    </div>
  );
}

export function FormPropertyEditor(props: { block: FormBlock; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  const { commit } = useBlockDatasetAdapter(block, ctx.setBlockById);

  return (
    <div className="grid gap-3" data-lp-property-editor-root="form">
      <PropertyEditorPreviewHint blockType={block.type} />
      <PropertyEditorSection section="content" overline="Innhold">
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Form-ID</span>
          <input
            value={block.formId}
            onChange={(e) => commit((c) => (c.type === "form" ? { ...c, formId: e.target.value } : c))}
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Tittel (valgfri)</span>
          <input
            value={block.title || ""}
            onChange={(e) => commit((c) => (c.type === "form" ? { ...c, title: e.target.value } : c))}
            className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
          />
        </label>
      </PropertyEditorSection>
    </div>
  );
}

export function DividerPropertyEditor(props: { block: DividerBlock }) {
  return (
    <div data-lp-property-editor-root="divider">
      <PropertyEditorSection section="content" overline="Innhold">
        <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">
          Skillelinje har ingen redigerbare felter. Slett blokk om du vil fjerne den.
        </div>
      </PropertyEditorSection>
    </div>
  );
}
