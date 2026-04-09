"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BellissimaEntityActionMenu } from "@/components/backoffice/BellissimaEntityActionMenu";
import { backofficeEntityActionPrimaryClass } from "@/components/backoffice/backofficeEntityActionStyles";
import { Icon } from "@/components/ui/Icon";
import { workspaceActionLabel } from "@/lib/cms/backofficeWorkspaceContextModel";
import { getBackofficeSectionById } from "@/lib/cms/backofficeExtensionRegistry";
import { useSectionWorkspaceRegistration } from "./ContentWorkspaceHost";

const BASE = "/backoffice/content";

type PageRow = { id: string; title: string | null; slug: string | null; status: string | null; updated_at?: string | null };

/**
 * U31 — Content-first landing: tre er primær navigasjon; vekst er sekundær workspace.
 */
export default function ContentSectionLanding() {
  const router = useRouter();
  const registerSectionWorkspace = useSectionWorkspaceRegistration();
  const [items, setItems] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const section = getBackofficeSectionById("content");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/backoffice/content/pages?limit=12", { credentials: "include" });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { items?: PageRow[] }; message?: string } | null;
        if (!res.ok || json?.ok === false) {
          if (!cancelled) setError(typeof json?.message === "string" ? json.message : `HTTP ${res.status}`);
          return;
        }
        const list = Array.isArray(json?.data?.items) ? json!.data!.items! : [];
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setError("Kunne ikke hente sider");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const publishedCount = useMemo(
    () => items.filter((item) => (item.status ?? "").trim().toLowerCase() === "published").length,
    [items]
  );
  const draftCount = useMemo(() => Math.max(items.length - publishedCount, 0), [items.length, publishedCount]);

  const onCreatePage = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/backoffice/content/pages", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Ny side",
          tree_root_key: "overlays",
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        data?: { page?: { id?: string } };
      } | null;
      const pageId = typeof json?.data?.page?.id === "string" ? json.data.page.id.trim() : "";
      if (!res.ok || json?.ok === false || !pageId) {
        setCreateError(typeof json?.message === "string" ? json.message : "Kunne ikke opprette side.");
        return;
      }
      router.push(`${BASE}/${encodeURIComponent(pageId)}`);
    } catch {
      setCreateError("Kunne ikke opprette side.");
    } finally {
      setCreating(false);
    }
  }, [creating, router]);

  const sectionRegistration = useMemo(
    () =>
      ({
        key: "content-overview",
        snapshotInput: {
          viewId: "overview",
          title: "Innhold",
          subtitle:
            "Tree-first landing for opprettelse, arbeidskø og trygg routing videre inn i detalj-workspaces.",
          primaryActionIds: ["create"],
          secondaryActionIds: ["settings"],
          actionAvailability: { create: !creating, settings: true },
        },
        actionHandlers: {
          create: () => void onCreatePage(),
        },
      }) as const,
    [creating, onCreatePage]
  );

  useEffect(() => {
    registerSectionWorkspace?.(sectionRegistration);
    return () => {
      registerSectionWorkspace?.(null);
    };
  }, [registerSectionWorkspace, sectionRegistration]);

  return (
    <div className="min-h-0 space-y-6 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">CMS · innhold</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-[rgb(var(--lp-text))] md:text-3xl">Innhold</h1>
          <p className="text-sm leading-relaxed text-[rgb(var(--lp-muted))]">
            {section.description} Velg side i treet til venstre for å redigere. Denne flaten er kontrollpunktet for opprettelse,
            oversikt og trygg ruting videre.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <button
            type="button"
            onClick={() => void onCreatePage()}
            disabled={creating}
            className="min-h-11 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Oppretter…" : workspaceActionLabel("create")}
          </button>
          <p className="text-xs text-[rgb(var(--lp-muted))]">Ny side opprettes under App overlays til du flytter den i treet.</p>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Seksjonssignaler">
        <article className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">Primary navigation</p>
          <p className="mt-3 text-lg font-semibold text-[rgb(var(--lp-text))]">Tree først</p>
          <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--lp-muted))]">
            Sider velges og flyttes i treet. Landingflaten er oversikt, ikke en alternativ editor.
          </p>
        </article>
        <article className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">Publisert</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[rgb(var(--lp-text))]">{publishedCount}</p>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Av de siste {items.length || 12} sidene som API-et returnerer.</p>
        </article>
        <article className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--lp-muted))]">Kladd</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[rgb(var(--lp-text))]">{draftCount}</p>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Kladd ligger i samme publiseringsflyt som editor, historikk og preview.</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Snarveier">
        <Link
          href="/backoffice/media"
          className="lp-motion-card flex min-h-[120px] flex-col justify-between rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 shadow-sm transition hover:border-pink-300/30"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50">
              <Icon name="media" size="sm" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[rgb(var(--lp-text))]">Media</h2>
              <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Bibliotek og opplasting — koblet til blokker.</p>
            </div>
          </div>
          <span className={`mt-4 self-start ${backofficeEntityActionPrimaryClass}`}>Åpne media</span>
        </Link>

        <Link
          href="/backoffice/settings"
          className="lp-motion-card flex min-h-[120px] flex-col justify-between rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 shadow-sm transition hover:border-pink-300/30"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50">
              <Icon name="settings" size="sm" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[rgb(var(--lp-text))]">Innstillinger (CMS)</h2>
              <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Document types, data types, schema — code-governed.</p>
            </div>
          </div>
          <span className={`mt-4 self-start ${backofficeEntityActionPrimaryClass}`}>Åpne innstillinger</span>
        </Link>
      </section>

      <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 shadow-sm" aria-label="Nylige sider">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Siste sider (API)</h2>
          <span className="text-xs text-[rgb(var(--lp-muted))]">Klikk en rad for å åpne redigerer</span>
        </div>
        {createError ? (
          <p className="mt-3 text-sm text-amber-800" role="alert">
            {createError}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-amber-800" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Laster…</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Ingen sider returnert — sjekk treet eller migrasjon.</p>
        ) : null}
        {!loading && items.length > 0 ? (
          <ul className="mt-4 divide-y divide-[rgb(var(--lp-border))]/80">
            {items.map((row) => {
              const publicHref =
                row.status === "published" && row.slug?.trim()
                  ? `/${row.slug.replace(/^\/+/, "")}`
                  : null;
              const actions = [
                {
                  id: "edit" as const,
                  label: workspaceActionLabel("edit"),
                  enabled: true,
                  placement: "entity" as const,
                  href: `${BASE}/${encodeURIComponent(row.id)}`,
                  description: "Åpne detail-workspace for denne siden.",
                },
                {
                  id: "preview" as const,
                  label: workspaceActionLabel("preview"),
                  enabled: true,
                  placement: "entity" as const,
                  href: `/backoffice/preview/${encodeURIComponent(row.id)}`,
                  description: "Åpne workspace-preview for denne siden.",
                },
                ...(publicHref
                  ? [
                      {
                        id: "public_page" as const,
                        label: workspaceActionLabel("public_page"),
                        enabled: true,
                        placement: "entity" as const,
                        href: publicHref,
                        description: "Åpne publisert side i offentlig runtime.",
                      },
                    ]
                  : []),
              ];

              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[rgb(var(--lp-text))]">
                      {row.title?.trim() || row.slug || row.id}
                    </div>
                    <div className="text-xs text-[rgb(var(--lp-muted))]">
                      {row.status === "published" ? "Publisert" : "Kladd"} · {row.slug || "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`${BASE}/${encodeURIComponent(row.id)}`}
                      className={backofficeEntityActionPrimaryClass}
                    >
                      {workspaceActionLabel("edit")}
                    </Link>
                    <BellissimaEntityActionMenu
                      actions={actions}
                      summaryLabel="Handlinger"
                      buttonClassName="min-h-10 px-3 text-sm"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
