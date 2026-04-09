"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LP_CMS_CLIENT_CONTENT_WORKSPACE, LP_CMS_CLIENT_HEADER } from "@/lib/cms/cmsClientHeaders";
import { mergeSeoFieldsIntoVariantBody } from "@/lib/cms/mergeSeoIntoVariantBody";
import type { SeoIntelligenceResult, SeoRecommendation } from "@/lib/seo/intelligence";
import {
  mergeSeoRecommendationsIntoMeta,
  parseSeoRecommendationsFromMeta,
} from "@/lib/seo/intelligence";

type PageListItem = { id: string; title: string; slug: string; status: string; updated_at: string | null };

type PagePayload = {
  id: string;
  title: string;
  slug: string;
  status: string;
  body: unknown;
};

function safeObj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function parseBlocksForIntel(raw: unknown): Array<{ id: string; type: string; data?: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object" && !Array.isArray(b))
    .filter((b) => typeof b.id === "string" && typeof b.type === "string")
    .map((b) => ({
      id: String(b.id),
      type: String(b.type),
      data: b.data != null && typeof b.data === "object" && !Array.isArray(b.data) ? (b.data as Record<string, unknown>) : undefined,
    }));
}

function metaFromBody(body: unknown): Record<string, unknown> | undefined {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return undefined;
  const root = body as Record<string, unknown>;
  if (root.meta != null && typeof root.meta === "object" && !Array.isArray(root.meta)) {
    return root.meta as Record<string, unknown>;
  }
  return undefined;
}

function seoFromMeta(meta: Record<string, unknown> | undefined): { title: string; description: string; canonical: string } {
  const seo = meta && typeof meta.seo === "object" && meta.seo && !Array.isArray(meta.seo) ? (meta.seo as Record<string, unknown>) : {};
  return {
    title: typeof seo.title === "string" ? seo.title : "",
    description: typeof seo.description === "string" ? seo.description : "",
    canonical: typeof seo.canonical === "string" ? seo.canonical : typeof seo.canonicalUrl === "string" ? (seo.canonicalUrl as string) : "",
  };
}

const TOPIC_CLUSTERS: { label: string; q: string }[] = [
  { label: "Lunsj", q: "lunsj" },
  { label: "Kontorlunsj", q: "kontorlunsj" },
  { label: "Lunsjtid", q: "lunsjtid" },
  { label: "Firmalunsj", q: "firmalunsj" },
  { label: "Catering bedrift", q: "catering" },
  { label: "Bedriftslunsj", q: "bedrift" },
];

export default function SeoGrowthRuntimeClient() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PageListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState<PagePayload | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SeoIntelligenceResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftCanonical, setDraftCanonical] = useState("");

  useEffect(() => {
    const qp = searchParams.get("q");
    if (qp) setQ(qp);
  }, [searchParams]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setBanner(null);
    try {
      const url = new URL("/api/backoffice/content/pages", window.location.origin);
      url.searchParams.set("limit", "80");
      if (q.trim()) url.searchParams.set("q", q.trim());
      const res = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; data?: { items?: PageListItem[] } };
      if (!res.ok || !j.ok) {
        setBanner("Kunne ikke hente sider.");
        setItems([]);
        return;
      }
      const list = Array.isArray(j.data?.items) ? j.data!.items! : [];
      setItems(list);
    } catch {
      setBanner("Nettverksfeil ved liste.");
      setItems([]);
    } finally {
      setListLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadPage = useCallback(async (id: string) => {
    setPageLoading(true);
    setBanner(null);
    setAnalysis(null);
    try {
      const res = await fetch(`/api/backoffice/content/pages/${encodeURIComponent(id)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await res.json()) as { ok?: boolean; data?: PagePayload };
      if (!res.ok || !j.ok || !j.data) {
        setBanner("Kunne ikke hente side.");
        setPage(null);
        return;
      }
      const p = j.data;
      setPage({ id: p.id, title: p.title, slug: p.slug, status: p.status, body: p.body });
      const meta = metaFromBody(p.body);
      const seo = seoFromMeta(meta);
      setDraftTitle(seo.title || p.title || "");
      setDraftDescription(seo.description);
      setDraftCanonical(seo.canonical);
    } catch {
      setBanner("Nettverksfeil ved side.");
      setPage(null);
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadPage(selectedId);
  }, [selectedId, loadPage]);

  useEffect(() => {
    if (items.length && !selectedId) {
      setSelectedId(items[0]!.id);
    }
  }, [items, selectedId]);

  const runAnalyze = async () => {
    if (!page) return;
    setAnalyzing(true);
    setBanner(null);
    try {
      const meta = metaFromBody(page.body);
      const blocks = parseBlocksForIntel(
        page.body && typeof page.body === "object" && !Array.isArray(page.body)
          ? (page.body as Record<string, unknown>).blocks
          : undefined,
      );
      const res = await fetch("/api/backoffice/ai/seo-intelligence", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks,
          meta: meta ?? {},
          pageTitle: page.title,
          pageId: page.id,
          locale: "nb",
          goal: "lead",
          brand: "Lunchportalen",
        }),
      });
      const j = (await res.json()) as { ok?: boolean; data?: SeoIntelligenceResult; message?: string };
      if (!res.ok || !j.ok || !j.data) {
        setBanner(j.message ?? "SEO-analyse feilet.");
        setAnalysis(null);
        return;
      }
      setAnalysis(j.data);
    } catch {
      setBanner("Nettverksfeil ved analyse.");
      setAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const applySuggestion = (s: SeoRecommendation) => {
    if (s.metaField === "seo.title") {
      setDraftTitle(s.suggested);
      return;
    }
    if (s.metaField === "seo.description") {
      setDraftDescription(s.suggested);
      return;
    }
    setBanner("Dette forslaget krever manuell redigering i innhold (ingen auto-felt).");
  };

  const saveSeo = async () => {
    if (!page) return;
    setSaving(true);
    setBanner(null);
    try {
      let nextBody = mergeSeoFieldsIntoVariantBody(page.body, {
        title: draftTitle,
        description: draftDescription,
        canonical: draftCanonical.trim() || undefined,
      });
      if (analysis) {
        const m = safeObj(nextBody.meta);
        const existing = parseSeoRecommendationsFromMeta(m);
        nextBody = { ...nextBody, meta: mergeSeoRecommendationsIntoMeta(m, analysis, existing) };
      }

      const res = await fetch(`/api/backoffice/content/pages/${encodeURIComponent(page.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          [LP_CMS_CLIENT_HEADER]: LP_CMS_CLIENT_CONTENT_WORKSPACE,
        },
        body: JSON.stringify({
          body: nextBody,
          locale: "nb",
          environment: "prod",
        }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !j.ok) {
        setBanner(j.message ?? "Lagring feilet.");
        return;
      }
      setBanner("SEO-felt lagret på variant (utkast). Publiser via eksisterende innholdsflyt når klart.");
      await loadPage(page.id);
    } catch {
      setBanner("Nettverksfeil ved lagring.");
    } finally {
      setSaving(false);
    }
  };

  const scoreColor = useMemo(() => {
    const sc = analysis?.score ?? 0;
    if (sc >= 75) return "text-emerald-700";
    if (sc >= 50) return "text-amber-800";
    return "text-red-800";
  }, [analysis?.score]);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-16 pt-4">
      {banner ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2 text-sm text-amber-950" role="status">
          {banner}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 p-4 shadow-sm">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          Tematiske klynger (Lunchportalen)
        </h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Hurtigsøk i sider — innholdsplan og utkast skjer med menneskelig review.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOPIC_CLUSTERS.map((t) => (
            <button
              key={t.q}
              type="button"
              className="inline-flex min-h-[40px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium text-[rgb(var(--lp-fg))] hover:bg-neutral-50"
              onClick={() => {
                setQ(t.q);
                setSelectedId(null);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="min-h-[44px] flex-1 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm"
          placeholder="Søk i titler og slug…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void loadList();
          }}
        />
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--lp-hotpink)] bg-[var(--lp-hotpink)]/10 px-5 text-sm font-medium text-[rgb(var(--lp-fg))] shadow-sm"
          onClick={() => void loadList()}
        >
          Oppdater liste
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 p-4 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Sider</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{listLoading ? "Laster…" : `${items.length} treff`}</p>
          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
            {items.map((it) => {
              const active = it.id === selectedId;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setSelectedId(it.id)}
                  className={`flex w-full flex-col items-start rounded-xl border px-3 py-2 text-left text-sm ${
                    active ? "border-[var(--lp-hotpink)] bg-[var(--lp-hotpink)]/5" : "border-[rgb(var(--lp-border))] bg-white"
                  }`}
                >
                  <span className="font-medium text-[rgb(var(--lp-fg))] line-clamp-2">{it.title || "(uten tittel)"}</span>
                  <span className="text-xs text-[rgb(var(--lp-muted))]">/{it.slug}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          {!page || pageLoading ? (
            <p className="text-sm text-[rgb(var(--lp-muted))]">{pageLoading ? "Laster side…" : "Velg en side."}</p>
          ) : (
            <>
              <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Side</h2>
                  <Link
                    href={`/backoffice/content/${page.id}`}
                    className="text-sm font-medium text-[rgb(var(--lp-fg))] underline-offset-4 hover:underline"
                  >
                    Åpne i innholdsredigerer
                  </Link>
                </div>
                <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                  Status: <strong>{page.status}</strong> — publisering skjer via godkjent variant og eksisterende publish-flyt.
                </p>
                <div className="mt-4 grid gap-3">
                  <label className="block text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">
                    SEO-tittel (utkast)
                    <input
                      className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">
                    Meta-beskrivelse
                    <textarea
                      className="mt-1 min-h-[100px] w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">
                    Canonical (valgfritt)
                    <input
                      className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
                      value={draftCanonical}
                      onChange={(e) => setDraftCanonical(e.target.value)}
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={analyzing}
                    onClick={() => void runAnalyze()}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--lp-hotpink)] bg-[var(--lp-hotpink)]/10 px-4 text-sm font-medium"
                  >
                    {analyzing ? "Analyserer…" : "Analyser side"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveSeo()}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium shadow-sm"
                  >
                    {saving ? "Lagrer…" : "Lagre SEO til variant"}
                  </button>
                </div>
              </div>

              {analysis ? (
                <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h3 className="font-heading text-base font-semibold text-[rgb(var(--lp-fg))]">Innsikt</h3>
                    <span className={`font-heading text-2xl font-semibold tabular-nums ${scoreColor}`}>{analysis.score}</span>
                    <span className="text-xs text-[rgb(var(--lp-muted))]">/ 100</span>
                  </div>
                  <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{analysis.message}</p>
                  {analysis.breakdown ? (
                    <ul className="mt-3 list-inside list-disc text-xs text-[rgb(var(--lp-muted))]">
                      {Object.entries(analysis.breakdown).map(([k, v]) => (
                        <li key={k}>
                          {k}: {typeof v === "number" ? v : String(v)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <h4 className="mt-4 font-heading text-sm font-semibold text-[rgb(var(--lp-fg))]">Forslag (manuell «Bruk»)</h4>
                  <ul className="mt-2 space-y-3">
                    {analysis.suggestions.map((s) => (
                      <li key={s.id} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3 text-sm">
                        <div className="font-medium text-[rgb(var(--lp-fg))]">{s.label}</div>
                        <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{s.explanation}</div>
                        <div className="mt-2 text-xs">
                          <span className="text-[rgb(var(--lp-muted))]">Før:</span> {s.before.slice(0, 200)}
                        </div>
                        <div className="mt-1 text-xs">
                          <span className="text-[rgb(var(--lp-muted))]">Forslag:</span> {s.suggested.slice(0, 400)}
                        </div>
                        <button
                          type="button"
                          className="mt-2 text-xs font-medium text-[rgb(var(--lp-fg))] underline"
                          onClick={() => applySuggestion(s)}
                        >
                          Bruk forslag i felt over
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
