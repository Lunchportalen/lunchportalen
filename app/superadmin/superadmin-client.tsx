// app/superadmin/superadmin-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import StatusDropdown, { type CompanyStatus as LcStatus } from "@/components/superadmin/StatusDropdown";

/* =========================
   Types
========================= */

type SystemState = "NORMAL" | "DEGRADED";
type CompanyStatus = "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED";

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus; // UI holder UPPERCASE
  created_at: string;
  updated_at: string;
};

type Stats = {
  companiesTotal: number;
  companiesPending: number;
  companiesActive: number;
  companiesPaused: number;
  companiesClosed: number;
};

type LastEvent = { label: string; ts: string | null };

type Props = {
  initialCompanies: any[]; // deprecated, kan være tom / første side
  initialStats: {
    companiesTotal: number;
    companiesActive: number;
    companiesPaused: number;
    companiesClosed: number;
    companiesPending?: number; // bakoverkompat
  }; // deprecated, brukes som initial fallback

  // Motor-signaler (valgfri; kommer fra page.tsx)
  systemState?: SystemState;
  lastEvent?: LastEvent | null;
};

type ApiErr = { ok: false; rid?: string; error: string; message?: string; detail?: any };
type CompaniesListOk = { ok: true; rid?: string; items: any[]; nextCursor: string | null };
type CompaniesListResp = CompaniesListOk | ApiErr;

type CompaniesStatsOk = {
  ok: true;
  rid?: string;
  stats: Stats;
};
type CompaniesStatsResp = CompaniesStatsOk | ApiErr;

type Tab = "firms" | "alerts" | "audit";

/* =========================
   Helpers: status normalization
========================= */

function normalizeStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim();
  const up = s.toUpperCase();

  if (up === "PENDING" || up === "ACTIVE" || up === "PAUSED" || up === "CLOSED") return up as CompanyStatus;

  const low = s.toLowerCase();
  if (low === "pending") return "PENDING";
  if (low === "active") return "ACTIVE";
  if (low === "paused") return "PAUSED";
  if (low === "closed") return "CLOSED";

  // 🔒 Ukjent/mangler -> PENDING (aldri ACTIVE fallback)
  return "PENDING";
}

function normalizeCompanyRow(raw: any): CompanyRow {
  // Støtt både `status` og `firm_status` fra API
  const rawStatus = raw?.status ?? raw?.firm_status ?? raw?.firmStatus ?? raw?.firmStatus;
  return {
    id: String(raw?.id ?? "").trim(),
    name: (String(raw?.name ?? "").trim() || "Ukjent firma").trim(),
    orgnr: raw?.orgnr ? String(raw.orgnr).trim() : null,
    status: normalizeStatus(rawStatus),
    created_at: String(raw?.created_at ?? raw?.createdAt ?? "").trim(),
    updated_at: String(raw?.updated_at ?? raw?.updatedAt ?? "").trim(),
  };
}

function toLowerStatus(s: CompanyStatus): LcStatus {
  if (s === "PENDING") return "pending";
  if (s === "ACTIVE") return "active";
  if (s === "PAUSED") return "paused";
  return "closed";
}

function fromLowerStatus(s: LcStatus): CompanyStatus {
  if (s === "pending") return "PENDING";
  if (s === "active") return "ACTIVE";
  if (s === "paused") return "PAUSED";
  return "CLOSED";
}

function statusPill(status: CompanyStatus) {
  if (status === "PENDING") return "bg-sky-50 text-sky-900 ring-1 ring-sky-200";
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
  if (status === "PAUSED") return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
  return "bg-rose-50 text-rose-900 ring-1 ring-rose-200";
}

function formatISO(iso: string) {
  try {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso || "—";
  }
}

function calcStats(list: CompanyRow[]): Stats {
  return {
    companiesTotal: list.length,
    companiesPending: list.filter((c) => c.status === "PENDING").length,
    companiesActive: list.filter((c) => c.status === "ACTIVE").length,
    companiesPaused: list.filter((c) => c.status === "PAUSED").length,
    companiesClosed: list.filter((c) => c.status === "CLOSED").length,
  };
}

/* =========================
   UI helpers
========================= */

function badgeSystem(state: SystemState) {
  return [
    "inline-flex items-center rounded-lg px-3 py-2 text-xs font-extrabold ring-1",
    state === "DEGRADED"
      ? "bg-rose-50 text-rose-900 ring-rose-200"
      : "bg-emerald-50 text-emerald-900 ring-emerald-200",
  ].join(" ");
}

function chipBase(active: boolean) {
  return [
    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold ring-1 transition",
    active
      ? "bg-neutral-900 text-white ring-neutral-900"
      : "bg-white/70 text-neutral-800 ring-[rgb(var(--lp-border))] hover:bg-white",
  ].join(" ");
}

function softBtn() {
  return "rounded-lg bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-black/5 transition";
}

function primaryBtn() {
  return "rounded-lg bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-black transition";
}

/* =========================
   Infinite scroll helper
========================= */

function useInfiniteScroll(opts: { enabled: boolean; onLoadMore: () => void; rootMargin?: string }) {
  const { enabled, onLoadMore, rootMargin = "600px" } = opts;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    let ticking = false;

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        if (ticking) return;
        ticking = true;
        try {
          onLoadMore();
        } finally {
          setTimeout(() => (ticking = false), 250);
        }
      },
      { root: null, rootMargin, threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled, onLoadMore, rootMargin]);

  return ref;
}

const PAGE_LIMIT = 50;

/* =========================
   Main component
========================= */

export default function SuperadminClient({ initialCompanies, initialStats, systemState, lastEvent }: Props) {
  const [tab, setTab] = useState<Tab>("firms");

  // UI controls
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | CompanyStatus>("all");

  // Debounced search
  const [qDebounced, setQDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Data + paging
  const [companies, setCompanies] = useState<CompanyRow[]>(() => (initialCompanies || []).map(normalizeCompanyRow));
  const [cursor, setCursor] = useState<string | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Stats (FASIT: kommer alltid fra /api/superadmin/companies/stats)
  const [stats, setStats] = useState<Stats>(() => {
    const derived = calcStats((initialCompanies || []).map(normalizeCompanyRow));
    return {
      companiesTotal: initialStats?.companiesTotal ?? derived.companiesTotal ?? 0,
      companiesPending: initialStats?.companiesPending ?? derived.companiesPending ?? 0,
      companiesActive: initialStats?.companiesActive ?? derived.companiesActive ?? 0,
      companiesPaused: initialStats?.companiesPaused ?? derived.companiesPaused ?? 0,
      companiesClosed: initialStats?.companiesClosed ?? derived.companiesClosed ?? 0,
    };
  });
  const [statsLoading, setStatsLoading] = useState(false);

  // Motor signals (fallback hvis ikke sendt fra server)
  const derivedSystemState: SystemState =
    systemState ?? (stats.companiesPaused + stats.companiesClosed > 0 ? "DEGRADED" : "NORMAL");

  const derivedLastEvent: LastEvent | null =
    lastEvent ?? (companies[0]?.updated_at ? { label: "Last change", ts: companies[0].updated_at } : null);

  // UX
  const [toast, setToast] = useState<{ type: "ok" | "error"; msg: string } | null>(null);
  const [isPending] = useTransition();

  // Abort / race protection
  const listReqIdRef = useRef(0);
  const listAbortRef = useRef<AbortController | null>(null);

  /* =========================
     API helpers
  ========================= */

  function statusParam(v: "all" | CompanyStatus): string | null {
    if (v === "all") return null;
    if (v === "PENDING") return "pending";
    if (v === "ACTIVE") return "active";
    if (v === "PAUSED") return "paused";
    return "closed";
  }

  async function readJsonSafe<T = any>(res: Response): Promise<T | null> {
    const t = await res.text();
    if (!t) return null;
    try {
      return JSON.parse(t) as T;
    } catch {
      return null;
    }
  }

  function apiErrorMessage(res: Response, json: any, fallback: string) {
    const server = (json?.message ? String(json.message) : "") || (json?.error ? String(json.error) : "") || "";

    const statusHint =
      res.status === 401
        ? "Ikke innlogget (401)."
        : res.status === 403
          ? "Ingen tilgang (403). Krever superadmin."
          : `HTTP ${res.status}.`;

    const detail =
      json?.detail !== undefined
        ? ` Detail: ${typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail)}`
        : "";

    return server ? `${fallback} ${statusHint} ${server}${detail}` : `${fallback} ${statusHint}${detail}`;
  }

  function isAbort(err: any) {
    return err?.name === "AbortError" || String(err?.message || "").toLowerCase().includes("aborted");
  }

  function toastOk(msg: string) {
    setToast({ type: "ok", msg });
    setTimeout(() => setToast(null), 2800);
  }
  function toastErr(msg: string) {
    setToast({ type: "error", msg });
    setTimeout(() => setToast(null), 3800);
  }

  /* =========================
     API: stats
  ========================= */

  async function loadStats() {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/superadmin/companies/stats", { cache: "no-store" });
      const json = (await readJsonSafe<CompaniesStatsResp>(res)) as CompaniesStatsResp | null;

      if (res.ok && json && (json as any).ok === true) {
        const j = json as CompaniesStatsOk;
        setStats(j.stats);
      } else if (!res.ok) {
        toastErr(apiErrorMessage(res, json, "Kunne ikke hente stats."));
      }
    } catch (err) {
      if (!isAbort(err)) toastErr("Kunne ikke hente stats (nettverksfeil).");
    } finally {
      setStatsLoading(false);
    }
  }

  /* =========================
     API: list
  ========================= */

  async function loadFirstPage() {
    const reqId = ++listReqIdRef.current;

    listAbortRef.current?.abort();
    const ctrl = new AbortController();
    listAbortRef.current = ctrl;

    setLoadingList(true);
    setListError(null);
    setCompanies([]);
    setCursor(null);

    const usp = new URLSearchParams();
    const qq = qDebounced.trim();
    if (qq) usp.set("q", qq);
    const st = statusParam(filter);
    if (st) usp.set("status", st);
    usp.set("limit", String(PAGE_LIMIT));

    try {
      const res = await fetch(`/api/superadmin/companies?${usp.toString()}`, {
        cache: "no-store",
        signal: ctrl.signal,
      });

      const json = (await readJsonSafe<CompaniesListResp>(res)) as CompaniesListResp | null;
      if (reqId !== listReqIdRef.current) return;

      if (!res.ok || !json || (json as any).ok !== true) {
        setListError(apiErrorMessage(res, json, "Kunne ikke hente firma."));
        return;
      }

      const okJson = json as CompaniesListOk;
      setCompanies((okJson.items || []).map(normalizeCompanyRow));
      setCursor(okJson.nextCursor ?? null);

      loadStats().catch(() => {});
    } catch (err) {
      if (isAbort(err)) return;
      if (reqId !== listReqIdRef.current) return;
      setListError("Kunne ikke hente firma (nettverksfeil).");
    } finally {
      if (reqId === listReqIdRef.current) setLoadingList(false);
    }
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    setListError(null);

    const usp = new URLSearchParams();
    const qq = qDebounced.trim();
    if (qq) usp.set("q", qq);
    const st = statusParam(filter);
    if (st) usp.set("status", st);
    usp.set("limit", String(PAGE_LIMIT));
    usp.set("cursor", cursor);

    try {
      const res = await fetch(`/api/superadmin/companies?${usp.toString()}`, { cache: "no-store" });
      const json = (await readJsonSafe<CompaniesListResp>(res)) as CompaniesListResp | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        setListError(apiErrorMessage(res, json, "Kunne ikke hente flere firma."));
        return;
      }

      const okJson = json as CompaniesListOk;
      const incoming = (okJson.items || []).map(normalizeCompanyRow);

      setCompanies((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const add = incoming.filter((x) => !seen.has(x.id));
        return prev.concat(add);
      });

      setCursor(okJson.nextCursor ?? null);
    } catch (err) {
      if (!isAbort(err)) setListError("Kunne ikke hente flere firma (nettverksfeil).");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (tab !== "firms") return;
    loadFirstPage().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, filter, tab]);

  useEffect(() => {
    loadStats().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================
     Infinite scroll wiring
  ========================= */

  const hasMore = Boolean(cursor);
  const canAutoLoad = tab === "firms" && hasMore && !loadingMore && !loadingList && !listError;
  const sentinelRef = useInfiniteScroll({
    enabled: canAutoLoad,
    onLoadMore: () => loadMore(),
  });

  /* =========================
     Render
  ========================= */

  const visible = useMemo(() => companies, [companies]);

  const primaryMetric = useMemo(() => (statsLoading ? "…" : String(stats.companiesActive)), [statsLoading, stats.companiesActive]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
      {/* MOTOR TOP BAR */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-lg bg-black px-3 py-2 text-xs font-extrabold tracking-wide text-white">
            SUPERADMIN MODE
          </span>

          <span className={badgeSystem(derivedSystemState)}>SYSTEM: {derivedSystemState}</span>

          {derivedLastEvent?.label ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-neutral-700 ring-1 ring-[rgb(var(--lp-border))]">
              <span className="opacity-70">Sist:</span>
              <span className="font-extrabold">{derivedLastEvent.label}</span>
              <span className="opacity-70">{formatISO(derivedLastEvent.ts || "")}</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Link className={softBtn()} href="/superadmin/audit">
            Audit
          </Link>
          <Link className={softBtn()} href="/superadmin/billing">
            Invoice CSV
          </Link>
          <Link className={softBtn()} href="/superadmin/system">
            System
          </Link>
        </div>
      </div>

      {/* PRIMARY METRIC */}
      <div className="mt-5 rounded-2xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-extrabold tracking-wide text-neutral-600">PRIMARY METRIC</div>
            <div className="mt-1 text-sm font-bold text-neutral-700">ACTIVE FIRMS</div>
            <div className="mt-2 text-4xl font-black tracking-tight text-neutral-950">{primaryMetric}</div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:w-[460px]">
            <MiniMetric label="PENDING" value={statsLoading ? "…" : String(stats.companiesPending)} tone={statusPill("PENDING")} />
            <MiniMetric label="PAUSED" value={statsLoading ? "…" : String(stats.companiesPaused)} tone={statusPill("PAUSED")} />
            <MiniMetric label="CLOSED" value={statsLoading ? "…" : String(stats.companiesClosed)} tone={statusPill("CLOSED")} />
          </div>
        </div>
      </div>

      {/* ACTION LANE */}
      <div className="mt-4 rounded-2xl bg-white/60 p-4 ring-1 ring-[rgb(var(--lp-border))] backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="text-xs font-extrabold tracking-wide text-neutral-600">SEARCH FIRMS</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk firma (navn, orgnr, id)…"
              className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-[rgb(var(--lp-border))] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button className={chipBase(tab === "firms")} onClick={() => setTab("firms")}>
              Firms
            </button>
            <button className={chipBase(tab === "alerts")} onClick={() => setTab("alerts")}>
              Alerts <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">0</span>
            </button>
            <button className={chipBase(tab === "audit")} onClick={() => setTab("audit")}>
              Audit
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={[
            "mt-4 rounded-xl px-4 py-3 text-sm font-semibold ring-1",
            toast.type === "ok" ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : "bg-rose-50 text-rose-900 ring-rose-200",
          ].join(" ")}
        >
          {toast.msg}
        </div>
      )}

      {/* BODY */}
      {tab === "firms" && (
        <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-[rgb(var(--lp-border))]">
          <div className="flex flex-col gap-3 border-b border-[rgb(var(--lp-border))] px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-extrabold tracking-wide text-neutral-600">FIRMS</div>
              <div className="text-sm font-bold text-neutral-900">LIVE SYSTEM STATE</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className={chipBase(filter === "all")} onClick={() => setFilter("all")}>
                ALL
              </button>
              <button className={chipBase(filter === "PENDING")} onClick={() => setFilter("PENDING")}>
                PENDING
              </button>
              <button className={chipBase(filter === "ACTIVE")} onClick={() => setFilter("ACTIVE")}>
                ACTIVE
              </button>
              <button className={chipBase(filter === "PAUSED")} onClick={() => setFilter("PAUSED")}>
                PAUSED
              </button>
              <button className={chipBase(filter === "CLOSED")} onClick={() => setFilter("CLOSED")}>
                CLOSED
              </button>
            </div>
          </div>

          {listError && (
            <div className="border-b border-[rgb(var(--lp-border))] px-4 py-3 text-sm font-semibold text-rose-700">
              {listError}
            </div>
          )}

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-neutral-50 text-xs font-extrabold tracking-wide text-neutral-600">
                <tr className="border-b border-[rgb(var(--lp-border))]">
                  <th className="px-4 py-3">FIRMA</th>
                  <th className="px-4 py-3">ORGNR</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3">SIST ENDRET</th>
                  <th className="px-4 py-3 text-right">ACTION</th>
                </tr>
              </thead>

              <tbody>
                {loadingList ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-neutral-600">
                      Laster…
                    </td>
                  </tr>
                ) : (
                  <>
                    {visible.map((c) => (
                      <tr key={c.id} className="border-b border-[rgb(var(--lp-border))] hover:bg-neutral-50/60">
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-neutral-950">{c.name}</div>
                          <div className="mt-0.5 font-mono text-xs text-neutral-500">{c.id}</div>
                        </td>

                        <td className="px-4 py-3 font-semibold text-neutral-800">{c.orgnr && c.orgnr.trim().length ? c.orgnr : "—"}</td>

                        <td className="px-4 py-3">
                          <span className={["inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-extrabold ring-1", statusPill(c.status)].join(" ")}>
                            {c.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-xs font-semibold text-neutral-700">{formatISO(c.updated_at)}</td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Link href={`/superadmin/firms/${encodeURIComponent(c.id)}`} className={primaryBtn()}>
                              OPEN
                            </Link>

                            <StatusDropdown
                              companyId={c.id}
                              status={toLowerStatus(c.status)}
                              endpoint={`/api/superadmin/firms/${encodeURIComponent(c.id)}/status`}
                              onChanged={(next) => {
                                const up = fromLowerStatus(next);
                                setCompanies((prev) =>
                                  prev.map((row) => (row.id === c.id ? { ...row, status: up, updated_at: new Date().toISOString() } : row))
                                );
                                toastOk(`Oppdatert status → ${up}`);
                                loadStats().catch(() => {});
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}

                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-neutral-600">
                          Ingen treff.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t border-[rgb(var(--lp-border))] px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs font-semibold text-neutral-600">
              Viser <span className="font-extrabold text-neutral-900">{visible.length}</span> firma{cursor ? " (flere tilgjengelig)" : ""}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={!cursor || loadingMore || loadingList}
                onClick={loadMore}
                className={[
                  "rounded-lg px-4 py-2 text-xs font-extrabold ring-1 transition",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  "bg-white text-neutral-900 ring-[rgb(var(--lp-border))] hover:bg-black/5",
                ].join(" ")}
              >
                {loadingMore ? "Laster…" : cursor ? "Load more" : "No more"}
              </button>

              {(isPending || loadingList) && <div className="text-xs font-semibold text-neutral-600">Oppdaterer…</div>}
            </div>
          </div>

          <div ref={sentinelRef} className="h-2 w-full" />
        </div>
      )}

      {tab === "alerts" && <Placeholder title="ALERTS" note="Knyttes til kvalitet/levering/betaling (kommer)." />}
      {tab === "audit" && <Placeholder title="AUDIT" note="Bruk /superadmin/audit for full audit-view." />}

      {/* SIGNALS */}
      <div className="mt-4 rounded-2xl bg-white/60 p-4 ring-1 ring-[rgb(var(--lp-border))] backdrop-blur">
        <div className="text-xs font-extrabold tracking-wide text-neutral-600">SIGNALS</div>
        <div className="text-sm font-bold text-neutral-900">LAST 24H</div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <Signal label="Firms pending" value={statsLoading ? "…" : String(stats.companiesPending)} />
          <Signal label="Firms paused" value={statsLoading ? "…" : String(stats.companiesPaused)} />
          <Signal label="Firms closed" value={statsLoading ? "…" : String(stats.companiesClosed)} />
        </div>
      </div>
    </div>
  );
}

/* =========================
   UI components
========================= */

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">{label}</div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-2xl font-black text-neutral-950">{value}</div>
        <span className={["inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-extrabold ring-1", tone].join(" ")}>
          {label}
        </span>
      </div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">{label.toUpperCase()}</div>
      <div className="mt-2 text-2xl font-black text-neutral-950">{value}</div>
    </div>
  );
}

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-white/70 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="border-b border-[rgb(var(--lp-border))] px-4 py-3">
        <div className="text-xs font-extrabold tracking-wide text-neutral-600">{title}</div>
        <div className="mt-1 text-sm font-bold text-neutral-900">{note}</div>
      </div>
      <div className="px-4 py-10 text-sm font-semibold text-neutral-600">Klar for neste modul.</div>
    </div>
  );
}
