"use client";

import { useEffect, useMemo, useRef, useState, KeyboardEvent, MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { SemanticIconKey } from "@/lib/iconRegistry";
import { Icon } from "@/components/ui/Icon";
import type { BlockDefinition, BlockCategory } from "./blockRegistry";
import { BLOCK_REGISTRY } from "./blockRegistry";

/** Map block type to semantic icon (modern icons, no text placeholder). */
function blockTypeToIconName(type: string): SemanticIconKey {
  const map: Record<string, SemanticIconKey> = {
    hero: "media",
    richText: "content",
    image: "media",
    cta: "content",
    banners: "media",
    divider: "content",
    code: "content",
  };
  return map[type] ?? "content";
}

type BlockPickerOverlayProps = {
  open: boolean;
  context: { pageId: string; isHome: boolean; docType?: string | null };
  onClose: () => void;
  onPick: (def: BlockDefinition) => void;
};

const FAVORITES_KEY = "lp:blockPicker:favorites";
const RECENT_KEY = "lp:blockPicker:recent";

type CategoryFilter = "all" | BlockCategory;

export function BlockPickerOverlay(props: BlockPickerOverlayProps) {
  const { open, onClose, onPick } = props;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Load favorites/recent when overlay opens
  useEffect(() => {
    if (!open) return;
    try {
      if (typeof window === "undefined") return;
      const favRaw = window.localStorage.getItem(FAVORITES_KEY);
      const recRaw = window.localStorage.getItem(RECENT_KEY);
      if (favRaw) {
        const parsed = JSON.parse(favRaw);
        if (Array.isArray(parsed)) setFavorites(parsed.filter((x) => typeof x === "string"));
      }
      if (recRaw) {
        const parsed = JSON.parse(recRaw);
        if (Array.isArray(parsed)) setRecent(parsed.filter((x) => typeof x === "string"));
      }
    } catch {
      // ignore
    }
    setActiveIndex(0);
    setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  // Derived lists
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return BLOCK_REGISTRY.filter((def) => {
      if (category !== "all" && def.category !== category) return false;
      if (!q) return true;
      const haystack = [
        def.label,
        def.description,
        def.category,
        ...(def.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [category, search]);

  const favoriteDefs = useMemo(
    () => filtered.filter((def) => favorites.includes(def.type)),
    [filtered, favorites]
  );
  const recentDefs = useMemo(
    () =>
      filtered.filter(
        (def) => recent.includes(def.type) && !favorites.includes(def.type)
      ),
    [filtered, recent, favorites]
  );
  const otherDefs = useMemo(
    () =>
      filtered.filter(
        (def) =>
          !favorites.includes(def.type) &&
          !recent.includes(def.type)
      ),
    [filtered, favorites, recent]
  );

  // Flat list for keyboard navigation (favorites -> recent -> others)
  const flatList = useMemo(
    () => [...favoriteDefs, ...recentDefs, ...otherDefs],
    [favoriteDefs, recentDefs, otherDefs]
  );

  // Reset active index when filters change
  useEffect(() => {
    setActiveIndex(0);
  }, [search, category]);

  // Global key handling (ESC / Cmd+K / Ctrl+K)
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent | KeyboardEventInit | any) => {
      const e = event as KeyboardEvent;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey as any);
    return () => window.removeEventListener("keydown", handleKey as any);
  }, [open, onClose]);

  const categories: { key: CategoryFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "content", label: "Content" },
    { key: "layout", label: "Layout" },
    { key: "navigation", label: "Navigation" },
    { key: "system", label: "System" },
    { key: "marketing", label: "Marketing" },
  ];

  const countByCategory: Record<CategoryFilter, number> = useMemo(() => {
    const base: Record<CategoryFilter, number> = {
      all: filtered.length,
      content: 0,
      layout: 0,
      navigation: 0,
      system: 0,
      marketing: 0,
    };
    for (const def of filtered) {
      base[def.category] += 1;
    }
    return base;
  }, [filtered]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const handleFavoriteToggle = (def: BlockDefinition, e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFavorites((prev) => {
      const exists = prev.includes(def.type);
      const next = exists ? prev.filter((t) => t !== def.type) : [def.type, ...prev];
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
        }
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handlePick = (def: BlockDefinition) => {
    setRecent((prev) => {
      const next = [def.type, ...prev.filter((t) => t !== def.type)].slice(0, 8);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        }
      } catch {
        // ignore
      }
      return next;
    });
    onPick(def);
  };

  const moveActive = (delta: number) => {
    if (!flatList.length) return;
    setActiveIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next >= flatList.length) return flatList.length - 1;
      return next;
    });
  };

  // Simple focus trap inside dialog
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("data-focus-ignore"));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (!current || current === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (!current || current === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    if (!flatList.length) return;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const def = flatList[activeIndex];
      if (def) handlePick(def);
    }
  };

  const activeType = flatList[activeIndex]?.type ?? null;

  const backdrop = (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="lp-motion-overlay lp-glass-overlay absolute inset-0" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="lp-motion-overlay lp-glass-panel relative z-[81] flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl outline-none"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[rgb(var(--lp-border))] px-4 py-3">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Add content</h2>
          <div className="flex-1">
            <input
              ref={searchRef}
              type="search"
              aria-label="Search blocks"
              placeholder="Search blocks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-sm text-[rgb(var(--lp-text))] outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))] focus:ring-offset-2"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            aria-label="Lukk"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 divide-x divide-[rgb(var(--lp-border))]">
          {/* Categories */}
          <aside className="flex w-40 shrink-0 flex-col gap-1 bg-[rgb(var(--lp-bg))]/60 px-2 py-3 text-xs">
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left ${
                  category === cat.key
                    ? "bg-white text-[rgb(var(--lp-text))] shadow-sm"
                    : "text-[rgb(var(--lp-muted))] hover:bg-white/70 hover:text-[rgb(var(--lp-text))]"
                }`}
              >
                <span>{cat.label}</span>
                <span className="ml-2 text-[10px] text-[rgb(var(--lp-muted))]">
                  {countByCategory[cat.key]}
                </span>
              </button>
            ))}
          </aside>

          {/* Grid */}
          <main className="flex min-w-0 flex-1 flex-col px-3 py-3 text-sm">
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="min-h-0 flex-1 overflow-auto">
              {category === "all" && favoriteDefs.length > 0 && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                    Favorites
                  </h3>
                  <div
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3"
                    aria-label="Favorite blocks"
                  >
                    {favoriteDefs.map((def) => {
                      const index = flatList.findIndex((d) => d.type === def.type);
                      const isActive = index === activeIndex && def.type === activeType;
                      const cardId = `blockpicker-card-${def.type}`;
                      return (
                        <button
                          key={def.type}
                          id={cardId}
                          type="button"
                          onClick={() => handlePick(def)}
                          className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left lp-motion-card ${
                            isActive
                              ? "border-[rgb(var(--lp-text))] bg-[rgb(var(--lp-card))]"
                              : "border-[rgb(var(--lp-border))] bg-white hover:border-slate-300 hover:bg-[rgb(var(--lp-card))]/60"
                          }`}
                          aria-pressed={isActive}
                        >
                          <div className="mb-1 flex w-full items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-[rgb(var(--lp-text))]">
                              {def.label}
                            </span>
                            <span
                              role="button"
                              tabIndex={-1}
                              onClick={(e) => handleFavoriteToggle(def, e)}
                              className="text-xs text-amber-500"
                              aria-label="Toggle favorite"
                            >
                              {favorites.includes(def.type) ? "★" : "☆"}
                            </span>
                          </div>
                          <p className="mb-1 line-clamp-2 text-[11px] text-[rgb(var(--lp-muted))]">
                            {def.description}
                          </p>
                          <div className="mt-auto flex w-full items-center justify-between text-[10px] text-[rgb(var(--lp-muted))]">
                            <span className="rounded border border-[rgb(var(--lp-border))] px-1 py-0.5">
                              {def.category}
                            </span>
                            <span className="inline-flex items-center justify-center rounded bg-[rgb(var(--lp-card))] p-0.5">
                              <Icon name={blockTypeToIconName(def.type)} size="xs" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {category === "all" && recentDefs.length > 0 && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                    Recent
                  </h3>
                  <div
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3"
                    aria-label="Recent blocks"
                  >
                    {recentDefs.map((def) => {
                      const index = flatList.findIndex((d) => d.type === def.type);
                      const isActive = index === activeIndex && def.type === activeType;
                      const cardId = `blockpicker-card-${def.type}`;
                      return (
                        <button
                          key={def.type}
                          id={cardId}
                          type="button"
                          onClick={() => handlePick(def)}
                          className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left lp-motion-card ${
                            isActive
                              ? "border-[rgb(var(--lp-text))] bg-[rgb(var(--lp-card))]"
                              : "border-[rgb(var(--lp-border))] bg-white hover:border-slate-300 hover:bg-[rgb(var(--lp-card))]/60"
                          }`}
                          aria-pressed={isActive}
                        >
                          <div className="mb-1 flex w-full items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-[rgb(var(--lp-text))]">
                              {def.label}
                            </span>
                            <span
                              role="button"
                              tabIndex={-1}
                              onClick={(e) => handleFavoriteToggle(def, e)}
                              className="text-xs text-amber-500"
                              aria-label="Toggle favorite"
                            >
                              {favorites.includes(def.type) ? "★" : "☆"}
                            </span>
                          </div>
                          <p className="mb-1 line-clamp-2 text-[11px] text-[rgb(var(--lp-muted))]">
                            {def.description}
                          </p>
                          <div className="mt-auto flex w-full items-center justify-between text-[10px] text-[rgb(var(--lp-muted))]">
                            <span className="rounded border border-[rgb(var(--lp-border))] px-1 py-0.5">
                              {def.category}
                            </span>
                            <span className="inline-flex items-center justify-center rounded bg-[rgb(var(--lp-card))] p-0.5">
                              <Icon name={blockTypeToIconName(def.type)} size="xs" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="min-h-0 flex-1">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  {category === "all" ? "All blocks" : "Blocks"}
                </h3>
                <div
                  className="grid max-h-[52vh] grid-cols-1 gap-2 overflow-auto pb-1 sm:grid-cols-2 md:grid-cols-3"
                  aria-label="All blocks"
                >
                  {otherDefs.map((def) => {
                    const index = flatList.findIndex((d) => d.type === def.type);
                    const isActive = index === activeIndex && def.type === activeType;
                    const cardId = `blockpicker-card-${def.type}`;
                    return (
                      <button
                        key={def.type}
                        id={cardId}
                        type="button"
                        onClick={() => handlePick(def)}
                        className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left lp-motion-card ${
                          isActive
                            ? "border-[rgb(var(--lp-text))] bg-[rgb(var(--lp-card))]"
                            : "border-[rgb(var(--lp-border))] bg-white hover:border-slate-300 hover:bg-[rgb(var(--lp-card))]/60"
                        }`}
                        aria-pressed={isActive}
                      >
                        <div className="mb-1 flex w-full items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-[rgb(var(--lp-text))]">
                            {def.label}
                          </span>
                          <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => handleFavoriteToggle(def, e)}
                            className="text-xs text-amber-500"
                            aria-label="Toggle favorite"
                          >
                            {favorites.includes(def.type) ? "★" : "☆"}
                          </span>
                        </div>
                        <p className="mb-1 line-clamp-2 text-[11px] text-[rgb(var(--lp-muted))]">
                          {def.description}
                        </p>
                        <div className="mt-auto flex w-full items-center justify-between text-[10px] text-[rgb(var(--lp-muted))]">
                          <span className="rounded border border-[rgb(var(--lp-border))] px-1 py-0.5">
                            {def.category}
                          </span>
                          <span className="inline-flex items-center justify-center rounded bg-[rgb(var(--lp-card))] p-0.5">
                            <Icon name={blockTypeToIconName(def.type)} size="xs" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {!flatList.length && (
                    <div className="col-span-full rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-4 py-6 text-center text-xs text-[rgb(var(--lp-muted))]">
                      Ingen blokker matcher søket ditt.
                    </div>
                  )}
                </div>
              </section>
              </div>
            </div>

            {/* Footer hint */}
            <div className="mt-2 border-t border-[rgb(var(--lp-border))] pt-2 text-[11px] text-[rgb(var(--lp-muted))]">
              ↑↓ navigate • Enter add • Esc close • ⌘K focus search
            </div>
          </main>
        </div>
      </div>
    </div>
  );

  return createPortal(backdrop, document.body);
}

