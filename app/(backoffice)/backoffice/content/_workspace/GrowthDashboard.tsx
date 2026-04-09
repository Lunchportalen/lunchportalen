"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { BackofficeCollectionToolbar } from "@/components/backoffice/BackofficeCollectionToolbar";
import { backofficeEntityActionPrimaryClass } from "@/components/backoffice/backofficeEntityActionStyles";
import { applySafeBatchPreview } from "@/lib/ai/batchApply";
import { detectCrossPageInsights, detectOpportunities, opportunityImpact, type Opportunity } from "@/lib/ai/opportunities";
import { getTopOpportunities } from "@/lib/ai/prioritization";
import { logSiteGrowth } from "@/lib/ai/siteGrowthLog";
import { analyzeSite, toSitePageDraft, type SitePageDraft, type SitePageInput } from "@/lib/ai/siteAnalysis";

type ListItem = { id: string; title: string; slug: string; status: string; updated_at: string | null };

function impactEmoji(impact: ReturnType<typeof opportunityImpact>): string {
  if (impact === "high") return "\uD83D\uDD25 ";
  if (impact === "medium") return "\u26A0\uFE0F ";
  return "\u2139\uFE0F ";
}

async function fetchJson<T>(url: string): Promise<{ ok: boolean; data?: T; message?: string }> {
  const res = await fetch(url, { credentials: "include" });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; message?: string } | null;
  if (!res.ok || json?.ok === false) {
    return { ok: false, message: typeof json?.message === "string" ? json.message : `HTTP ${res.status}` };
  }
  return { ok: true, data: json?.data as T };
}

async function fetchPageBody(pageId: string): Promise<SitePageInput | null> {
  const r = await fetchJson<{
    id?: string;
    title?: string;
    body?: unknown;
  }>(`/api/backoffice/content/pages/${encodeURIComponent(pageId)}`);
  if (!r.ok || !r.data?.id) return null;
  return {
    id: String(r.data.id),
    title: typeof r.data.title === "string" ? r.data.title : "",
    body: r.data.body ?? { version: 1, blocks: [] },
  };
}

/**
 * Kontrolltårn: multi-side analyse, muligheter og trygg forhåndsvisning (ingen auto-lagring).
 */
export default function GrowthDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<SitePageDraft[]>([]);
  const [baselineDrafts, setBaselineDrafts] = useState<SitePageDraft[]>([]);
  const [simulationActive, setSimulationActive] = useState(false);
  const [lastBatchLog, setLastBatchLog] = useState<ReturnType<typeof applySafeBatchPreview>["applied"]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [listQuery, setListQuery] = useState("");
  /** U27 — trygg bulk: kun kopiering av editor-lenker (ingen server-mutasjon). */
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(() => new Set());
  const [bulkCopied, setBulkCopied] = useState(false);

  const summaries = useMemo(() => analyzeSite(drafts), [drafts]);
  const opportunities = useMemo(() => detectOpportunities(summaries), [summaries]);
  const cross = useMemo(() => detectCrossPageInsights(summaries), [summaries]);
  const topOps = useMemo(() => getTopOpportunities(opportunities, 8), [opportunities]);

  const filteredSummaries = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(
      (s) => (s.title || "").toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [summaries, listQuery]);

  const toggleSelect = useCallback((id: string, next: boolean) => {
    setSelectedPageIds((prev) => {
      const n = new Set(prev);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedPageIds(new Set(filteredSummaries.map((s) => s.id)));
  }, [filteredSummaries]);

  const clearSelection = useCallback(() => {
    setSelectedPageIds(new Set());
  }, []);

  const copySelectedEditorLinks = useCallback(() => {
    if (typeof window === "undefined" || selectedPageIds.size === 0) return;
    const origin = window.location.origin;
    const lines = [...selectedPageIds].map((id) => `${origin}/backoffice/content/${encodeURIComponent(id)}`);
    void navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setBulkCopied(true);
      window.setTimeout(() => setBulkCopied(false), 2000);
    });
  }, [selectedPageIds]);

  const filteredTopOps = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return topOps;
    return topOps.filter((o) => `${o.pageTitle || ""} ${o.pageId}`.toLowerCase().includes(q));
  }, [topOps, listQuery]);

  const runLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSimulationActive(false);
    setLastBatchLog([]);
    try {
      const list = await fetchJson<{ items?: ListItem[] }>("/api/backoffice/content/pages?limit=120");
      if (!list.ok) {
        setError(list.message ?? "Kunne ikke hente sider");
        setDrafts([]);
        setBaselineDrafts([]);
        return;
      }
      const items = Array.isArray(list.data?.items) ? list.data.items! : [];
      const pages: SitePageInput[] = [];
      const chunk = 5;
      for (let i = 0; i < items.length; i += chunk) {
        const slice = items.slice(i, i + chunk);
        const loaded = await Promise.all(slice.map((it) => fetchPageBody(it.id)));
        for (const p of loaded) {
          if (p) pages.push(p);
        }
      }
      const nextDrafts = pages.map(toSitePageDraft);
      setDrafts(nextDrafts);
      setBaselineDrafts(nextDrafts.map((d) => ({ ...d, blocks: [...d.blocks], meta: { ...d.meta } })));
      setSelectedPageIds(new Set());
      logSiteGrowth({
        kind: "score_snapshot",
        detail: `Lastet ${nextDrafts.length} sider for vekstanalyse`,
      });
    } catch {
      setError("Nettverksfeil ved lasting");
      setDrafts([]);
      setBaselineDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetSimulation = useCallback(() => {
    setDrafts(baselineDrafts.map((d) => ({ ...d, blocks: [...d.blocks], meta: { ...d.meta } })));
    setSimulationActive(false);
    setLastBatchLog([]);
    logSiteGrowth({ kind: "simulation_batch", detail: "Simulering tilbakestilt" });
  }, [baselineDrafts]);

  const applyAllSafePreview = useCallback(() => {
    const { nextDrafts, applied } = applySafeBatchPreview(opportunities, drafts);
    setDrafts(nextDrafts);
    setSimulationActive(true);
    setLastBatchLog(applied);
    setReviewOpen(false);
    logSiteGrowth({
      kind: "simulation_batch",
      detail: `Forhåndsvisning: ${applied.length} trygge CTA-tillegg (ikke lagret)`,
    });
    for (const row of applied) {
      logSiteGrowth({
        kind: "score_snapshot",
        pageId: row.pageId,
        detail: row.action,
        scoreBefore: row.scoreBefore,
        scoreAfter: row.scoreAfter,
      });
    }
  }, [opportunities, drafts]);

  const editorHref = (pageId: string, focusBlockId?: string) => {
    const base = `/backoffice/content/${pageId}`;
    if (focusBlockId) return `${base}?focusBlock=${encodeURIComponent(focusBlockId)}`;
    return base;
  };

  return (
    <div className="min-h-0 space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-[rgb(var(--lp-text))]">Vekst — kontrolltårn</h1>
        <p className="max-w-3xl text-sm text-[rgb(var(--lp-muted))]">
          Systemet viser hvor gevinster ligger (CRO først), uten å lagre eller publisere. Trygge endringer kan simuleres
          lokalt; du eier beslutningen i redigereren.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void runLoad()}
          className="min-h-11 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Laster…" : "Oppdater analyse"}
        </button>
        <button
          type="button"
          disabled={!drafts.length || loading}
          onClick={() => setReviewOpen((v) => !v)}
          className="min-h-11 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 px-4 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50"
        >
          Gå gjennom før forhåndsvisning
        </button>
        <button
          type="button"
          disabled={!drafts.length || loading}
          onClick={applyAllSafePreview}
          className="min-h-11 rounded-xl border border-pink-500/40 bg-pink-50/80 px-4 text-sm font-semibold text-pink-700 underline decoration-pink-400/60 underline-offset-4 hover:bg-pink-50 disabled:opacity-50"
        >
          Bruk alle trygge forbedringer (kun forhåndsvisning)
        </button>
        {simulationActive ? (
          <button
            type="button"
            onClick={resetSimulation}
            className="min-h-11 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50"
          >
            Tilbakestill simulering
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
          {error}
        </div>
      ) : null}

      {simulationActive ? (
        <div className="rounded-xl border border-pink-200/80 bg-pink-50/60 px-3 py-2 text-sm text-[rgb(var(--lp-text))]">
          <span className="font-medium">Forhåndsvisning aktiv:</span> endringene finnes bare her — åpne siden i redigereren
          og lagre manuelt om du vil beholde dem.
        </div>
      ) : null}

      {reviewOpen && drafts.length ? (
        <section className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4" aria-label="Gjennomgang">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Gjennomgang (anbefalt)</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Kun CTA-tillegg klassifiseres som trygge batch-steg. SEO og innhold krever manuell redigering.
          </p>
          <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto text-sm">
            {getTopOpportunities(opportunities.filter((o) => o.intent === "missing_cta"), 20).map((o) => (
              <li key={`${o.pageId}-cta`} className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgb(var(--lp-border))]/60 pb-2">
                <span className="text-[rgb(var(--lp-text))]">{o.pageTitle || o.pageId}</span>
                <Link href={editorHref(o.pageId)} className={backofficeEntityActionPrimaryClass}>
                  Åpne i redigerer
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cross.length > 0 ? (
        <section className="space-y-2" aria-label="Mønstre på tvers av sider">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Innsikt på tvers</h2>
          <ul className="space-y-2">
            {cross.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/40 px-3 py-2 text-sm text-[rgb(var(--lp-text))]"
              >
                <span className="font-medium">
                  {impactEmoji(c.impact)}
                  {c.headline}
                </span>
                <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{c.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BackofficeCollectionToolbar
        ariaLabel="Collection — søk i analyseresultat"
        searchPlaceholder="Søk i sidetitler og IDer…"
        searchValue={listQuery}
        onSearchChange={setListQuery}
        resultHint={`${filteredTopOps.length} toppmuligheter · ${filteredSummaries.length} sider (filtrert)`}
      />

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Toppmuligheter og sider">
        <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Toppmuligheter</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Sortert: CRO → SEO → innhold.</p>
          <ul className="mt-3 space-y-3">
            {filteredTopOps.length === 0 ? (
              <li className="text-sm text-[rgb(var(--lp-muted))]">Ingen data — trykk «Oppdater analyse» eller juster søk.</li>
            ) : (
              filteredTopOps.map((o) => <OpportunityRow key={`${o.pageId}-${o.intent}`} o={o} editorHref={editorHref} />)
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Sider med poengsum</h2>
          <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto text-sm">
            {filteredSummaries.length === 0 ? (
              <li className="text-[rgb(var(--lp-muted))]">Ingen sider lastet.</li>
            ) : (
              filteredSummaries
                .slice()
                .sort((a, b) => a.score - b.score)
                .map((s) => {
                  const checked = selectedPageIds.has(s.id);
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgb(var(--lp-border))]/80 bg-slate-50/80 px-2 py-2"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleSelect(s.id, e.target.checked)}
                            className="h-5 w-5 accent-pink-600"
                            aria-label={`Velg ${s.title || s.id}`}
                          />
                        </label>
                        <div className="min-w-0">
                          <div className="font-medium text-[rgb(var(--lp-text))]">{s.title || s.id}</div>
                          <div className="text-xs text-[rgb(var(--lp-muted))]">
                            Poeng {s.score} · {s.hasCTA ? "Har CTA" : "Mangler CTA"} · ~{s.wordCount} ord
                          </div>
                        </div>
                      </div>
                      <Link href={editorHref(s.id)} className={`shrink-0 ${backofficeEntityActionPrimaryClass}`}>
                        Forbedre
                      </Link>
                    </li>
                  );
                })
            )}
          </ul>
        </div>
      </section>

      {lastBatchLog.length > 0 ? (
        <section className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4 text-sm" aria-label="Siste simulering">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Siste forhåndsvisning</h2>
          <ul className="mt-2 space-y-1 text-xs text-[rgb(var(--lp-muted))]">
            {lastBatchLog.map((r) => (
              <li key={r.pageId}>
                {r.pageId}: score {r.scoreBefore} → {r.scoreAfter} ({r.action})
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-[rgb(var(--lp-muted))]">
        Tips: velg en side i treet til venstre for detaljredigering. Standard innholdsoversikt ligger på{" "}
        <Link className="font-medium text-[rgb(var(--lp-text))] underline underline-offset-2" href="/backoffice/content">
          /backoffice/content
        </Link>
        . Denne vekstvisningen erstatter ikke manuell kvalitetssjekk før publisering.
      </p>
    </div>
  );
}

function OpportunityRow({ o, editorHref }: { o: Opportunity; editorHref: (id: string, f?: string) => string }) {
  const tier = opportunityImpact(o.priority);
  return (
    <li className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
            {impactEmoji(tier)}
            {o.type.toUpperCase()} · {o.pageTitle || o.pageId}
          </div>
          <p className="mt-1 text-sm font-medium text-[rgb(var(--lp-text))]">{o.description}</p>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            <span className="font-medium text-[rgb(var(--lp-text))]">Fordi:</span> {o.because}
          </p>
        </div>
        <Link href={editorHref(o.pageId)} className={`shrink-0 ${backofficeEntityActionPrimaryClass}`}>
          Åpne side
        </Link>
      </div>
    </li>
  );
}
