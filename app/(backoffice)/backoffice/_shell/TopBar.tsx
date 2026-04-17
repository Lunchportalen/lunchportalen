"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BACKOFFICE_NAV_ITEMS,
  BACKOFFICE_SECTIONS,
  BACKOFFICE_SETTINGS_BASE_PATH,
  BACKOFFICE_TOPBAR_MODULE_OVERFLOW,
  findBackofficeExtensionForPathname,
  getBackofficeSectionById,
  isBackofficeNavActive,
  type BackofficeNavGroupId,
} from "@/lib/cms/backofficeExtensionRegistry";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
import { Icon } from "@/components/ui/Icon";

/**
 * U29 — Seksjonsdrevet navigasjon: først velges kontekst (section), deretter modul innen seksjon.
 * U29R — Seksjon som én `<select>` (én kontroll, ikke fem tette piller) + modulrad med tydeligere mål.
 */
export default function TopBar() {
  const pathname = usePathname() ?? "";
  const ext = findBackofficeExtensionForPathname(pathname);

  const groupFromPath = useMemo((): BackofficeNavGroupId => {
    if (ext?.sectionId) return ext.sectionId;
    if (pathname.startsWith(BACKOFFICE_SETTINGS_BASE_PATH)) return "settings";
    return "content";
  }, [ext?.sectionId, pathname]);

  const [activeGroup, setActiveGroup] = useState<BackofficeNavGroupId>(groupFromPath);

  useEffect(() => {
    setActiveGroup(groupFromPath);
  }, [groupFromPath]);

  const activeSection = useMemo(() => getBackofficeSectionById(activeGroup), [activeGroup]);

  const itemsInGroup = useMemo(
    () => BACKOFFICE_NAV_ITEMS.filter((t) => t.groupId === activeGroup),
    [activeGroup]
  );
  const sectionEntry = useMemo(
    () => itemsInGroup.find((item) => item.href === activeSection.primaryHref) ?? null,
    [activeSection.primaryHref, itemsInGroup]
  );
  const localModules = useMemo(
    () => itemsInGroup.filter((item) => item.href !== activeSection.primaryHref),
    [activeSection.primaryHref, itemsInGroup]
  );

  const visibleModules = useMemo(
    () => localModules.slice(0, BACKOFFICE_TOPBAR_MODULE_OVERFLOW),
    [localModules]
  );
  const overflowModules = useMemo(
    () => localModules.slice(BACKOFFICE_TOPBAR_MODULE_OVERFLOW),
    [localModules]
  );
  const activeModuleLabel = ext?.label ?? activeSection.label;

  const contentRoute = resolveBackofficeContentRoute(pathname);
  const isContentDetailEditor = contentRoute.kind === "detail";

  /** Content page editor: én kompakt rad — seksjon + moduler. Ingen dashboard-shelf. */
  if (isContentDetailEditor) {
    return (
      <header className="lp-motion-card flex shrink-0 flex-col border-b border-white/10 bg-[rgb(var(--lp-chrome-bg))]/92 text-white backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:px-4">
          <label htmlFor="bo-section" className="sr-only">
            Seksjon
          </label>
          <select
            id="bo-section"
            value={activeGroup}
            onChange={(e) => setActiveGroup(e.target.value as BackofficeNavGroupId)}
            className="min-h-10 shrink-0 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:min-w-[11rem]"
            aria-label="Velg backoffice-seksjon"
          >
            {BACKOFFICE_SECTIONS.map((section) => (
              <option key={section.id} value={section.id} className="bg-slate-900 text-white">
                {section.label}
              </option>
            ))}
          </select>
          <span className="hidden min-w-0 max-w-[10rem] truncate text-xs text-white/65 sm:inline" title={activeModuleLabel}>
            {activeModuleLabel}
          </span>
          <nav
            className="flex min-h-0 flex-1 flex-wrap items-center gap-1"
            aria-label={`Backoffice-moduler — ${activeSection.label}`}
          >
            {sectionEntry ? (
              <Link
                href={sectionEntry.href}
                className={`lp-motion-btn relative flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-semibold text-white/95 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                  isBackofficeNavActive(sectionEntry.href, pathname)
                    ? "border-white/30 bg-white/12"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <Icon name={sectionEntry.iconName} size="sm" />
                <span className="whitespace-nowrap">{activeSection.label}</span>
              </Link>
            ) : null}
            {visibleModules.map((tab) => {
              const isActive = isBackofficeNavActive(tab.href, pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`lp-motion-btn relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                    isActive ? "bg-white/12 text-white" : ""
                  }`}
                >
                  <Icon name={tab.iconName} size="sm" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {isActive ? (
                    <span
                      className="lp-motion-btn absolute bottom-1 left-2 right-2 h-0.5 rounded-full bg-[var(--lp-hotpink)]"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              );
            })}
            {overflowModules.length > 0 ? (
              <details className="group relative">
                <summary className="lp-motion-btn flex list-none cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-white/90 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
                  Flere
                  <Icon name="chevronDown" size="sm" />
                </summary>
                <div className="absolute left-0 top-full z-40 mt-1 flex min-w-[14rem] flex-col rounded-xl border border-white/10 bg-slate-900/98 p-1 shadow-xl backdrop-blur-md">
                  {overflowModules.map((tab) => {
                    const isActive = isBackofficeNavActive(tab.href, pathname);
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                          isActive ? "bg-white/15 text-white" : "text-white/90 hover:bg-white/10"
                        }`}
                      >
                        <Icon name={tab.iconName} size="sm" />
                        <span className="whitespace-nowrap">{tab.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </details>
            ) : null}
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="lp-motion-card flex shrink-0 flex-col border-b border-white/10 bg-[rgb(var(--lp-chrome-bg))]/92 text-white backdrop-blur-md">
      <div className="px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Backoffice
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                {activeSection.plane === "management" ? "Styringsplan" : "Leveranseflate"}
              </span>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <label htmlFor="bo-section" className="sr-only">
                  Seksjon
                </label>
                <select
                  id="bo-section"
                  value={activeGroup}
                  onChange={(e) => setActiveGroup(e.target.value as BackofficeNavGroupId)}
                  className="min-h-11 shrink-0 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white shadow-sm outline-none ring-pink-400/30 focus-visible:ring-2 focus-visible:ring-white/50 sm:min-w-[15rem]"
                  aria-label="Velg backoffice-seksjon"
                >
                  {BACKOFFICE_SECTIONS.map((section) => (
                    <option key={section.id} value={section.id} className="bg-slate-900 text-white">
                      {section.label}
                    </option>
                  ))}
                </select>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">{activeSection.label}</p>
                  <p className="truncate text-xs text-white/65">Aktiv modul: {activeModuleLabel}</p>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-white/72">{activeSection.description}</p>
            </div>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2 xl:min-w-[20rem]">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Arbeidsflater</p>
              <p className="mt-1 text-sm font-semibold text-white">{localModules.length}</p>
              <p className="text-xs text-white/65">Lokale arbeidsflater i valgt seksjon</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Fokus</p>
              <p className="mt-1 text-sm font-semibold text-white">{visibleModules.length}</p>
              <p className="text-xs text-white/65">
                {overflowModules.length > 0
                  ? `${overflowModules.length} ligger under Flere`
                  : "Ingen skjulte moduler akkurat nå"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[20px] border border-white/10 bg-black/10 p-2">
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Seksjon først, arbeidsflater etterpå
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
              {activeSection.label}
            </p>
          </div>
          <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-1.5">
            {sectionEntry ? (
              <Link
                href={sectionEntry.href}
                className={`lp-motion-btn relative flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold text-white/95 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                  isBackofficeNavActive(sectionEntry.href, pathname)
                    ? "border-white/30 bg-white/12 shadow-sm"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <Icon name={sectionEntry.iconName} size="sm" />
                <span className="whitespace-nowrap">{activeSection.label}</span>
              </Link>
            ) : null}
            <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Lokale arbeidsflater
            </span>
          </div>
          <nav
            className="mt-2 flex min-h-12 shrink-0 flex-wrap items-center gap-1.5"
            aria-label={`Backoffice-moduler — ${activeSection.label}`}
          >
            {visibleModules.map((tab) => {
              const isActive = isBackofficeNavActive(tab.href, pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`lp-motion-btn relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                    isActive ? "bg-white/12 text-white shadow-sm" : ""
                  }`}
                >
                  <Icon name={tab.iconName} size="sm" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {isActive ? (
                    <span
                      className="lp-motion-btn absolute bottom-1.5 left-3 right-3 h-[2px] rounded-full bg-[var(--lp-hotpink)]"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              );
            })}
            {overflowModules.length > 0 ? (
              <details className="group relative">
                <summary className="lp-motion-btn flex list-none cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
                  Flere
                  <Icon name="chevronDown" size="sm" />
                </summary>
                <div className="absolute left-0 top-full z-40 mt-1 flex min-w-[14rem] flex-col rounded-xl border border-white/10 bg-slate-900/98 p-1 shadow-xl backdrop-blur-md">
                  {overflowModules.map((tab) => {
                    const isActive = isBackofficeNavActive(tab.href, pathname);
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                          isActive ? "bg-white/15 text-white" : "text-white/90 hover:bg-white/10"
                        }`}
                      >
                        <Icon name={tab.iconName} size="sm" />
                        <span className="whitespace-nowrap">{tab.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </details>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  );
}
