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

const bar = "rounded-[1px] bg-white/42";
const barSoft = "rounded-[1px] bg-white/28";
const frame = "rounded-sm border border-white/25 bg-white/12";

/** Syntetisk mini-layout i insert-tiles (samme idé som blokkrader, kompakt for bibliotek). */
function InsertTilePreview({ typeKey }: { typeKey: string }) {
  const k = typeKey.trim();
  switch (k) {
    case "hero":
    case "hero_full":
    case "hero_bleed":
      return (
        <div className="relative z-10 flex h-full w-full flex-col gap-0.5 p-1">
          <div className={`h-0.5 w-[68%] ${bar}`} />
          <div className="flex min-h-0 flex-1 gap-0.5">
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-px">
              <div className={`h-px w-full ${barSoft}`} />
              <div className={`h-px w-[78%] ${barSoft}`} />
              <div className="mt-px h-1.5 w-[48%] rounded-sm bg-white/48" />
            </div>
            <div className={`w-[34%] shrink-0 ${frame}`} />
          </div>
        </div>
      );
    case "richText":
      return (
        <div className="relative z-10 flex h-full w-full gap-0.5 p-1">
          <div className="w-px shrink-0 rounded-full bg-white/55" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-px py-0.5">
            <div className={`h-px w-full ${bar}`} />
            <div className={`h-px w-[88%] ${barSoft}`} />
            <div className={`h-px w-[72%] ${barSoft}`} />
          </div>
        </div>
      );
    case "image":
      return (
        <div className="relative z-10 flex h-full w-full items-center justify-center p-1">
          <div className={`flex aspect-[4/3] w-[72%] items-center justify-center ${frame}`}>
            <div className="h-2 w-2 rotate-45 border border-white/35" />
          </div>
        </div>
      );
    case "banner":
      return (
        <div className="relative z-10 flex h-full w-full flex-col justify-center gap-0.5 px-1 py-0.5">
          <div className={`h-1 w-full ${bar}`} />
          <div className={`mx-auto h-px w-[52%] ${barSoft}`} />
        </div>
      );
    case "cards":
      return (
        <div className="relative z-10 grid h-full w-full grid-cols-2 gap-px p-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`min-h-0 rounded-[1px] ${frame}`} />
          ))}
        </div>
      );
    case "grid":
      return (
        <div className="relative z-10 grid h-full w-full grid-cols-3 grid-rows-2 gap-px p-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`min-h-0 rounded-[1px] ${barSoft}`} />
          ))}
        </div>
      );
    case "pricing":
      return (
        <div className="relative z-10 flex h-full w-full items-end justify-center gap-px px-1 pb-0.5 pt-1">
          <div className="h-[38%] w-[28%] rounded-t-sm border border-b-0 border-white/25 bg-white/18" />
          <div className="h-[52%] w-[28%] rounded-t-sm border border-b-0 border-white/25 bg-white/22" />
          <div className="h-[30%] w-[28%] rounded-t-sm border border-b-0 border-white/25 bg-white/15" />
        </div>
      );
    case "zigzag":
      return (
        <div className="relative z-10 flex h-full w-full flex-col justify-center gap-0.5 px-1 py-0.5">
          <div className="flex gap-0.5">
            <div className={`h-1.5 w-[40%] ${frame}`} />
            <div className={`h-1.5 flex-1 ${barSoft}`} />
          </div>
          <div className="flex gap-0.5 pl-1">
            <div className={`h-1.5 flex-1 ${barSoft}`} />
            <div className={`h-1.5 w-[40%] ${frame}`} />
          </div>
        </div>
      );
    case "cta":
      return (
        <div className="relative z-10 flex h-full w-full items-center gap-0.5 p-1">
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <div className={`h-px w-full ${barSoft}`} />
            <div className={`h-px w-[65%] ${barSoft}`} />
          </div>
          <div className="h-3 w-[36%] shrink-0 rounded-sm bg-white/45" />
        </div>
      );
    case "form":
      return (
        <div className="relative z-10 flex h-full w-full flex-col gap-px p-1">
          <div className={`h-1.5 w-full ${frame}`} />
          <div className={`h-px w-full ${barSoft}`} />
          <div className={`h-px w-[82%] ${barSoft}`} />
        </div>
      );
    case "relatedLinks":
      return (
        <div className="relative z-10 flex h-full w-full flex-col justify-center gap-px px-1.5 py-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-0.5">
              <div className="h-px w-px rounded-full bg-white/55" />
              <div className={`h-px flex-1 ${i === 1 ? bar : barSoft}`} />
            </div>
          ))}
        </div>
      );
    case "divider":
      return (
        <div className="relative z-10 flex h-full w-full items-center px-1">
          <div className="h-px w-full rounded-full bg-white/45" />
        </div>
      );
    default:
      return (
        <div className="relative z-10 flex h-full w-full flex-col justify-center gap-px p-1">
          <div className={`h-px w-full ${bar}`} />
          <div className={`h-px w-[84%] ${barSoft}`} />
          <div className={`h-px w-[68%] ${barSoft}`} />
        </div>
      );
  }
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
    { key: "all", label: "Alle" },
    { key: "content", label: "Innhold" },
    { key: "layout", label: "Layout" },
    { key: "navigation", label: "Navigasjon" },
    { key: "system", label: "System" },
    { key: "marketing", label: "Markedsføring" },
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
    <div className="fixed inset-0 z-[80]" data-lp-block-insert-overlay="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        aria-label="Lukk blokkbibliotek"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-block-insert-title"
        className="absolute inset-y-0 right-0 z-[81] flex w-full max-w-[420px] flex-col border-l border-slate-300/90 bg-white shadow-[-20px_0_40px_rgba(15,23,42,0.14)] outline-none sm:w-[420px]"
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-slate-200/95 bg-[#f6f7f9] px-3 pb-3 pt-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2
                id="lp-block-insert-title"
                className="text-[16px] font-semibold leading-tight tracking-tight text-slate-900"
              >
                Sett inn blokk
              </h2>
              {context.blockListCreateLabel ? (
                <p className="mt-1 text-[11px] leading-snug text-slate-500" data-lp-library-create-label>
                  {context.blockListCreateLabel}
                </p>
              ) : null}
              {context.blockEditorDataTypeAlias ? (
                <p
                  className="mt-1 max-w-full text-[10px] leading-snug text-slate-400"
                  data-lp-block-property-binding
                >
                  <span data-lp-block-editor-data-type>{context.blockEditorDataTypeAlias}</span>
                  {dataTypeDefinition ? (
                    <>
                      {" "}
                      · <span data-lp-block-library-allowed-count>{availableEntries.length}</span> typer
                      {typeof context.blockMaxItems === "number" ? (
                        <>
                          {" "}
                          · maks <span data-lp-block-list-max>{context.blockMaxItems}</span>
                        </>
                      ) : null}
                      {typeof context.blockCount === "number" ? (
                        <>
                          {" "}
                          · <span data-lp-block-list-current>{context.blockCount}</span> nå
                        </>
                      ) : null}
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300/90 bg-white text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
              aria-label="Lukk"
            >
              <Icon name="close" size="sm" />
            </button>
          </div>
          <input
            ref={searchRef}
            type="search"
            aria-label="Søk blant blokker"
            placeholder="Søk etter blokk …"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-3 w-full rounded border border-slate-300/90 bg-white px-2.5 py-2 text-[13px] text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#3544b1]/70 focus:ring-1 focus:ring-[#3544b1]/20"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled
              className="rounded border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-400 opacity-60"
              title="Ikke tilgjengelig i denne versjonen"
            >
              Opprett tom
            </button>
            <button
              type="button"
              disabled
              className="rounded border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-400 opacity-60"
              title="Ikke tilgjengelig i denne versjonen"
            >
              Utklipp
            </button>
          </div>
          <div className="mt-2 flex max-w-full flex-wrap gap-1">
            {categories.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setCategory(entry.key)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  category === entry.key
                    ? "border-slate-800 bg-slate-900 text-white"
                    : "border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>{entry.label}</span>
                <span className={`text-[10px] ${category === entry.key ? "text-slate-300" : "text-slate-400"}`}>
                  {countByCategory[entry.key]}
                </span>
              </button>
            ))}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-clip bg-white text-[13px]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            {category === "all" && favoriteEntries.length > 0 ? (
              <BlockLibrarySection
                title="Favoritter"
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
                title="Nylig"
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

            <section className="min-h-0">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                {category === "all" ? "Blokkatalog" : "Blokker"}
              </h3>
              {showCatalogGroups ? (
                <div className="space-y-4 pb-2" data-lp-block-library-catalog>
                  {catalogGrouped.map(({ group, items }) => (
                    <div key={group}>
                      <h4
                        className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                        data-lp-block-library-group-title={group}
                        data-lp-library-group={group}
                      >
                        {group}
                      </h4>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {items.map((definition) => (
                          <BlockLibraryTile
                            key={definition.type}
                            definition={definition}
                            runtimeEntry={elementRuntimeMerged?.[definition.type] ?? null}
                            isActive={blockLibraryTileIsActive(definition, flatList, activeIndex, activeType)}
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Alle blokker">
                  {otherEntriesSorted.map((definition) => (
                    <BlockLibraryTile
                      key={definition.type}
                      definition={definition}
                      runtimeEntry={elementRuntimeMerged?.[definition.type] ?? null}
                      isActive={blockLibraryTileIsActive(definition, flatList, activeIndex, activeType)}
                      isFavorite={favorites.includes(definition.type)}
                      onPick={handlePick}
                      onFavoriteToggle={handleFavoriteToggle}
                    />
                  ))}
                </div>
              )}
              {!flatList.length ? (
                <div className="mt-2 rounded border border-dashed border-slate-300/90 bg-slate-50 px-3 py-6 text-center text-[12px] text-slate-500">
                  Ingen blokker matcher søket ditt.
                </div>
              ) : null}
            </section>
          </div>

          <footer className="shrink-0 border-t border-slate-300/90 bg-[#f3f4f6] px-3 py-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-md border border-slate-400/80 bg-white py-2.5 text-center text-[13px] font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-50"
            >
              Avbryt
            </button>
            <p className="mt-2 text-center text-[10px] leading-snug text-slate-500">
              Piltaster · Enter setter inn · Esc lukker · ⌘K / Ctrl+K søk
            </p>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function blockLibraryTileIsActive(
  definition: BackofficeBlockDefinition,
  flatList: BackofficeBlockDefinition[],
  activeIndex: number,
  activeType: string | null,
) {
  return (
    flatList.findIndex((entry) => entry.type === definition.type) === activeIndex && definition.type === activeType
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
    <section className="mb-4">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{title}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={`${title} blocks`}>
        {items.map((definition) => (
          <BlockLibraryTile
            key={definition.type}
            definition={definition}
            runtimeEntry={elementRuntimeMerged?.[definition.type] ?? null}
            isActive={blockLibraryTileIsActive(definition, flatList, activeIndex, activeType)}
            isFavorite={favorites.includes(definition.type)}
            onPick={onPick}
            onFavoriteToggle={onFavoriteToggle}
          />
        ))}
      </div>
    </section>
  );
}

function BlockLibraryTile(props: {
  definition: BackofficeBlockDefinition;
  runtimeEntry: ElementTypeRuntimeMergedEntry | null;
  isActive: boolean;
  isFavorite: boolean;
  onPick: (definition: BackofficeBlockDefinition) => void;
  onFavoriteToggle: (definition: BackofficeBlockDefinition, event: MouseEvent) => void;
}) {
  const { definition, runtimeEntry, isActive, isFavorite, onPick, onFavoriteToggle } = props;
  const displayTitle = runtimeEntry?.title ?? definition.label;
  const primaryDesc = (runtimeEntry?.description ?? definition.description ?? "").trim();
  const help = (runtimeEntry?.editorHelpText ?? "").trim();
  const secondary =
    [primaryDesc, help].filter(Boolean).join(" · ") ||
    (definition.whenToUse?.trim() ? `Passer når: ${definition.whenToUse}` : "");
  const diffLine = differsFromSummary(definition);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onPick(definition)}
        className={`flex w-full flex-col overflow-clip rounded-md border text-left shadow-sm transition-all ${
          isActive
            ? "border-[#3544b1] ring-2 ring-[#3544b1]/35"
            : "border-slate-200/95 hover:border-slate-300 hover:shadow-md"
        }`}
        aria-pressed={isActive}
        data-lp-block-library-tile={definition.type}
        data-lp-library-block-alias={definition.type}
        data-lp-element-type-alias={definition.type}
      >
        <div className="relative h-[4.5rem] w-full shrink-0 overflow-clip">
          <div className="absolute inset-0 bg-gradient-to-b from-[#2a3f5c] to-[#141c2a]" aria-hidden />
          <InsertTilePreview typeKey={definition.type} />
        </div>
        <div className="flex flex-col gap-0.5 border-t border-slate-100 bg-white px-2 py-1.5">
          <span
            className="line-clamp-2 text-[11px] font-semibold leading-snug text-slate-900"
            data-lp-library-title
            data-lp-element-type-title
          >
            {displayTitle}
          </span>
          {secondary ? (
            <span className="line-clamp-2 text-[9px] leading-snug text-slate-500" data-lp-library-description>
              {secondary}
            </span>
          ) : null}
        </div>
      </button>
      {runtimeEntry?.editorHelpText ? (
        <span className="sr-only" data-lp-element-type-editor-help>
          {runtimeEntry.editorHelpText}
        </span>
      ) : null}
      {definition.whenToUse ? (
        <span className="sr-only" data-lp-library-when-to-use>
          {definition.whenToUse}
        </span>
      ) : null}
      {diffLine ? (
        <span className="sr-only" data-lp-block-library-diff data-lp-library-differs-from>
          {diffLine}
        </span>
      ) : null}
      <span className="sr-only" data-lp-library-group>
        {definition.libraryGroup} · {definition.category}
      </span>
      <button
        type="button"
        onClick={(event) => onFavoriteToggle(definition, event)}
        className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded border border-white/40 bg-black/35 text-[11px] text-amber-200 shadow-sm hover:bg-black/50"
        aria-label="Favoritt"
      >
        {isFavorite ? "★" : "☆"}
      </button>
    </div>
  );
}
