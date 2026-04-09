"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { BackofficeWorkspaceViewTabs } from "@/components/backoffice/BackofficeWorkspaceViewTabs";
import {
  BACKOFFICE_SETTINGS_BASE_PATH,
  BACKOFFICE_SETTINGS_COLLECTIONS,
  BACKOFFICE_SETTINGS_WORKSPACE_VIEWS,
  getBackofficeSettingsCollectionsByGroup,
  getBackofficeSectionById,
} from "@/lib/cms/backofficeExtensionRegistry";
import {
  backofficeSettingsFlowLabel,
  backofficeSettingsHonestyLabel,
  backofficeSettingsKindLabel,
  backofficeSettingsObjectClassLabel,
} from "@/lib/cms/backofficeSettingsWorkspaceModel";

function navActive(pathname: string, href: string, exact?: boolean): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  const h = href.replace(/\/+$/, "") || "/";
  if (exact) return p === h;
  return p === h || p.startsWith(`${h}/`);
}

/**
 * U29 — Settings som førsteordens seksjon: sidenav (section → workspaces) i stedet for bare hub-kort.
 * U29R — Bredere sidenav, kanonisk base-path fra registry.
 * U30R — Bredere sidenav, tydeligere seksjonsflate.
 * U31 — Workspace view-faner øverst i hovedkolonne (Bellissima content apps).
 */
export function SettingsSectionChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const section = getBackofficeSectionById("settings");
  const navGroups = getBackofficeSettingsCollectionsByGroup();
  const activeCollection = useMemo(() => {
    const normalized = pathname.replace(/\/+$/, "") || "/";
    const sorted = [...BACKOFFICE_SETTINGS_COLLECTIONS].sort((a, b) => b.href.length - a.href.length);
    return sorted.find((item) => {
      const href = item.href.replace(/\/+$/, "") || "/";
      if (item.exact) return normalized === href;
      return normalized === href || normalized.startsWith(`${href}/`);
    }) ?? BACKOFFICE_SETTINGS_COLLECTIONS[0];
  }, [pathname]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50/80 lg:flex-row">
      <aside className="shrink-0 border-b border-slate-200 bg-white shadow-sm lg:w-72 lg:border-b-0 lg:border-r">
        <div className="sticky top-0 p-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">CMS-innstillinger</h2>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Seksjon</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{section.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <Link
              href={BACKOFFICE_SETTINGS_BASE_PATH}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50"
            >
              Seksjonsflate
            </Link>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              {activeCollection.groupLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              {backofficeSettingsHonestyLabel(activeCollection.honesty)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              {backofficeSettingsObjectClassLabel(activeCollection.objectClass)}
            </span>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Aktiv collection / workspace</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{activeCollection.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{activeCollection.description}</p>
            <p className="mt-2 text-[11px] text-slate-500">
              {activeCollection.honesty === "code_governed"
                ? "Kode-styrt sannhet"
                : activeCollection.honesty === "runtime_managed"
                  ? "Runtime-styrt + persisted management"
                  : activeCollection.id === "governance-insights"
                    ? "Runtime-read + eksplisitt batch-handling"
                    : "Runtime-lest / observasjon"}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Objekt: {backofficeSettingsObjectClassLabel(activeCollection.objectClass)} · Flyt:{" "}
              {backofficeSettingsFlowLabel(activeCollection.flowKind)}
            </p>
          </div>
          <nav className="mt-3 flex flex-col gap-4" aria-label="Innstillinger — underseksjoner">
            {navGroups.map((g) => (
              <div key={g.groupLabel}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.groupLabel}</p>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {g.items.map((item) => {
                    const active = navActive(pathname, item.href, item.exact);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-md border-l-[3px] py-2 pl-3 pr-2 text-sm font-medium transition ${
                          active
                            ? "border-pink-500 bg-slate-100 text-slate-900"
                            : "border-transparent text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="block">{item.label}</span>
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                          {backofficeSettingsKindLabel(item.kind)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <p className="mt-4 text-[11px] leading-snug text-slate-500">
            Lesemodus fra kode der det er sannheten. Mutasjoner vises bare i arbeidsflater som sier det eksplisitt.
          </p>
        </div>
      </aside>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm lg:px-8">
          <div className="space-y-3">
            <BackofficeWorkspaceViewTabs
              items={BACKOFFICE_SETTINGS_WORKSPACE_VIEWS}
              pathname={pathname}
              ariaLabel="Innstillinger — arbeidsflater"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium">
                {backofficeSettingsKindLabel(activeCollection.kind)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium">
                {backofficeSettingsObjectClassLabel(activeCollection.objectClass)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium">
                {backofficeSettingsFlowLabel(activeCollection.flowKind)}
              </span>
              <span>{activeCollection.description}</span>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
