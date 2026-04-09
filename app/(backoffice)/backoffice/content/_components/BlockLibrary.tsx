"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { SemanticIconKey } from "@/lib/iconRegistry";
import {
  getBackofficeBlockCatalog,
  type BackofficeBlockCategory,
  type BackofficeBlockDefinition,
} from "@/lib/cms/backofficeBlockCatalog";
import {
  getBlockEditorDataType,
  groupBlockLibraryEntriesByDataType,
  type BlockEditorDataTypeDefinition,
} from "@/lib/cms/blocks/blockEditorDataTypes";
import { Icon } from "@/components/ui/Icon";
import { useElementTypeRuntimeMergedOptional } from "./ElementTypeRuntimeMergedContext";
import type { ElementTypeRuntimeMergedEntry } from "@/lib/cms/schema/elementTypeRuntimeMerge";

export type BlockLibraryContext = {
  pageId: string;
  isHome: boolean;
  docType?: string | null;
  allowedBlockTypeKeys?: string[] | null;
  /** U94 — Block Editor Data Type alias (property binding). */
  blockEditorDataTypeAlias?: string | null;
  /** U95 — effektiv data type (merged admin + baseline) for grupper og metadata i biblioteket. */
  blockEditorDataTypeEffective?: BlockEditorDataTypeDefinition | null;
  /** U94B — createButtonLabel fra aktiv data type (speilet i bibliotek-header). */
  blockListCreateLabel?: string | null;
  blockCount?: number;
  blockMaxItems?: number | null;
};

export type BlockLibraryProps = {
  open: boolean;
  context: BlockLibraryContext;
  onClose: () => void;
  onPick: (definition: BackofficeBlockDefinition) => void;
};

type CategoryFilter = "all" | BackofficeBlockCategory;

const FAVORITES_KEY = "lp:blockPicker:favorites";
const RECENT_KEY = "lp:blockPicker:recent";
const BLOCK_LIBRARY_REGISTRY = getBackofficeBlockCatalog();

export function resolveBlockLibraryEntries(context: Pick<BlockLibraryContext, "allowedBlockTypeKeys">) {
  const allowed = context.allowedBlockTypeKeys;
  if (allowed == null) return [...BLOCK_LIBRARY_REGISTRY];
  const allow = new Set(allowed);
  if (allow.size === 0) return [];
  return BLOCK_LIBRARY_REGISTRY.filter((definition) => allow.has(definition.type));
}

function differsFromSummary(definition: BackofficeBlockDefinition): string | null {
  const entries = Object.entries(definition.differsFrom ?? {}).filter(([, v]) => (v ?? "").trim());
  if (!entries.length) return null;
  return entries
    .map(([alias, text]) => `vs ${alias}: ${text}`)
    .join(" · ");
}

export function BlockLibrary(props: BlockLibraryProps) {
  const { open, onClose, onPick, context } = props;
  const etRuntime = useElementTypeRuntimeMergedOptional();
  const elementRuntimeMerged = etRuntime?.data?.merged ?? null;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    try {
      if (typeof window === "undefined") return;
      const favoritesRaw = window.localStorage.getItem(FAVORITES_KEY);
      const recentRaw = window.localStorage.getItem(RECENT_KEY);
      if (favoritesRaw) {
        const parsed = JSON.parse(favoritesRaw);
        if (Array.isArray(parsed)) setFavorites(parsed.filter((value) => typeof value === "string"));
      }
      if (recentRaw) {
        const parsed = JSON.parse(recentRaw);
        if (Array.isArray(parsed)) setRecent(parsed.filter((value) => typeof value === "string"));
      }
    } catch {
      // Ignore local storage issues and keep the library usable.
    }
    setActiveIndex(0);
    setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  const availableEntries = useMemo(() => resolveBlockLibraryEntries(context), [context]);

  const dataTypeDefinition = useMemo(() => {
    if (context.blockEditorDataTypeEffective) return context.blockEditorDataTypeEffective;
    return context.blockEditorDataTypeAlias
      ? (getBlockEditorDataType(context.blockEditorDataTypeAlias) ?? null)
      : null;
  }, [context.blockEditorDataTypeEffective, context.blockEditorDataTypeAlias]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return availableEntries.filter((definition) => {
      if (category !== "all" && definition.category !== category) return false;
      if (!query) return true;
      const rt = elementRuntimeMerged?.[definition.type];
      const diff = Object.values(definition.differsFrom ?? {})
        .join(" ")
        .toLowerCase();
      const haystack = [
        rt?.title ?? definition.label,
        definition.shortTitle,
        rt?.description ?? definition.description,
        rt?.editorHelpText ?? "",
        definition.whenToUse,
        definition.libraryGroup,
        definition.category,
        diff,
        ...(definition.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [availableEntries, category, search, elementRuntimeMerged]);

  const favoriteEntries = useMemo(
    () => filtered.filter((definition) => favorites.includes(definition.type)),
    [filtered, favorites],
  );
  const recentEntries = useMemo(
    () =>
      filtered.filter(
        (definition) => recent.includes(definition.type) && !favorites.includes(definition.type),
      ),
    [filtered, recent, favorites],
  );
  const otherEntries = useMemo(
    () =>
      filtered.filter(
        (definition) =>
          !favorites.includes(definition.type) && !recent.includes(definition.type),
      ),
    [filtered, favorites, recent],
  );
  const otherEntriesSorted = useMemo(
    () =>
      [...otherEntries].sort((a, b) => {
        const g = a.libraryGroup.localeCompare(b.libraryGroup, "nb");
        if (g !== 0) return g;
        return a.label.localeCompare(b.label, "nb");
      }),
    [otherEntries],
  );
  const flatList = useMemo(
    () => [...favoriteEntries, ...recentEntries, ...otherEntriesSorted],
    [favoriteEntries, recentEntries, otherEntriesSorted],
  );
  const catalogGrouped = useMemo(() => {
    const byType = new Map(otherEntriesSorted.map((d) => [d.type, d] as const));
    const lite = otherEntriesSorted.map((d) => ({
      type: d.type,
      label: d.label,
      libraryGroup: d.libraryGroup,
    }));
    return groupBlockLibraryEntriesByDataType(lite, dataTypeDefinition).map(({ group, items }) => ({
      group,
      items: items
        .map((e) => byType.get(e.type))
        .filter((d): d is BackofficeBlockDefinition => Boolean(d)),
    }));
  }, [otherEntriesSorted, dataTypeDefinition]);
  const showCatalogGroups = category === "all" && !search.trim();

  useEffect(() => {
    setActiveIndex(0);
  }, [search, category]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent | KeyboardEventInit | Event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault();
        onClose();
      }
      if ((keyboardEvent.key === "k" || keyboardEvent.key === "K") && (keyboardEvent.metaKey || keyboardEvent.ctrlKey)) {
        keyboardEvent.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey as EventListener);
    return () => window.removeEventListener("keydown", handleKey as EventListener);
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
    for (const definition of filtered) {
      base[definition.category] += 1;
    }
    return base;
  }, [filtered]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const handleFavoriteToggle = (definition: BackofficeBlockDefinition, event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setFavorites((previous) => {
      const exists = previous.includes(definition.type);
      const next = exists
        ? previous.filter((type) => type !== definition.type)
        : [definition.type, ...previous];
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
        }
      } catch {
        // Ignore local storage issues and keep the library usable.
      }
      return next;
    });
  };

  const handlePick = (definition: BackofficeBlockDefinition) => {
    setRecent((previous) => {
      const next = [definition.type, ...previous.filter((type) => type !== definition.type)].slice(0, 8);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        }
      } catch {
        // Ignore local storage issues and keep the library usable.
      }
      return next;
    });
    onPick(definition);
  };

  const moveActive = (delta: number) => {
    if (!flatList.length) return;
    setActiveIndex((previous) => {
      const next = previous + delta;
      if (next < 0) return 0;
      if (next >= flatList.length) return flatList.length - 1;
      return next;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      const root = dialogRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("data-focus-ignore"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (!current || current === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!current || current === last) {
        event.preventDefault();
        first.focus();
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
      const definition = flatList[activeIndex];
      if (definition) handlePick(definition);
    }
  };

  const activeType = flatList[activeIndex]?.type ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="lp-motion-overlay lp-glass-overlay absolute inset-0" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="lp-motion-overlay lp-glass-panel relative z-[81] flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl outline-none"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-[rgb(var(--lp-border))] px-4 py-3">
          <div className="min-w-0 shrink-0">
            <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Block library</h2>
            {context.blockListCreateLabel ? (
              <p
                className="mt-0.5 max-w-[min(100%,420px)] text-[10px] leading-snug text-[rgb(var(--lp-muted))]"
                data-lp-library-create-label
              >
                <span className="font-medium text-[rgb(var(--lp-text))]/90">Opprett-knapp (data type):</span>{" "}
                {context.blockListCreateLabel}
              </p>
            ) : null}
            {context.blockEditorDataTypeAlias ? (
              <p
                className="mt-0.5 max-w-[min(100%,420px)] text-[10px] leading-snug text-[rgb(var(--lp-muted))]"
                data-lp-block-property-binding
              >
                <span className="font-medium text-[rgb(var(--lp-text))]/90">Data type:</span>{" "}
                <span data-lp-block-editor-data-type>{context.blockEditorDataTypeAlias}</span>
                {dataTypeDefinition ? (
                  <>
                    {" "}
                    · <span data-lp-block-library-allowed-count>{availableEntries.length}</span> tillatte typer
                    {typeof context.blockMaxItems === "number" ? (
                      <>
                        {" "}
                        · maks <span data-lp-block-list-max>{context.blockMaxItems}</span> blokker
                      </>
                    ) : null}
                    {typeof context.blockCount === "number" ? (
                      <>
                        {" "}
                        · nå <span data-lp-block-list-current>{context.blockCount}</span>
                      </>
                    ) : null}
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="flex-1">
            <input
              ref={searchRef}
              type="search"
              aria-label="Search blocks"
              placeholder="Search blocks..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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

        <div className="flex min-h-0 flex-1 divide-x divide-[rgb(var(--lp-border))]">
          <aside className="flex w-40 shrink-0 flex-col gap-1 bg-[rgb(var(--lp-bg))]/60 px-2 py-3 text-xs">
            {categories.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setCategory(entry.key)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left ${
                  category === entry.key
                    ? "bg-white text-[rgb(var(--lp-text))] shadow-sm"
                    : "text-[rgb(var(--lp-muted))] hover:bg-white/70 hover:text-[rgb(var(--lp-text))]"
                }`}
              >
                <span>{entry.label}</span>
                <span className="ml-2 text-[10px] text-[rgb(var(--lp-muted))]">
                  {countByCategory[entry.key]}
                </span>
              </button>
            ))}
          </aside>

          <main className="flex min-w-0 flex-1 flex-col px-3 py-3 text-sm">
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="min-h-0 flex-1 overflow-auto">
                {category === "all" && favoriteEntries.length > 0 ? (
                  <BlockLibrarySection
                    title="Favorites"
                    items={favoriteEntries}
                    flatList={flatList}
                    activeIndex={activeIndex}
                    activeType={activeType}
                    favorites={favorites}
                    elementRuntimeMerged={elementRuntimeMerged}
                    onPick={handlePick}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                ) : null}

                {category === "all" && recentEntries.length > 0 ? (
                  <BlockLibrarySection
                    title="Recent"
                    items={recentEntries}
                    flatList={flatList}
                    activeIndex={activeIndex}
                    activeType={activeType}
                    favorites={favorites}
                    elementRuntimeMerged={elementRuntimeMerged}
                    onPick={handlePick}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                ) : null}

                <section className="min-h-0 flex-1">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                    {category === "all" ? "Blokkatalog" : "Blokker"}
                  </h3>
                  {showCatalogGroups ? (
                    <div className="max-h-[52vh] space-y-4 overflow-auto pb-1" data-lp-block-library-catalog>
                      {catalogGrouped.map(({ group, items }) => (
                        <div key={group}>
                          <h4
                            className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--lp-muted))]"
                            data-lp-block-library-group-title={group}
                            data-lp-library-group={group}
                          >
                            {group}
                          </h4>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                            {items.map((definition) => (
                              <BlockLibraryCard
                                key={definition.type}
                                definition={definition}
                                runtimeEntry={elementRuntimeMerged?.[definition.type] ?? null}
                                isActive={
                                  flatList.findIndex((entry) => entry.type === definition.type) === activeIndex &&
                                  definition.type === activeType
                                }
                                isFavorite={favorites.includes(definition.type)}
                                onPick={handlePick}
                                onFavoriteToggle={handleFavoriteToggle}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="grid max-h-[52vh] grid-cols-1 gap-2 overflow-auto pb-1 sm:grid-cols-2 md:grid-cols-3"
                      aria-label="All blocks"
                    >
                      {otherEntriesSorted.map((definition) => (
                        <BlockLibraryCard
                          key={definition.type}
                          definition={definition}
                          runtimeEntry={elementRuntimeMerged?.[definition.type] ?? null}
                          isActive={
                            flatList.findIndex((entry) => entry.type === definition.type) === activeIndex &&
                            definition.type === activeType
                          }
                          isFavorite={favorites.includes(definition.type)}
                          onPick={handlePick}
                          onFavoriteToggle={handleFavoriteToggle}
                        />
                      ))}
                    </div>
                  )}
                  {!flatList.length ? (
                    <div className="col-span-full rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/60 px-4 py-6 text-center text-xs text-[rgb(var(--lp-muted))]">
                      Ingen blokker matcher søket ditt.
                    </div>
                  ) : null}
                </section>
              </div>
            </div>

            <div className="mt-2 border-t border-[rgb(var(--lp-border))] pt-2 text-[11px] text-[rgb(var(--lp-muted))]">
              Arrows navigate • Enter add • Esc close • Cmd/Ctrl+K focus search
            </div>
          </main>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BlockLibrarySection(props: {
  title: string;
  items: BackofficeBlockDefinition[];
  flatList: BackofficeBlockDefinition[];
  activeIndex: number;
  activeType: string | null;
  favorites: string[];
  elementRuntimeMerged: Record<string, ElementTypeRuntimeMergedEntry> | null;
  onPick: (definition: BackofficeBlockDefinition) => void;
  onFavoriteToggle: (definition: BackofficeBlockDefinition, event: MouseEvent) => void;
}) {
  const { title, items, flatList, activeIndex, activeType, favorites, elementRuntimeMerged, onPick, onFavoriteToggle } =
    props;
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3" aria-label={`${title} blocks`}>
        {items.map((definition) => (
          <BlockLibraryCard
            key={definition.type}
            definition={definition}
            runtimeEntry={elementRuntimeMerged?.[definition.type] ?? null}
            isActive={
              flatList.findIndex((entry) => entry.type === definition.type) === activeIndex &&
              definition.type === activeType
            }
            isFavorite={favorites.includes(definition.type)}
            onPick={onPick}
            onFavoriteToggle={onFavoriteToggle}
          />
        ))}
      </div>
    </section>
  );
}

function BlockLibraryCard(props: {
  definition: BackofficeBlockDefinition;
  runtimeEntry: ElementTypeRuntimeMergedEntry | null;
  isActive: boolean;
  isFavorite: boolean;
  onPick: (definition: BackofficeBlockDefinition) => void;
  onFavoriteToggle: (definition: BackofficeBlockDefinition, event: MouseEvent) => void;
}) {
  const { definition, runtimeEntry, isActive, isFavorite, onPick, onFavoriteToggle } = props;
  const diffLine = differsFromSummary(definition);
  const iconName = (definition.iconKey ?? "content") as SemanticIconKey;
  const displayTitle = runtimeEntry?.title ?? definition.label;
  const displayDescription = runtimeEntry?.description ?? definition.description;
  return (
    <button
      type="button"
      onClick={() => onPick(definition)}
      className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left lp-motion-card ${
        isActive
          ? "border-[rgb(var(--lp-text))] bg-[rgb(var(--lp-card))]"
          : "border-[rgb(var(--lp-border))] bg-white hover:border-slate-300 hover:bg-[rgb(var(--lp-card))]/60"
      }`}
      aria-pressed={isActive}
      data-lp-block-library-card={definition.type}
      data-lp-library-block-alias={definition.type}
      data-lp-element-type-alias={definition.type}
    >
      <div className="mb-1 flex w-full items-center justify-between gap-1">
        <span
          className="text-xs font-semibold text-[rgb(var(--lp-text))]"
          data-lp-library-title
          data-lp-element-type-title
        >
          {displayTitle}
        </span>
        <span
          role="button"
          tabIndex={-1}
          onClick={(event) => onFavoriteToggle(definition, event)}
          className="text-xs text-amber-500"
          aria-label="Toggle favorite"
        >
          {isFavorite ? "★" : "☆"}
        </span>
      </div>
      <p className="mb-0.5 line-clamp-2 text-[11px] text-[rgb(var(--lp-muted))]" data-lp-library-description>
        {displayDescription}
      </p>
      {runtimeEntry?.editorHelpText ? (
        <p
          className="mb-0.5 line-clamp-2 text-[10px] text-[rgb(var(--lp-text))]/85"
          data-lp-element-type-editor-help
        >
          {runtimeEntry.editorHelpText}
        </p>
      ) : null}
      {definition.whenToUse ? (
        <p
          className="mb-1 line-clamp-2 text-[10px] font-medium leading-snug text-[rgb(var(--lp-text))]/80"
          data-lp-library-when-to-use
        >
          <span className="text-[rgb(var(--lp-muted))]">Når: </span>
          {definition.whenToUse}
        </p>
      ) : null}
      {diffLine ? (
        <p
          className="mb-1 line-clamp-2 text-[10px] text-[rgb(var(--lp-muted))]"
          data-lp-block-library-diff
          data-lp-library-differs-from
        >
          {diffLine}
        </p>
      ) : null}
      <div className="mt-auto flex w-full items-center justify-between text-[10px] text-[rgb(var(--lp-muted))]">
        <span
          className="max-w-[65%] truncate rounded border border-[rgb(var(--lp-border))] px-1 py-0.5"
          data-lp-library-group
        >
          {definition.libraryGroup} · {definition.category}
        </span>
        <span className="inline-flex items-center justify-center rounded bg-[rgb(var(--lp-card))] p-0.5">
          <Icon name={iconName} size="xs" />
        </span>
      </div>
    </button>
  );
}
