"use client";

import { Fragment, type ReactNode } from "react";

/* =========================================================
   TYPES
========================================================= */

export type UmbracoBlockRow = {
  id: string;
  /** Primær: blokkenavn (menneskelesbart). */
  typeLabel: string;
  /** Stabil type for syntetisk mini-preview. */
  typeKey: string;
  /** Sekundær: liten komponentlinje under tittel. */
  componentLine: string;
  /** Valgfri telle-/items-linje (f.eks. «3 kort»). */
  statsLine?: string | null;
  /** Valgfri detalj under meta. */
  detailLine?: string | null;
  icon?: ReactNode;
};

const bar = "rounded-[1px] bg-white/42";
const barSoft = "rounded-[1px] bg-white/28";
const frame = "rounded-sm border border-white/25 bg-white/12";

/** Syntetisk mini-layout per blokktype — ingen monogram, ingen typeKey som grafikk. */
function BlockMiniPreview({ typeKey }: { typeKey: string }) {
  const k = typeKey.trim();

  switch (k) {
    case "hero":
    case "hero_full":
    case "hero_bleed":
      return (
        <div className="relative z-10 flex h-full w-full flex-col gap-1 p-1.5">
          <div className={`h-1 w-[70%] ${bar}`} />
          <div className="flex min-h-0 flex-1 gap-1">
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <div className={`h-px w-full ${barSoft}`} />
              <div className={`h-px w-[82%] ${barSoft}`} />
              <div className="mt-0.5 h-2 w-[52%] rounded-sm bg-white/50" />
            </div>
            <div className={`w-[36%] shrink-0 ${frame}`} />
          </div>
        </div>
      );
    case "richText":
      return (
        <div className="relative z-10 flex h-full w-full gap-1 p-1.5">
          <div className="w-0.5 shrink-0 rounded-full bg-white/55" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5">
            <div className={`h-px w-full ${bar}`} />
            <div className={`h-px w-[92%] ${barSoft}`} />
            <div className={`h-px w-[78%] ${barSoft}`} />
            <div className={`h-px w-[88%] ${barSoft}`} />
          </div>
        </div>
      );
    case "image":
      return (
        <div className="relative z-10 flex h-full w-full items-center justify-center p-1.5">
          <div className={`flex aspect-[4/3] w-[78%] items-center justify-center ${frame}`}>
            <div className="h-3 w-3 rotate-45 border border-white/35" />
          </div>
        </div>
      );
    case "banner":
      return (
        <div className="relative z-10 flex h-full w-full flex-col justify-center gap-1 p-1.5">
          <div className={`h-1.5 w-full ${bar}`} />
          <div className={`mx-auto h-0.5 w-[55%] ${barSoft}`} />
        </div>
      );
    case "cards":
      return (
        <div className="relative z-10 grid h-full w-full grid-cols-2 gap-0.5 p-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`min-h-0 rounded-sm ${frame}`} />
          ))}
        </div>
      );
    case "grid":
      return (
        <div className="relative z-10 grid h-full w-full grid-cols-3 grid-rows-2 gap-px p-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`min-h-0 rounded-[1px] ${barSoft}`} />
          ))}
        </div>
      );
    case "pricing":
      return (
        <div className="relative z-10 flex h-12 w-full items-end justify-center gap-0.5 px-1 pt-1">
          <div className="h-5 w-[26%] rounded-t-sm border border-b-0 border-white/25 bg-white/18" />
          <div className="h-8 w-[26%] rounded-t-sm border border-b-0 border-white/25 bg-white/22" />
          <div className="h-4 w-[26%] rounded-t-sm border border-b-0 border-white/25 bg-white/15" />
        </div>
      );
    case "zigzag":
      return (
        <div className="relative z-10 flex h-full w-full flex-col justify-center gap-1 px-1.5 py-1">
          <div className="flex gap-1">
            <div className={`h-2 w-[42%] ${frame}`} />
            <div className={`h-2 flex-1 ${barSoft}`} />
          </div>
          <div className="flex gap-1 pl-2">
            <div className={`h-2 flex-1 ${barSoft}`} />
            <div className={`h-2 w-[42%] ${frame}`} />
          </div>
        </div>
      );
    case "cta":
      return (
        <div className="relative z-10 flex h-full w-full items-center gap-1 p-1.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className={`h-px w-full ${barSoft}`} />
            <div className={`h-px w-[70%] ${barSoft}`} />
          </div>
          <div className="h-5 w-[38%] shrink-0 rounded-sm bg-white/45" />
        </div>
      );
    case "form":
      return (
        <div className="relative z-10 flex h-full w-full flex-col gap-0.5 p-1.5">
          <div className={`h-2 w-full ${frame}`} />
          <div className={`h-1 w-full ${barSoft}`} />
          <div className={`h-1 w-[88%] ${barSoft}`} />
          <div className={`mt-0.5 h-2 w-[40%] rounded-sm bg-white/40`} />
        </div>
      );
    case "relatedLinks":
      return (
        <div className="relative z-10 flex h-full w-full flex-col justify-center gap-0.5 px-2 py-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="h-0.5 w-0.5 rounded-full bg-white/55" />
              <div className={`h-px flex-1 ${i === 1 ? bar : barSoft}`} />
            </div>
          ))}
        </div>
      );
    case "divider":
      return (
        <div className="relative z-10 flex h-full w-full items-center px-1.5">
          <div className="h-0.5 w-full rounded-full bg-white/45" />
        </div>
      );
    default:
      return (
        <div className="relative z-10 flex h-full w-full flex-col justify-center gap-0.5 p-1.5">
          <div className={`h-px w-full ${bar}`} />
          <div className={`h-px w-[88%] ${barSoft}`} />
          <div className={`h-px w-[72%] ${barSoft}`} />
        </div>
      );
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export function UmbracoBlockPropertyField({
  label,
  description,
  rows,
  expandedId,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onAdd,
  renderInlineEditor,
  variant = "property",
  /** Rad kobles til valgt modul (ingen inline-accordion); brukes sammen med `focusedRowId` / `onSelectRow`. */
  listNavMode = false,
  focusedRowId = null,
  onSelectRow,
  /** Sekundær modulnavigasjon (smal kolonne): tynnere rader, mindre meta. */
  navLayoutCompact = false,
}: {
  label: string;
  description?: string | null;
  rows: UmbracoBlockRow[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAdd?: () => void;
  renderInlineEditor: (id: string) => ReactNode;
  /** `pageBuilder`: komponentliste i innholdsflaten — uten property-felt-ramme, full bredde. */
  variant?: "property" | "pageBuilder";
  listNavMode?: boolean;
  focusedRowId?: string | null;
  onSelectRow?: (id: string) => void;
  navLayoutCompact?: boolean;
}) {
  const pageBuilder = variant === "pageBuilder";

  return (
    <section
      className={`min-w-0 ${pageBuilder ? "space-y-0" : "space-y-2"}`}
      data-lp-umbraco-block-property-field="true"
      data-lp-umbraco-block-field-variant={variant}
      data-lp-component-builder-surface={pageBuilder ? "true" : undefined}
      data-lp-block-list-nav-compact={navLayoutCompact ? "true" : undefined}
    >
      {pageBuilder ? (
        <div className="sr-only">
          {label}
          {description ? ` — ${description}` : ""}
        </div>
      ) : (
        <div className="space-y-0.5">
          <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
            {label}
          </label>
          {description ? (
            <p className="text-[11px] leading-snug text-slate-400">{description}</p>
          ) : null}
        </div>
      )}

      <div
        className={`w-full overflow-hidden rounded-lg border border-slate-300/85 bg-white shadow-sm ${
          pageBuilder ? "max-w-none" : "max-w-[52rem]"
        }`}
      >
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-center text-[13px] text-slate-500">
            {pageBuilder
              ? "Ingen komponenter i listen ennå. Bruk «Legg til» under for å plassere en ny modul i flaten."
              : "Ingen innholdsblokker lagt til."}
          </div>
        ) : (
          <div className="divide-y divide-slate-200/85">
            {rows.map((row) => {
              const open = !listNavMode && expandedId === row.id;
              const rowFocused = Boolean(listNavMode && focusedRowId === row.id);

              const activateRow = () => {
                if (listNavMode && onSelectRow) {
                  onSelectRow(row.id);
                  return;
                }
                onToggleExpand(row.id);
              };

              return (
                <Fragment key={row.id}>
                  <div
                    className={`group/block min-w-0 ${
                      rowFocused ? "bg-slate-50/95 ring-1 ring-inset ring-[#2a3b96]/35" : open ? "bg-slate-50/95" : "bg-white"
                    }`}
                    data-lp-block-row
                    data-lp-block-type-key={row.typeKey}
                    data-lp-component-instance-row={pageBuilder ? "true" : undefined}
                    data-lp-block-list-nav-selected={listNavMode && rowFocused ? "true" : undefined}
                  >
                    <div
                      className={`flex w-full min-w-0 items-stretch ${
                        navLayoutCompact && pageBuilder ?
                          "min-h-[2.65rem]"
                        : pageBuilder ?
                          "min-h-[3.85rem]"
                        : "min-h-[3.5rem]"
                      }`}
                    >
                      {/* A — liten mørk previewflate (syntetisk mini-komponent) */}
                      <div
                        className={`relative flex shrink-0 overflow-hidden border-r border-black/20 ${
                          navLayoutCompact && pageBuilder ?
                            "w-10 sm:w-10"
                          : pageBuilder ?
                            "w-14 sm:w-[4.25rem]"
                          : "w-[3.35rem] sm:w-14"
                        }`}
                      >
                        <div
                          className="absolute inset-0 bg-gradient-to-b from-[#243652] to-[#141c2a]"
                          aria-hidden
                        />
                        <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay">
                          <div
                            className="h-full w-full"
                            style={{
                              backgroundImage:
                                "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 5px)",
                            }}
                          />
                        </div>
                        {row.icon ? (
                          <div className="relative z-10 flex flex-1 items-center justify-center text-white [&>svg]:h-7 [&>svg]:w-7">
                            {row.icon}
                          </div>
                        ) : (
                          <BlockMiniPreview typeKey={row.typeKey} />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            activateRow();
                          }}
                          aria-expanded={listNavMode ? undefined : open}
                          aria-label={
                            listNavMode
                              ? rowFocused
                                ? "Valgt modul"
                                : "Velg modul"
                              : open
                                ? "Skjul innhold"
                                : "Vis innhold"
                          }
                          className={`absolute bottom-0.5 left-0.5 z-20 flex items-center justify-center rounded border border-white/25 bg-black/45 text-white/95 shadow-sm transition-colors hover:bg-black/60 ${
                          navLayoutCompact ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]"
                        }`}
                        >
                          <span
                            className={`inline-block leading-none transition-transform ${
                              !listNavMode && open ? "translate-x-px rotate-90" : ""
                            }`}
                          >
                            ▸
                          </span>
                        </button>
                      </div>

                      {/* B — primær tittel, deretter komponentlinje, tellelinje, detalj */}
                      <button
                        type="button"
                        onClick={activateRow}
                        className={`flex min-w-0 max-w-[calc(100%-5.5rem)] flex-1 flex-col justify-center text-left sm:max-w-[calc(100%-6rem)] ${
                          navLayoutCompact ? "px-2 py-1" : "px-2.5 py-2 sm:px-3"
                        }`}
                      >
                        <span
                          className={`truncate font-semibold leading-tight tracking-tight text-slate-900 ${
                            navLayoutCompact ? "text-[13px]" : "text-[15px]"
                          }`}
                        >
                          {row.typeLabel}
                        </span>
                        <span
                          className={`mt-0.5 truncate font-medium uppercase tracking-[0.12em] text-slate-500 ${
                            navLayoutCompact ? "text-[9px]" : "text-[10px]"
                          }`}
                        >
                          {row.componentLine}
                        </span>
                        {!navLayoutCompact && row.statsLine ? (
                          <span className="mt-1 truncate text-[11px] font-medium tabular-nums text-slate-500">
                            {row.statsLine}
                          </span>
                        ) : null}
                        {!navLayoutCompact && row.detailLine ? (
                          <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
                            {row.detailLine}
                          </span>
                        ) : null}
                      </button>

                      {/* C — trailing: nesten usynlig til hover/fokus */}
                      <div className="flex w-7 shrink-0 flex-col items-center justify-center gap-px border-l border-slate-200/50 bg-white py-0.5 opacity-0 transition-opacity duration-150 group-hover/block:opacity-100 group-focus-within/block:opacity-100 [@media(hover:none)]:opacity-[0.12]">
                        {onMoveUp ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveUp(row.id);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded text-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Flytt opp"
                          >
                            ↑
                          </button>
                        ) : null}
                        {onMoveDown ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveDown(row.id);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded text-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Flytt ned"
                          >
                            ↓
                          </button>
                        ) : null}
                        {onDuplicate ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicate(row.id);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded text-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Dupliser"
                          >
                            ⧉
                          </button>
                        ) : null}
                        {onDelete ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(row.id);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded text-[10px] text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Slett"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {open ? (
                    <div
                      className="border-l-[3px] border-l-[#1e3358] border-t border-slate-200/70 bg-[#f6f7f9] px-3 py-3 sm:px-4"
                      data-lp-inline-editor
                    >
                      {renderInlineEditor(row.id)}
                    </div>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        )}

        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className={`flex w-full items-center justify-center border-t-[3px] border-dashed px-4 text-center transition-colors ${
              navLayoutCompact ? "min-h-10" : "min-h-[3.5rem]"
            } ${
              pageBuilder
                ? "border-slate-500/80 bg-slate-100/95 hover:border-[#2a3b96]/50 hover:bg-slate-200/95"
                : "border-slate-500/90 bg-slate-200/90 hover:border-slate-600 hover:bg-slate-300/90"
            }`}
          >
            <span className={`font-semibold tracking-wide text-slate-700 ${navLayoutCompact ? "text-[12px]" : "text-[14px]"}`}>
              {pageBuilder ? "+ Legg til komponent" : "+ Legg til innhold"}
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
