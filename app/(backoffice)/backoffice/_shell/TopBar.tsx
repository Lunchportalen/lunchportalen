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

  const navItemClass = (isActive: boolean) =>
    `lp-motion-btn lp-link relative min-h-10 shrink-0 gap-2 px-3 py-2 text-sm ${
      isActive
        ? "border-[rgb(var(--lp-gold))]/45 bg-[rgb(var(--lp-gold-soft))]/70 text-[rgb(var(--lp-text))] shadow-sm"
        : "text-[rgb(var(--lp-muted))]"
    }`;

  /** Content page editor: én kompakt rad — seksjon + moduler. Ingen dashboard-shelf. */
  if (isContentDetailEditor) {
    return (
      <header className="lp-topbar lp-motion-card flex shrink-0 flex-col border-b border-[rgb(var(--lp-border))]/70 bg-[rgba(var(--lp-surface-rgb),0.9)] text-[rgb(var(--lp-text))]">
        <div className="lp-container-wide flex flex-wrap items-center gap-x-2 gap-y-2 py-2">
          <label htmlFor="bo-section" className="sr-only">
            Seksjon
          </label>
          <select
            id="bo-section"
            value={activeGroup}
            onChange={(e) => setActiveGroup(e.target.value as BackofficeNavGroupId)}
            className="lp-input min-h-10 shrink-0 px-3 py-1.5 text-sm font-semibold sm:min-w-[11rem]"
            aria-label="Velg backoffice-seksjon"
          >
            {BACKOFFICE_SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
          <span className="lp-muted hidden min-w-0 max-w-[10rem] truncate text-xs sm:inline" title={activeModuleLabel}>
            {activeModuleLabel}
          </span>
          <nav
            className="flex min-h-0 flex-1 flex-wrap items-center gap-1"
            aria-label={`Backoffice-moduler — ${activeSection.label}`}
          >
            {sectionEntry ? (
              <Link
                href={sectionEntry.href}
                className={navItemClass(isBackofficeNavActive(sectionEntry.href, pathname))}
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
                  className={navItemClass(isActive)}
                >
                  <Icon name={tab.iconName} size="sm" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {isActive ? (
                    <span
                      className="lp-motion-btn absolute bottom-1 left-3 right-3 h-0.5 rounded-full bg-[rgb(var(--lp-gold))]"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              );
            })}
            {overflowModules.length > 0 ? (
              <details className="group relative">
                <summary className="lp-link lp-motion-btn flex min-h-10 list-none cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  Flere
                  <Icon name="chevronDown" size="sm" />
                </summary>
                <div className="lp-card absolute left-0 top-full z-40 mt-2 flex min-w-[14rem] flex-col p-1">
                  {overflowModules.map((tab) => {
                    const isActive = isBackofficeNavActive(tab.href, pathname);
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                          isActive
                            ? "bg-[rgb(var(--lp-gold-soft))] text-[rgb(var(--lp-text))]"
                            : "text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-surface-alt))]"
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
    <header className="lp-topbar lp-motion-card flex shrink-0 flex-col border-b border-[rgb(var(--lp-border))]/70 bg-[rgba(var(--lp-surface-rgb),0.9)] text-[rgb(var(--lp-text))]">
      <div className="lp-container-wide py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <label htmlFor="bo-section" className="sr-only">
                  Seksjon
                </label>
                <select
                  id="bo-section"
                  value={activeGroup}
                  onChange={(e) => setActiveGroup(e.target.value as BackofficeNavGroupId)}
                  className="lp-input min-h-11 shrink-0 px-3 py-2 text-sm font-semibold sm:min-w-[15rem]"
                  aria-label="Velg backoffice-seksjon"
                >
                  {BACKOFFICE_SECTIONS.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.label}
                    </option>
                  ))}
                </select>
                <div className="min-w-0">
                  <p className="truncate text-base font-black tracking-tight text-[rgb(var(--lp-text))]">
                    {activeSection.label}
                  </p>
                  <p className="lp-muted truncate text-xs">Aktiv flate: {activeModuleLabel}</p>
                </div>
              </div>
              <p className="lp-muted max-w-3xl text-sm leading-relaxed">{activeSection.description}</p>
            </div>
          </div>
          <div className="lp-actions xl:justify-end">
            <span className="lp-chip lp-chip-neutral">{activeSection.plane === "management" ? "Styring" : "Leveranse"}</span>
            <span className="lp-chip lp-chip-neutral">{localModules.length} arbeidsflater</span>
            <span className="lp-chip lp-chip-ok">Live</span>
          </div>
        </div>

        <div className="mt-4 border-t border-[rgb(var(--lp-border))]/65 pt-3">
          <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-1.5">
            {sectionEntry ? (
              <Link
                href={sectionEntry.href}
                className={navItemClass(isBackofficeNavActive(sectionEntry.href, pathname))}
              >
                <Icon name={sectionEntry.iconName} size="sm" />
                <span className="whitespace-nowrap">{activeSection.label}</span>
              </Link>
            ) : null}
            <nav
              className="flex min-h-12 shrink-0 flex-wrap items-center gap-1.5"
              aria-label={`Backoffice-moduler — ${activeSection.label}`}
            >
            {visibleModules.map((tab) => {
              const isActive = isBackofficeNavActive(tab.href, pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={navItemClass(isActive)}
                >
                  <Icon name={tab.iconName} size="sm" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {isActive ? (
                    <span
                      className="lp-motion-btn absolute bottom-1.5 left-3 right-3 h-[2px] rounded-full bg-[rgb(var(--lp-gold))]"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              );
            })}
            {overflowModules.length > 0 ? (
              <details className="group relative">
                <summary className="lp-link lp-motion-btn flex min-h-10 list-none cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  Flere
                  <Icon name="chevronDown" size="sm" />
                </summary>
                <div className="lp-card absolute left-0 top-full z-40 mt-2 flex min-w-[14rem] flex-col p-1">
                  {overflowModules.map((tab) => {
                    const isActive = isBackofficeNavActive(tab.href, pathname);
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                          isActive
                            ? "bg-[rgb(var(--lp-gold-soft))] text-[rgb(var(--lp-text))]"
                            : "text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-surface-alt))]"
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
      </div>
    </header>
  );
}
