"use client";

/**
 * Legacy Umbraco-style left column: Hjem, page list, placeholders, create-sidepanel.
 * Props only — all state/callbacks owned by ContentWorkspace.
 */

import type { FormEvent, MutableRefObject, SetStateAction } from "react";
import { useEffect } from "react";
import { ContentWorkspaceViewModeChips } from "./ContentWorkspaceViewModeChips";
import type { ContentPage, ContentPageListItem } from "./ContentWorkspaceState";
import type { PageStatus } from "./contentWorkspace.types";
import type { MainWorkspaceView } from "./useContentWorkspaceShell";
import { getDocType, parseBodyEnvelope } from "./_stubs";
import { cmsPageDetailQueryString } from "./contentWorkspace.preview";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function listStatusTone(status: PageStatus): string {
  return status === "published"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-900";
}

export type ContentWorkspaceLegacySidebarProps = {
  hjemSingleClickTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  hjemExpanded: boolean;
  setHjemExpanded: (v: SetStateAction<boolean>) => void;
  items: ContentPageListItem[];
  selectContentPage: (id: string, slug: string | null | undefined) => void;
  selectedId: string;
  page: ContentPage | null;
  normalizeSlug: (v: unknown) => string;
  setCreatePanelOpen: (v: SetStateAction<boolean>) => void;
  setCreatePanelMode: (v: SetStateAction<"choose" | "form">) => void;
  mainView: MainWorkspaceView;
  goToGlobalWorkspace: () => void;
  goToDesignWorkspace: () => void;
  embedded: boolean;
  queryInput: string;
  setQueryInput: (v: SetStateAction<string>) => void;
  listError: string | null;
  listLoading: boolean;
  createPanelOpen: boolean;
  createPanelMode: "choose" | "form";
  createParentLoading: boolean;
  allowedChildTypes: string[];
  onCreate: (e: FormEvent<HTMLFormElement>) => void;
  createTitle: string;
  setCreateTitle: (v: SetStateAction<string>) => void;
  createSlug: string;
  setCreateSlug: (v: SetStateAction<string>) => void;
  setCreateSlugTouched: (v: SetStateAction<boolean>) => void;
  createError: string | null;
  creating: boolean;
  createDocumentTypeAlias: string | null;
  setCreateDocumentTypeAlias: (v: SetStateAction<string | null>) => void;
  setAllowedChildTypes: (v: SetStateAction<string[]>) => void;
  setCreateParentLoading: (v: SetStateAction<boolean>) => void;
};

export function ContentWorkspaceLegacySidebar(props: ContentWorkspaceLegacySidebarProps) {
  const {
    hjemSingleClickTimerRef,
    hjemExpanded,
    setHjemExpanded,
    items,
    selectContentPage,
    selectedId,
    page,
    normalizeSlug,
    setCreatePanelOpen,
    setCreatePanelMode,
    mainView,
    goToGlobalWorkspace,
    goToDesignWorkspace,
    embedded,
    queryInput,
    setQueryInput,
    listError,
    listLoading,
    createPanelOpen,
    createPanelMode,
    createParentLoading,
    allowedChildTypes,
    onCreate,
    createTitle,
    setCreateTitle,
    createSlug,
    setCreateSlug,
    setCreateSlugTouched,
    createError,
    creating,
    createDocumentTypeAlias,
    setCreateDocumentTypeAlias,
    setAllowedChildTypes,
    setCreateParentLoading,
  } = props;

  /** Umbraco Core Patch A: when Create panel opens, fetch parent page to get DocumentType.allowedChildTypes. */
  useEffect(() => {
    if (!createPanelOpen) {
      setAllowedChildTypes([]);
      setCreateDocumentTypeAlias(null);
      return;
    }
    const parentId = selectedId;
    if (!parentId) {
      setAllowedChildTypes(["page"]);
      setCreateParentLoading(false);
      return;
    }
    let cancelled = false;
    setCreateParentLoading(true);
    setAllowedChildTypes([]);
    fetch(
      `/api/backoffice/content/pages/${encodeURIComponent(parentId)}?${cmsPageDetailQueryString()}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        const pageData = data && typeof data === "object" && "data" in data ? (data as { data?: { page?: { body?: unknown } } }).data?.page : null;
        const body = pageData && typeof pageData === "object" && "body" in pageData ? (pageData as { body?: unknown }).body : undefined;
        const envelope = parseBodyEnvelope(body);
        const dt = envelope.documentType ? getDocType(envelope.documentType) : null;
        const allowed =
          dt?.allowedChildTypes && dt.allowedChildTypes.length > 0 ? dt.allowedChildTypes : ["page"];
        setAllowedChildTypes(allowed);
      })
      .catch(() => {
        if (!cancelled) setAllowedChildTypes(["page"]);
      })
      .finally(() => {
        if (!cancelled) setCreateParentLoading(false);
      });
    return () => { cancelled = true; };
  }, [createPanelOpen, selectedId, setAllowedChildTypes, setCreateDocumentTypeAlias, setCreateParentLoading]);

  return (
    <aside
      className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-100 md:border-b-0 md:border-r md:border-slate-200"
      data-lp-content-tree
    >
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">Content</p>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="space-y-2 p-3">
          {(() => {
            const slugLabel = (s: string | null | undefined) => safeStr(s);
            const isHomePage = (item: ContentPageListItem) => {
              const sl = slugLabel(item.slug);
              const t = (item.title || "").toLowerCase().trim();
              return (
                sl === "" ||
                sl === "/" ||
                sl === "index" ||
                sl === "hjem" ||
                sl === "front" ||
                sl.toLowerCase() === "forside" ||
                t === "forside" ||
                (t.includes("lunchportalen") && t.includes("firmalunsj"))
              );
            };
            const frontPage = items.find(isHomePage);
            const selectedNorm = normalizeSlug(selectedId);
            const isHjemActive =
              frontPage &&
              (selectedId === frontPage.id ||
                (selectedNorm && normalizeSlug(frontPage.slug) === selectedNorm) ||
                (page?.slug && normalizeSlug(page.slug) === normalizeSlug(frontPage.slug)));
            return (
              <div
                className={`flex items-center gap-1 rounded-lg border ${
                  isHjemActive ? "border-rose-200 bg-rose-50/90" : "border-slate-200/80 bg-white"
                }`}
                data-lp-content-tree-node-id={frontPage?.id ?? "home"}
                data-lp-content-tree-node-alias="home"
                data-lp-content-tree-node-label="Hjem"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (hjemSingleClickTimerRef.current) return;
                    hjemSingleClickTimerRef.current = setTimeout(() => {
                      hjemSingleClickTimerRef.current = null;
                      if (frontPage) selectContentPage(frontPage.id, frontPage.slug);
                    }, 250);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    if (hjemSingleClickTimerRef.current) {
                      clearTimeout(hjemSingleClickTimerRef.current);
                      hjemSingleClickTimerRef.current = null;
                    }
                    setHjemExpanded((prev) => !prev);
                  }}
                  className={`flex min-h-10 flex-1 items-center gap-2 rounded-l-lg px-2 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 ${
                    isHjemActive ? "bg-transparent" : ""
                  }`}
                  aria-current={isHjemActive ? "true" : undefined}
                  aria-expanded={hjemExpanded}
                  title="Enkel klikk: velg forsiden. Dobbel klikk: åpne/lukk sidetre."
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-600" aria-hidden>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </span>
                  <span className="text-slate-500 shrink-0 text-sm" aria-hidden>
                    {hjemExpanded ? "▼" : "▶"}
                  </span>
                  <span className="flex-1 font-medium">Hjem</span>
                  <span
                    className="shrink-0 text-slate-400"
                    title="Forsiden er fast og kan ikke slettes"
                    aria-hidden
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatePanelOpen(true);
                    setCreatePanelMode("choose");
                  }}
                  className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-r-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Opprett innhold under Hjem"
                  title="Opprett innhold under Hjem"
                >
                  <span className="text-lg leading-none">+</span>
                </button>
              </div>
            );
          })()}

          <ContentWorkspaceViewModeChips
            mainView={mainView}
            onOpenGlobal={goToGlobalWorkspace}
            onOpenDesign={goToDesignWorkspace}
          />

          {!embedded && hjemExpanded ? (
            <div className="ml-1 border-l-2 border-slate-200 pl-3">
              <label className="grid gap-1 text-xs">
                <span className="text-slate-500">Search</span>
                <input
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="title / slug"
                />
              </label>
              {listError ? (
                <div className="mt-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
                  {listError}
                </div>
              ) : null}
              <div className="mt-2 min-h-0">
                {listLoading ? (
                  <div className="py-2 text-xs text-slate-500">Loading...</div>
                ) : items.length === 0 ? (
                  <div className="py-2 text-xs text-slate-500">Ingen sider.</div>
                ) : (
                  <ul className="space-y-0.5">
                    {items.map((item) => {
                      const itemSlugNorm = normalizeSlug(item.slug);
                      const selectedNorm = normalizeSlug(selectedId);
                      const active =
                        selectedId === item.id ||
                        (itemSlugNorm && selectedNorm && itemSlugNorm === selectedNorm) ||
                        (safeStr(page?.slug).length > 0 && normalizeSlug(page?.slug) === itemSlugNorm);
                      const slugLabel = safeStr(item.slug);
                      const itemTitle = (item.title || "").toLowerCase().trim();
                      const isHome =
                        slugLabel === "" ||
                        slugLabel === "/" ||
                        slugLabel === "index" ||
                        slugLabel === "hjem" ||
                        slugLabel.toLowerCase() === "forside" ||
                        slugLabel.toLowerCase() === "lunchportalen-firmalunsj-med-kontroll-og-forutsigbarhet" ||
                        itemTitle === "forside" ||
                        (itemTitle.includes("lunchportalen") && itemTitle.includes("firmalunsj"));
                      const displayTitle = isHome ? "Forside" : item.title || "(Untitled)";
                      const displaySlug = isHome && !slugLabel ? "/" : `/${slugLabel || "-"}`;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => selectContentPage(item.id, item.slug)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                              active ? "bg-rose-50 text-slate-900" : "hover:bg-slate-50 text-slate-800"
                            }`}
                            data-lp-content-tree-node-id={item.id}
                            data-lp-content-tree-node-alias="unknown"
                            data-lp-content-tree-node-label={displayTitle}
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-600">
                              {isHome ? "⌂ " : "–"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{displayTitle}</p>
                              <p className="truncate text-[11px] text-slate-500">{displaySlug}</p>
                            </div>
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${listStatusTone(
                                item.status
                              )}`}
                            >
                              {item.status === "published" ? "live" : "draft"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {[{ label: "Maler (dokumenttyper)", icon: "⊞" }].map(({ label, icon }) => (
            <div key={label} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500">
              <span className="opacity-70">{icon}</span>
              <span className="flex-1">{label}</span>
              <span className="text-slate-400" title="Kommer snart">
                –
              </span>
            </div>
          ))}

          <p className="mt-4 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">TJENESTER</p>
          {["Vercel", "Sanity", "Supabase"].map((name) => (
            <div key={name} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600">
              <span className="text-slate-400">–</span>
              <span>{name}</span>
              <span className="text-slate-400">–</span>
            </div>
          ))}

          <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600">
            <span>–</span>
            <span>Papirkurv</span>
            <span className="text-slate-400">–</span>
          </div>

          <p className="mt-4 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">INNSTILLINGER</p>
          <p className="px-2 text-[10px] text-slate-500">Struktur</p>
          {["Dokumenttyper", "Datatyper"].map((name) => (
            <div key={name} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-600">
              <span className="text-slate-400">–</span>
              <span>{name}</span>
            </div>
          ))}
          <p className="mt-2 px-2 text-[10px] text-slate-500">Avansert</p>
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-600">
            <span className="text-slate-400">–</span>
            <span>Logg</span>
          </div>
        </div>

        {createPanelOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default border-0 bg-black/20 p-0 md:z-30"
              aria-label="Lukk"
              onClick={() => {
                setCreatePanelOpen(false);
                setCreatePanelMode("choose");
                setCreateDocumentTypeAlias(null);
              }}
            />
            <div
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-xl md:z-40"
              role="dialog"
              aria-labelledby="create-panel-title"
              aria-modal="true"
              data-lp-create-child-dialog
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 id="create-panel-title" className="text-sm font-semibold text-slate-800">
                  Opprett
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setCreatePanelOpen(false);
                    setCreatePanelMode("choose");
                    setCreateDocumentTypeAlias(null);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Lukk"
                >
                  –
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-4 text-sm text-slate-600">
                  {selectedId ? "Opprett undernode under valgt side." : "Opprett ny side."}
                </p>
                {createPanelMode === "choose" ? (
                  <>
                    {createParentLoading ? (
                      <p className="text-sm text-slate-500">Laster tillatte typer…</p>
                    ) : allowedChildTypes.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Tilordne dokumenttype til forelder for å opprette undernoder, eller velg en forelder.
                      </p>
                    ) : null}
                    {allowedChildTypes.map((alias) => {
                      const dt = getDocType(alias);
                      const name = dt?.name ?? alias;
                      return (
                        <button
                          key={alias}
                          type="button"
                          onClick={() => {
                            setCreateDocumentTypeAlias(alias);
                            setCreatePanelMode("form");
                          }}
                          className="mb-3 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-slate-200 bg-white p-6 text-left transition hover:border-slate-300 hover:bg-slate-50"
                          data-lp-create-child-option
                          data-lp-create-child-option-alias={alias}
                          data-lp-allowed-child-alias={alias}
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-2xl text-slate-600">
                            ⊞
                          </span>
                          <span className="font-medium text-slate-800">{name}</span>
                          <span className="text-xs text-slate-500">Opprett en ny «{name}».</span>
                        </button>
                      );
                    })}
                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setCreatePanelOpen(false);
                          setCreatePanelMode("choose");
                          setCreateDocumentTypeAlias(null);
                        }}
                        className="text-sm text-slate-500 hover:text-slate-700"
                      >
                        Avbryt
                      </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={onCreate} className="space-y-4">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-600">Tittel</span>
                      <input
                        value={createTitle}
                        onChange={(e) => setCreateTitle(e.target.value)}
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                        placeholder="F.eks. Kontakt"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-600">Slug</span>
                      <input
                        value={createSlug}
                        onChange={(e) => {
                          setCreateSlugTouched(true);
                          setCreateSlug(e.target.value);
                        }}
                        onBlur={() => setCreateSlug(normalizeSlug(createSlug))}
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                        placeholder="kontakt"
                      />
                    </label>
                    {createError ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                        {createError}
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCreatePanelMode("choose")}
                        className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Tilbake
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="min-h-[40px] flex-1 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {creating
                          ? "Oppretter…"
                          : `Opprett ${
                              createDocumentTypeAlias
                                ? getDocType(createDocumentTypeAlias)?.name ?? createDocumentTypeAlias
                                : "side"
                            }`}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
