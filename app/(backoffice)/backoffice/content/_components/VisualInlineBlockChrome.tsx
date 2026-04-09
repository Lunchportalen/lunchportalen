"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type PreviewBlock = { id: string; type: string } & Record<string, unknown>;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Tri = "left" | "center" | "right";

function EditableLine({
  initialValue,
  placeholder,
  hint,
  className,
  onCommit,
}: {
  initialValue: string;
  placeholder: string;
  hint?: string;
  className?: string;
  onCommit: (next: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el) el.textContent = initialValue;
  }, [initialValue]);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== initialValue) el.textContent = initialValue;
  }, [initialValue]);

  return (
    <div className="min-w-0">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={placeholder}
        data-placeholder={placeholder}
        className={cn(
          "rounded border border-transparent px-1.5 py-0.5 text-sm outline-none transition-[opacity,transform] duration-150 hover:border-slate-200 focus:border-pink-400/60 focus:ring-1 focus:ring-pink-400/40 empty:before:pointer-events-none empty:before:text-slate-400 empty:before:opacity-60 empty:before:content-[attr(data-placeholder)]",
          className
        )}
        onBlur={() => onCommit((ref.current?.textContent ?? "").replace(/\u00a0/g, " ").trim())}
      />
      {hint ? <p className="mt-0.5 text-[10px] text-amber-800/80">{hint}</p> : null}
    </div>
  );
}

function RichTextBodyField({
  initialBody,
  hint,
  onCommit,
}: {
  initialBody: string;
  hint?: string;
  onCommit: (next: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el) el.textContent = initialBody;
  }, [initialBody]);
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== initialBody) el.textContent = initialBody;
  }, [initialBody]);
  return (
    <div className="min-w-0">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Brødtekst"
        data-placeholder="Brødtekst"
        className="max-h-36 min-h-[4rem] overflow-auto rounded border border-transparent px-1.5 py-1 text-sm text-slate-700 outline-none transition-[opacity,transform] duration-150 focus:border-pink-400/60 focus:ring-1 focus:ring-pink-400/40 empty:before:pointer-events-none empty:before:text-slate-400 empty:before:opacity-60 empty:before:content-[attr(data-placeholder)]"
        onBlur={() => onCommit((ref.current?.textContent ?? "").replace(/\u00a0/g, " ").trim())}
      />
      {hint ? <p className="mt-0.5 text-[10px] text-amber-800/80">{hint}</p> : null}
    </div>
  );
}

function LayoutToolbar({
  value,
  onChange,
}: {
  value: Tri;
  onChange: (v: Tri) => void;
}) {
  const opts: { v: Tri; label: string }[] = [
    { v: "left", label: "Venstre" },
    { v: "center", label: "Midt" },
    { v: "right", label: "Høyre" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Layout">
      {opts.map(({ v, label }) => (
        <button
          key={v}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(v);
          }}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm transition-all duration-150 hover:scale-[1.03] active:scale-[0.98]",
            value === v ?
              "border-pink-500/70 bg-pink-50 text-pink-900 ring-1 ring-pink-400/25"
            : "border-slate-200/90 bg-white text-slate-600 hover:border-pink-200 hover:bg-pink-50/40"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const toolbarBtn =
  "rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition-all duration-150 hover:scale-[1.03] hover:border-pink-200 hover:bg-pink-50/30 active:scale-[0.98]";

const toolbarBtnDanger =
  "rounded-full border border-red-200/90 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-800 shadow-sm transition-all duration-150 hover:scale-[1.03] hover:bg-red-100 active:scale-[0.98]";

export type VisualInlineBlockChromeProps = {
  block: PreviewBlock;
  children: ReactNode;
  isSelected: boolean;
  isHovered: boolean;
  enabled: boolean;
  fieldHints?: Record<string, string>;
  onPatch: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
  onReplaceBackground?: () => void;
  onReplaceOverlay?: () => void;
  onOpenAdvanced?: () => void;
};

/**
 * Umbraco-style preview chrome: canvas text on the block, floating toolbar, optional Detaljer form.
 */
export function VisualInlineBlockChrome({
  block,
  children,
  isSelected,
  isHovered,
  enabled,
  fieldHints = {},
  onPatch,
  onRemove,
  onReplaceBackground,
  onReplaceOverlay,
  onOpenAdvanced,
}: VisualInlineBlockChromeProps) {
  const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!isSelected) setShowDetails(false);
  }, [isSelected]);

  if (!enabled) {
    return <>{children}</>;
  }

  const type = block.type;
  type BleedChromeBlock = PreviewBlock & {
    contentData: { title?: string; subtitle?: string; ctaPrimary?: string };
    settingsData: { variant?: Tri; textPosition?: Tri };
  };
  const bleed = type === "hero_bleed" ? (block as BleedChromeBlock) : null;
  const tri = (v: unknown, d: Tri): Tri => {
    const s = String(v ?? "").toLowerCase();
    return s === "left" || s === "right" || s === "center" ? s : d;
  };

  const canvasMode = isSelected && (type === "hero_bleed" || type === "richText");
  const childPointerClass =
    canvasMode ?
      "pointer-events-auto [&_a]:pointer-events-none"
    : "pointer-events-none [&_a]:pointer-events-none [&_button]:pointer-events-none";

  const showLayoutTools = type === "hero_bleed";
  const showDetailsForm = type === "hero_bleed" || type === "richText";

  return (
    <div className="relative">
      <div className={childPointerClass}>{children}</div>

      {type === "hero_bleed" && (isHovered || isSelected) ?
        <div
          className="pointer-events-auto absolute right-2 top-2 z-[38] flex flex-col gap-1 opacity-0 transition-opacity duration-200 group-hover/preview-block:opacity-100"
          style={{ opacity: isHovered || isSelected ? 1 : undefined }}
        >
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onReplaceBackground?.();
            }}
            className="rounded-lg border border-slate-800/90 bg-slate-900/95 px-2.5 py-1 text-[11px] font-medium text-white shadow-md transition-transform duration-150 hover:scale-[1.02] hover:bg-slate-800"
          >
            Bytt bilde
          </button>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onReplaceOverlay?.();
            }}
            className="rounded-lg border border-slate-600/90 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-800 shadow-md transition-transform duration-150 hover:scale-[1.02] hover:bg-slate-50"
          >
            Bytt overlegg
          </button>
        </div>
      : null}

      {isSelected && showDetails && (
        <div
          className="pointer-events-auto absolute left-1 right-1 top-10 z-[39] max-h-[min(48vh,380px)] overflow-auto rounded-xl border border-slate-200/90 bg-white/98 p-2.5 shadow-xl backdrop-blur-md transition-all duration-200"
          onClick={stop}
          onMouseDown={stop}
        >
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">Detaljer</p>

          {showDetailsForm && bleed ?
            <div className="grid gap-2">
              <EditableLine
                initialValue={String(bleed.contentData.title ?? "")}
                placeholder="Tittel"
                hint={fieldHints.title}
                className="font-semibold text-slate-900"
                onCommit={(t) => onPatch({ title: t })}
              />
              <EditableLine
                initialValue={String(bleed.contentData.subtitle ?? "")}
                placeholder="Undertittel"
                hint={fieldHints.subtitle}
                className="text-slate-700"
                onCommit={(t) => onPatch({ subtitle: t })}
              />
              <EditableLine
                initialValue={String(bleed.contentData.ctaPrimary ?? "")}
                placeholder="Knappetekst"
                hint={fieldHints.ctaPrimary}
                className="font-medium text-pink-800"
                onCommit={(t) => onPatch({ ctaPrimary: t })}
              />
              {fieldHints.backgroundImageId ?
                <p className="text-[10px] text-amber-800/80">{fieldHints.backgroundImageId}</p>
              : null}
            </div>
          : null}

          {showDetailsForm && type === "richText" ?
            <div className="grid gap-2">
              <EditableLine
                initialValue={String(block.heading ?? "")}
                placeholder="Overskrift"
                hint={fieldHints.heading}
                className="font-semibold text-slate-900"
                onCommit={(t) => onPatch({ heading: t })}
              />
              <RichTextBodyField
                initialBody={String(block.body ?? "")}
                hint={fieldHints.body}
                onCommit={(t) => onPatch({ body: t })}
              />
            </div>
          : null}

          {!showDetailsForm ?
            <p className="text-[11px] text-slate-600">
              Rediger visuelt der det støttes, eller åpne alle felt for full skjemavis.
            </p>
          : null}
        </div>
      )}

      {isSelected ?
        <div
          className="pointer-events-auto absolute bottom-2 left-1/2 z-[45] flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-full border border-slate-200/90 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur-md transition-transform duration-200"
          onClick={stop}
          onMouseDown={stop}
        >
          {showLayoutTools && bleed ?
            <LayoutToolbar
              value={tri(bleed.settingsData.variant, tri(bleed.settingsData.textPosition, "center"))}
              onChange={(v) => onPatch({ variant: v, textPosition: v, textAlign: v, overlayPosition: v })}
            />
          : null}

          {(showDetailsForm || onOpenAdvanced) && (
            <button
              type="button"
              className={cn(toolbarBtn, showDetails && "border-pink-300/60 bg-pink-50/80 text-pink-900")}
              onClick={() => setShowDetails((s) => !s)}
            >
              Detaljer
            </button>
          )}

          {onOpenAdvanced ?
            <button type="button" className={toolbarBtn} onClick={() => onOpenAdvanced()}>
              Alle felt
            </button>
          : null}

          <button type="button" className={toolbarBtnDanger} onClick={() => onRemove()}>
            Slett
          </button>
        </div>
      : null}
    </div>
  );
}
