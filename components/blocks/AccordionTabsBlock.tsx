"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { TextBlock } from "@/components/ui/TextBlock";
import { Section } from "@/components/ui/Section";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import {
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
  mergedHeadingClassString,
} from "@/lib/cms/design/designContract";

export type AccordionTabPanel = {
  id: string;
  title: string;
  body: string;
};

export type AccordionTabsBlockProps = {
  merged: MergedDesign;
  /** Stable id for sessionStorage when `rememberOpen` is true. */
  blockId: string;
  sectionTitle: string;
  /** `accordion` (native details) or `tabs` (tablist + tabpanel). */
  displayMode: "accordion" | "tabs";
  items: AccordionTabPanel[];
  /** 0-based; `-1` = accordion: none expanded initially. */
  defaultOpenIndex: number;
  rememberOpen: boolean;
};

const STORAGE_PREFIX = "lp_accordion_tabs_v1:";

function parseItemsJson(raw: unknown): AccordionTabPanel[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `panel-${idx}`;
        return {
          id,
          title: typeof o.title === "string" ? o.title : "",
          body: typeof o.body === "string" ? o.body : "",
        };
      })
      .filter((x): x is AccordionTabPanel => x != null);
  } catch {
    return [];
  }
}

export function panelsFromAccordionTabsData(data: Record<string, unknown>): AccordionTabPanel[] {
  if (Array.isArray(data.items)) {
    const raw = data.items as unknown[];
    return raw
      .map((row, idx) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `panel-${idx}`;
        return {
          id,
          title: typeof o.title === "string" ? o.title : "",
          body: typeof o.body === "string" ? o.body : "",
        };
      })
      .filter((x): x is AccordionTabPanel => x != null);
  }
  return parseItemsJson(data.itemsJson);
}

function buildInitialOpenMap(
  list: AccordionTabPanel[],
  defaultOpenIndex: number,
  blockId: string,
  rememberOpen: boolean,
): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const p of list) m[p.id] = false;
  if (rememberOpen && typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${blockId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const om = (parsed as { openMap?: unknown }).openMap;
          if (om && typeof om === "object" && !Array.isArray(om)) {
            for (const p of list) {
              const v = (om as Record<string, unknown>)[p.id];
              if (v === true) m[p.id] = true;
            }
            if (Object.values(m).some(Boolean)) return m;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (defaultOpenIndex >= 0 && defaultOpenIndex < list.length) {
    const id = list[defaultOpenIndex]!.id;
    for (const k of Object.keys(m)) m[k] = k === id;
  }
  return m;
}

/**
 * Accordion (controlled `<details>`) or horizontal tabs from Umbraco `accordionOrTab` / nested items.
 * `faq_block` stays for zigzag FAQ and other fixed Q/A shapes.
 */
export function AccordionTabsBlock({
  merged,
  blockId,
  sectionTitle,
  displayMode,
  items,
  defaultOpenIndex,
  rememberOpen,
}: AccordionTabsBlockProps) {
  const storageKey = `${STORAGE_PREFIX}${blockId}`;
  const list = useMemo(() => items.filter((p) => p.title.trim() || p.body.trim()), [items]);

  const [tabIndex, setTabIndex] = useState(0);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const p of list) m[p.id] = false;
    if (defaultOpenIndex >= 0 && defaultOpenIndex < list.length) {
      const id = list[defaultOpenIndex]!.id;
      for (const k of Object.keys(m)) m[k] = k === id;
    }
    return m;
  });

  useEffect(() => {
    if (displayMode !== "accordion" || !rememberOpen || typeof window === "undefined") return;
    const stored = buildInitialOpenMap(list, defaultOpenIndex, blockId, true);
    if (Object.values(stored).some(Boolean)) setOpenMap(stored);
  }, [blockId, defaultOpenIndex, displayMode, list, rememberOpen]);

  useEffect(() => {
    if (displayMode !== "tabs" || list.length === 0) return;
    let start = 0;
    if (defaultOpenIndex >= 0 && defaultOpenIndex < list.length) start = defaultOpenIndex;
    if (rememberOpen && typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const ti = (parsed as { tabIndex?: unknown }).tabIndex;
            if (typeof ti === "number" && Number.isFinite(ti) && ti >= 0 && ti < list.length) {
              start = Math.round(ti);
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
    setTabIndex(start);
  }, [defaultOpenIndex, displayMode, list.length, rememberOpen, storageKey]);

  const persistAccordion = useCallback(
    (next: Record<string, boolean>) => {
      if (!rememberOpen || typeof window === "undefined") return;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ openMap: next }));
      } catch {
        /* ignore */
      }
    },
    [rememberOpen, storageKey],
  );

  const persistTab = useCallback(
    (idx: number) => {
      if (!rememberOpen || typeof window === "undefined") return;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ tabIndex: idx }));
      } catch {
        /* ignore */
      }
    },
    [rememberOpen, storageKey],
  );

  if (list.length === 0) return null;

  const title = sectionTitle.trim();

  if (displayMode === "tabs") {
    const safeIdx = Math.min(Math.max(tabIndex, 0), list.length - 1);
    const active = list[safeIdx]!;
    return (
      <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
        {title ? (
          <div className="lp-section-head text-center">
            <h2 className={mergedHeadingClassString(merged, "h2")}>{title}</h2>
          </div>
        ) : null}
        <div className="mx-auto mt-6 max-w-3xl" role="region" aria-label={title || "Faner"}>
          <div
            role="tablist"
            aria-orientation="horizontal"
            className="flex flex-wrap justify-center gap-2 overflow-x-auto pb-2"
          >
            {list.map((p, i) => {
              const selected = i === safeIdx;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${blockId}-panel-${p.id}`}
                  id={`${blockId}-tab-${p.id}`}
                  className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium transition ${
                    selected ?
                      "border-pink-500/60 bg-pink-500/10 text-[rgb(var(--lp-text))]"
                    : "border-[rgba(var(--lp-border),0.85)] bg-[rgb(var(--lp-card))]/60 text-[rgb(var(--lp-muted))]"
                  }`}
                  onClick={() => {
                    setTabIndex(i);
                    persistTab(i);
                  }}
                >
                  {p.title || `Fane ${i + 1}`}
                </button>
              );
            })}
          </div>
          <div
            role="tabpanel"
            id={`${blockId}-panel-${active.id}`}
            aria-labelledby={`${blockId}-tab-${active.id}`}
            className="mt-4 rounded-2xl border border-[rgba(var(--lp-border),0.85)] bg-[rgb(var(--lp-card))]/80 px-4 py-6"
          >
            {active.title ? <h3 className={mergedHeadingClassString(merged, "h3")}>{active.title}</h3> : null}
            {active.body ?
              <TextBlock className={`${mergedBodyClassString(merged, { measure: true })} mt-2 whitespace-pre-wrap`}>
                {active.body}
              </TextBlock>
            : null}
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
      {title ? (
        <div className="lp-section-head text-center">
          <h2 className={mergedHeadingClassString(merged, "h2")}>{title}</h2>
        </div>
      ) : null}
      <div className="mx-auto mt-6 max-w-3xl space-y-2" aria-label={title || "Trekkspill"}>
        {list.map((p) => (
          <details
            key={p.id}
            open={Boolean(openMap[p.id])}
            onToggle={(e) => {
              const opened = e.currentTarget.open;
              setOpenMap((prev) => {
                const next = { ...prev, [p.id]: opened };
                persistAccordion(next);
                return next;
              });
            }}
            className="group rounded-2xl border border-[rgba(var(--lp-border),0.85)] bg-[rgb(var(--lp-card))]/80 px-4 py-2"
          >
            <summary className="cursor-pointer list-none py-3 font-medium text-[rgb(var(--lp-text))] marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-3">
                <span>{p.title || "Panel"}</span>
                <span className="text-[rgb(var(--lp-muted))] text-sm transition group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </span>
            </summary>
            <div className="border-t border-[rgba(var(--lp-border),0.5)] pt-3 pb-2">
              {p.body ? <TextBlock className={mergedBodyClassString(merged, { measure: true })}>{p.body}</TextBlock> : null}
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function parseAccordionTabsDisplayMode(data: Record<string, unknown>): "accordion" | "tabs" {
  const dm = String(data.displayMode ?? "").trim().toLowerCase();
  return dm === "tabs" ? "tabs" : "accordion";
}

export function parseAccordionTabsBool(data: Record<string, unknown>, key: string): boolean {
  const v = data[key];
  if (v === true) return true;
  if (typeof v === "string") return v.trim().toLowerCase() === "true";
  return false;
}

/** Supports `-1` (Umbraco: none expanded). */
export function parseAccordionTabsDefaultOpenIndex(data: Record<string, unknown>): number {
  const v = data.defaultOpenIndex;
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && v.trim()) {
    const n = parseInt(v.trim(), 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
