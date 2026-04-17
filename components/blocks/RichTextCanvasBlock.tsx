"use client";

import { useLayoutEffect, useRef } from "react";

import { contentEditablePlaceholderCx } from "@/lib/cms/inlineEditCx";

function placeCaretAtEnd(el: HTMLElement) {
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    /* ignore */
  }
}

function normalizeInner(s: string): string {
  return s.replace(/\u00a0/g, " ").trim();
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type RichTextCanvasBlockProps = {
  headingClass: string;
  bodyClass: string;
  heading: string;
  body: string;
  onPatch: (patch: Record<string, unknown>) => void;
};

/**
 * Backoffice preview only: plain-text inline edit for richText blocks (matches stored body shape).
 */
export function RichTextCanvasBlock({ headingClass, bodyClass, heading, body, onPatch }: RichTextCanvasBlockProps) {
  const hRef = useRef<HTMLHeadingElement>(null);
  const bRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = hRef.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== heading) el.textContent = heading;
  }, [heading]);

  useLayoutEffect(() => {
    const el = bRef.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== body) el.textContent = body;
  }, [body]);

  return (
    <>
      <h2
        ref={hRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Overskrift"
        data-placeholder="Overskrift"
        className={cn(
          headingClass,
          "min-h-[1.5em] outline-none transition-[opacity,transform] duration-150 focus-visible:ring-2 focus-visible:ring-pink-400/45 focus-visible:ring-offset-2",
          contentEditablePlaceholderCx,
        )}
        onFocus={(e) => placeCaretAtEnd(e.currentTarget)}
        onBlur={() => onPatch({ heading: normalizeInner(hRef.current?.textContent ?? "") })}
      />
      <div
        ref={bRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Brødtekst"
        data-placeholder="Skriv avsnitt her …"
        className={cn(
          bodyClass,
          "mt-3 min-h-[5rem] whitespace-pre-line outline-none transition-[opacity,transform] duration-150 focus-visible:ring-2 focus-visible:ring-pink-400/45 focus-visible:ring-offset-2",
          contentEditablePlaceholderCx,
        )}
        onFocus={(e) => placeCaretAtEnd(e.currentTarget)}
        onBlur={() => onPatch({ body: normalizeInner(bRef.current?.textContent ?? "") })}
      />
    </>
  );
}
