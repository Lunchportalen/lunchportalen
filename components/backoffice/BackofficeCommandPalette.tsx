"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  entityRowsForDiscoveryPalette,
  mergeDiscoveryPaletteItems,
  type DiscoveryEntityBundle,
} from "@/lib/cms/backofficeDiscoveryEntities";
import { rankDiscoveryNavItems } from "@/lib/cms/backofficeDiscoveryIndex";
import {
  BACKOFFICE_PALETTE_ITEMS,
  filterBackofficeNavItems,
  groupFilteredBackofficeNavItems,
} from "@/lib/cms/backofficeExtensionRegistry";
import { Icon } from "@/components/ui/Icon";

/**
 * CP10 — Umbraco-lignende hurtignavigasjon: filtrert liste over eksisterende backoffice-ruter.
 * CP11 — Grupperte treff (ingen ny søkemotor).
 * U19 — Indeksert rankering over samme manifest (`rankDiscoveryNavItems`).
 * U20 — Fusjon med faktiske content_pages / media_items ved søk (én palett, liten server-bundle).
 */
export function BackofficeCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [entityBundle, setEntityBundle] = useState<DiscoveryEntityBundle | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const base = filterBackofficeNavItems(BACKOFFICE_PALETTE_ITEMS, query);
    const rankedNav = rankDiscoveryNavItems(base, query);
    const entityRows = entityRowsForDiscoveryPalette(entityBundle, query);
    return mergeDiscoveryPaletteItems(rankedNav, entityRows);
  }, [query, entityBundle]);
  const grouped = useMemo(() => groupFilteredBackofficeNavItems(filtered), [filtered]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      } else if (e.key === "Enter" && filtered[highlight]) {
        e.preventDefault();
        go(filtered[highlight].href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, highlight, go]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backoffice-cmd-palette-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="backoffice-cmd-palette-title" className="sr-only">
          Hopp til backoffice-modul
        </h2>
        <div className="border-b border-slate-100 px-3 py-2">
          <input
            ref={inputRef}
            type="search"
            autoComplete="off"
            placeholder="Søk modul, alias, sti eller hurtiglenke…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            aria-label="Filtrer moduler"
          />
          <p className="mt-1 text-xs text-slate-500">
            Ctrl+K / ⌘K · Enter åpner · Esc lukker · manifest (U19) + sider/media ved søk (U20) — ikke en ekstern
            søkemotorplattform
          </p>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-1" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">Ingen treff.</li>
          ) : (
            grouped.map((g) => (
              <Fragment key={g.groupId}>
                <li className="list-none px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {g.label}
                </li>
                {g.items.map((item) => {
                  const i = filtered.indexOf(item);
                  const rowKey = item.extensionId ?? item.href;
                  return (
                    <li key={rowKey} role="option" aria-selected={i === highlight}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                          i === highlight ? "bg-slate-100 text-slate-900" : "text-slate-800 hover:bg-slate-50"
                        }`}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => go(item.href)}
                      >
                        <Icon name={item.iconName} size="sm" />
                        <span className="font-medium">{item.label}</span>
                        <span className="ml-auto truncate font-mono text-xs text-slate-400">{item.href}</span>
                      </button>
                    </li>
                  );
                })}
              </Fragment>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
