"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import { DsButton } from "@/components/ui/ds";

export type HeaderVariantId = "public" | "company-admin" | "superadmin" | "employee" | "kitchen" | "driver";

export type ContentWorkspaceGlobalHeaderShellProps = {
  exitGlobalSubView: () => void;
  headerVariant: HeaderVariantId | null;
  setHeaderVariant: Dispatch<SetStateAction<HeaderVariantId | null>>;
  headerEditConfig: {
    title: string;
    nav: Array<{ label: string; href: string; exact?: boolean }>;
  } | null;
  setHeaderEditConfig: Dispatch<
    SetStateAction<{ title: string; nav: Array<{ label: string; href: string; exact?: boolean }> } | null>
  >;
  headerEditLoading: boolean;
  setHeaderEditLoading: Dispatch<SetStateAction<boolean>>;
  headerEditError: string | null;
  setHeaderEditError: Dispatch<SetStateAction<string | null>>;
  headerEditSaving: boolean;
  setHeaderEditSaving: Dispatch<SetStateAction<boolean>>;
};

/**
 * Global workspace » Header: headervarianter, redigering og PATCH mot header-config (samme flyt som i parent).
 * Props-only; GET header-config flyttet hit fra `ContentWorkspace.tsx` (FASE 32).
 */
export function ContentWorkspaceGlobalHeaderShell({
  exitGlobalSubView,
  headerVariant,
  setHeaderVariant,
  headerEditConfig,
  setHeaderEditConfig,
  headerEditLoading,
  setHeaderEditLoading,
  headerEditError,
  setHeaderEditError,
  headerEditSaving,
  setHeaderEditSaving,
}: ContentWorkspaceGlobalHeaderShellProps) {
  useEffect(() => {
    if (!headerVariant) return;
    let cancelled = false;
    setHeaderEditLoading(true);
    setHeaderEditError(null);
    fetch(`/api/backoffice/content/header-config/${encodeURIComponent(headerVariant)}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Fant ikke konfigurasjon" : `Feil ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled || !json?.ok || !json?.data) return;
        const d = json.data;
        setHeaderEditConfig({
          title: typeof d.title === "string" ? d.title : "",
          nav: Array.isArray(d.nav)
            ? d.nav.map((x: { label?: string; href?: string; exact?: boolean }) => ({
              label: typeof x?.label === "string" ? x.label : "",
              href: typeof x?.href === "string" ? x.href : "",
              exact: x?.exact === true,
            }))
            : [],
        });
      })
      .catch((err) => {
        if (!cancelled) setHeaderEditError(err instanceof Error ? err.message : "Kunne ikke laste");
      })
      .finally(() => {
        if (!cancelled) setHeaderEditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [headerVariant, setHeaderEditConfig, setHeaderEditError, setHeaderEditLoading]);

  const headerVariants = [
    { id: "public" as const, title: "Offentlig header", desc: "Forside og markedsføringssider (ikke innlogget). Logo, Hjem, Ukeplan m.m. Tabs styres i HeaderShell ved manglende rolle.", headerTitle: "Lunsjportalen", tabs: [{ label: "Hjem", href: "/home" }, { label: "Ukeplan", href: "/week" }] },
    { id: "company-admin" as const, title: "Firma admin header", desc: "Bedriftsadministrator. Faner: Dashboard, Firma, Avtale, Locations, Ansatte, Meny, Innsikt, Historikk, ESG.", headerTitle: "Admin", tabs: [{ label: "Dashboard", href: "/admin", exact: true }, { label: "Firma", href: "/admin/companies" }, { label: "Avtale", href: "/admin/agreement" }, { label: "Locations", href: "/admin/locations" }, { label: "Ansatte", href: "/admin/employees" }, { label: "Meny", href: "/admin/menus" }, { label: "Innsikt", href: "/admin/insights" }, { label: "Historikk", href: "/admin/history" }, { label: "ESG", href: "/admin/baerekraft" }] },
    { id: "superadmin" as const, title: "Superadmin header", desc: "Systemadministrasjon. Faner: Kontrollsenter, CFO, Konsern, Firma, ESG, Systemhelse, Revisjon.", headerTitle: "Superadmin", tabs: [{ label: "Kontrollsenter", href: "/superadmin", exact: true }, { label: "CFO", href: "/superadmin/cfo" }, { label: "Konsern", href: "/superadmin/enterprise" }, { label: "Firma", href: "/superadmin/companies" }, { label: "ESG", href: "/superadmin/esg" }, { label: "Systemhelse", href: "/superadmin/system" }, { label: "Revisjon", href: "/superadmin/audit" }] },
    { id: "employee" as const, title: "Employee / ansatt header", desc: "Ansattportalen. Én flate: Ukeplan (bestilling i samme visning).", headerTitle: "Min lunsjordning", tabs: [{ label: "Ukeplan", href: "/week" }] },
    { id: "kitchen" as const, title: "Kjøkkenheader", desc: "Kjøkken/produksjon. Faner: Produksjon i dag, Rapporter.", headerTitle: "Kjøkken", tabs: [{ label: "Produksjon i dag", href: "/kitchen" }, { label: "Rapporter", href: "/kitchen/report" }] },
    { id: "driver" as const, title: "Driver header", desc: "Sjåfør/levering. Faner: Ruter i dag.", headerTitle: "Sjåfør", tabs: [{ label: "Ruter i dag", href: "/driver" }] },
  ];
  const selectedVariant = headerVariant ? headerVariants.find((v) => v.id === headerVariant) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (headerVariant ? setHeaderVariant(null) : exitGlobalSubView())}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label={headerVariant ? "Tilbake til Headervarianter" : "Tilbake til Global"}
        >
          –
        </button>
        <h1 className="text-2xl font-semibold text-[rgb(var(--lp-text))]">
          {selectedVariant ? selectedVariant.title : "Header"}
        </h1>
      </div>
      {selectedVariant ? (
        <div className="space-y-6">
          <p className="text-sm text-[rgb(var(--lp-muted))]">{selectedVariant.desc}</p>

          {headerEditLoading ? (
            <p className="text-sm text-[rgb(var(--lp-muted))]">Laster …</p>
          ) : headerEditError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{headerEditError}</p>
              <button
                type="button"
                onClick={() => setHeaderVariant(null)}
                className="mt-2 text-sm font-medium text-red-700 underline"
              >
                Tilbake og prøv igjen
              </button>
            </div>
          ) : headerEditConfig ? (
            <>
              <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Tittel i header</p>
                <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Vises ved siden av logo (område-label).</p>
                <input
                  type="text"
                  value={headerEditConfig.title}
                  onChange={(e) => setHeaderEditConfig((c) => (c ? { ...c, title: e.target.value } : c))}
                  className="mt-2 h-10 w-full max-w-md rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm text-[rgb(var(--lp-text))]"
                  aria-label="Tittel i header"
                />
              </div>

              <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Faner i toppnav</p>
                <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Legg til, fjern eller endre rekkefølge. Lagre nederst.</p>
                <ul className="mt-3 space-y-2" role="list">
                  {headerEditConfig.nav.map((tab, idx) => (
                    <li key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-2">
                      <input
                        type="text"
                        value={tab.label}
                        onChange={(e) =>
                          setHeaderEditConfig((c) =>
                            c
                              ? {
                                ...c,
                                nav: c.nav.map((t, i) => (i === idx ? { ...t, label: e.target.value } : t)),
                              }
                              : c
                          )
                        }
                        placeholder="Tekst på fanen"
                        className="min-h-[44px] flex-1 min-w-[120px] rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                        aria-label={`Fane ${idx + 1} tekst`}
                      />
                      <input
                        type="text"
                        value={tab.href}
                        onChange={(e) =>
                          setHeaderEditConfig((c) =>
                            c
                              ? {
                                ...c,
                                nav: c.nav.map((t, i) => (i === idx ? { ...t, href: e.target.value } : t)),
                              }
                              : c
                          )
                        }
                        placeholder="/path"
                        className="min-h-[44px] w-32 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm font-mono"
                        aria-label={`Fane ${idx + 1} lenke`}
                      />
                      <DsButton
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setHeaderEditConfig((c) =>
                            c ? { ...c, nav: c.nav.filter((_, i) => i !== idx) } : c
                          )
                        }
                        className="min-h-[44px] rounded-lg border border-red-200 bg-red-50 px-3 text-sm text-red-700 hover:bg-red-100"
                        aria-label={`Fjern fane ${idx + 1}`}
                      >
                        Fjern
                      </DsButton>
                    </li>
                  ))}
                </ul>
                <DsButton
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setHeaderEditConfig((c) =>
                      c ? { ...c, nav: [...c.nav, { label: "", href: "" }] } : c
                    )
                  }
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center border-dashed border-[rgb(var(--lp-border))] text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
                >
                  + Legg til fane
                </DsButton>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <DsButton
                  type="button"
                  variant="secondary"
                  disabled={headerEditSaving}
                  onClick={async () => {
                    if (!headerVariant || !headerEditConfig) return;
                    setHeaderEditSaving(true);
                    setHeaderEditError(null);
                    try {
                      const res = await fetch(
                        `/api/backoffice/content/header-config/${encodeURIComponent(headerVariant)}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            title: headerEditConfig.title,
                            nav: headerEditConfig.nav.filter((t) => t.label.trim() && t.href.trim()),
                          }),
                        }
                      );
                      const json = await res.json();
                      if (!res.ok || !json?.ok) {
                        setHeaderEditError(json?.message ?? `Feil ${res.status}`);
                        return;
                      }
                      if (json?.data) {
                        setHeaderEditConfig({
                          title: json.data.title ?? headerEditConfig.title,
                          nav: Array.isArray(json.data.nav) ? json.data.nav.map((x: { label?: string; href?: string }) => ({ label: String(x?.label ?? ""), href: String(x?.href ?? "") })) : headerEditConfig.nav,
                        });
                      }
                    } catch (e) {
                      setHeaderEditError(e instanceof Error ? e.message : "Kunne ikke lagre");
                    } finally {
                      setHeaderEditSaving(false);
                    }
                  }}
                  className="min-h-[44px] !border-0 bg-green-600 px-5 text-sm font-medium !text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {headerEditSaving ? "Lagrer …" : "Lagre"}
                </DsButton>
                {headerEditError ? <p className="text-sm text-red-600">{headerEditError}</p> : null}
              </div>

              <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
                <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Innstillinger</p>
                <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                  Endringer lagres i databasen og brukes av HeaderShell på nettstedet.
                </p>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <>
          <p className="text-sm text-[rgb(var(--lp-muted))]">
            Alle headere bruker samme uttrykk (kanonisk HeaderShell). Knappene i toppnav er tilpasset hver rolle.
          </p>
          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-6">
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Logo</p>
            <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
              Logo og merkevare brukes fra /public/brand. Endringer gjøres i kode (AGENTS.md S10–S11).
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Headervarianter</p>
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Klikk på en variant for å se detaljer. Kun faner/knapper i toppnav endres etter rolle.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {headerVariants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setHeaderVariant(v.id)}
                  className="flex min-h-[44px] w-full flex-col items-start rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  aria-label={`Å ${v.title}`}
                >
                  <p className="font-medium text-[rgb(var(--lp-text))]">{v.title}</p>
                  <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="flex items-center justify-between border-t border-[rgb(var(--lp-border))] pt-4">
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Global / Header{selectedVariant ? ` / ${selectedVariant.title}` : ""}
        </p>
      </div>
    </div>
  );
}
