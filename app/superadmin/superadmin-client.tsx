// app/superadmin/superadmin-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import StatusDropdown, {
  type CompanyStatus as LcStatus,
} from "@/components/superadmin/StatusDropdown";
import ActionMenu from "@/components/admin/ActionMenu";
import KPIStrip from "@/components/admin/KPIStrip";
import StatusPill from "@/components/admin/StatusPill";
import TableShell from "@/components/admin/TableShell";
import { normalizeSuperadminStats, type SuperadminStats } from "./types";
import { formatDateTimeNO } from "@/lib/date/format";

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

type Props = {
  initialCompanies: any[];
  initialStats: SuperadminStats;
  degradedRid?: string | null;

  // Motor-signaler (kommer fra page.tsx)
  systemState: SystemState;
};

type ApiErr = {
  ok: false;
  rid?: string;
  error: string;
  message?: string;
  detail?: any;
};
type CompaniesListOk = {
  ok: true;
  rid?: string;
  items: any[];
  nextCursor: string | null;
};
type CompaniesListResp = CompaniesListOk | ApiErr;

type CompaniesStatsOk = {
  ok: true;
  rid?: string;
  stats: Partial<SuperadminStats>;
};
type CompaniesStatsResp = CompaniesStatsOk | ApiErr;

/* =========================
   Helpers: status normalization
========================= */

function normalizeStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim();
  const up = s.toUpperCase();

  if (up === "PENDING" || up === "ACTIVE" || up === "PAUSED" || up === "CLOSED")
    return up as CompanyStatus;

  const low = s.toLowerCase();
  if (low === "pending") return "PENDING";
  if (low === "active") return "ACTIVE";
  if (low === "paused") return "PAUSED";
  if (low === "closed") return "CLOSED";

  // 🔒 Ukjent/mangler -> PENDING (aldri ACTIVE fallback)
  return "PENDING";
}

function normalizeCompanyRow(raw: any): CompanyRow {
  const rawStatus =
    raw?.status ?? raw?.firm_status ?? raw?.firmStatus ?? raw?.firmStatus;
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
  if (status === "ACTIVE")
    return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
  if (status === "PAUSED")
    return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
  return "bg-rose-50 text-rose-900 ring-1 ring-rose-200";
}

function formatISO(iso: string) {
  try {
    if (!iso) return "—";
    return formatDateTimeNO(iso);
  } catch {
    return iso || "—";
  }
}

function metricValue(value: number | null, loading: boolean) {
  if (loading) return "...";
  if (value === null || value === undefined) return "Ikke tilgjengelig";
  return String(value);
}

/* =========================
   UI helpers
========================= */

function chipBase(active: boolean) {
  return [
    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold ring-1 transition",
    active
      ? "bg-neutral-900 text-white ring-neutral-900"
      : "bg-white/70 text-neutral-800 ring-[rgb(var(--lp-border))] hover:bg-white",
  ].join(" ");
}

function ghostBtn() {
  return "rounded-lg bg-transparent px-3 py-2 text-xs font-extrabold text-neutral-900 ring-1 ring-[rgb(var(--lp-border))] hover:bg-black/5 transition";
}

/* =========================
   Infinite scroll helper
========================= */

function useInfiniteScroll(opts: {
  enabled: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}) {
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

export default function SuperadminClient({
  initialCompanies,
  initialStats,
  degradedRid,
  systemState,
}: Props) {
  // UI controls
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | CompanyStatus>("all");

  // Debounced search
  const [qDebounced, setQDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Data + paging (KEEP LAST GOOD)
  const [companies, setCompanies] = useState<CompanyRow[]>(() =>
    (initialCompanies || []).map(normalizeCompanyRow)
  );
  const [cursor, setCursor] = useState<string | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Stats (KEEP LAST GOOD)
  const [stats, setStats] = useState<SuperadminStats>(() =>
    normalizeSuperadminStats(initialStats)
  );
  const [statsLoading, setStatsLoading] = useState(false);

  // Degraded handling (never wipe data)
  const [localDegraded, setLocalDegraded] = useState(systemState === "DEGRADED");
  const [localDegradedRid, setLocalDegradedRid] = useState<string | null>(
    degradedRid ?? null
  );

  const effectiveSystemState: SystemState = localDegraded ? "DEGRADED" : "NORMAL";

  const statsUnavailable =
    stats.companiesActive === null &&
    stats.companiesPending === null &&
    stats.companiesPaused === null &&
    stats.companiesClosed === null;

  const alertsCount =
    statsUnavailable || stats.companiesPaused === null || stats.companiesClosed === null
      ? null
      : (stats.companiesPaused ?? 0) + (stats.companiesClosed ?? 0);

  // UX
  const [toast, setToast] = useState<{ type: "ok" | "error"; msg: string } | null>(null);
  const [isPending] = useTransition();

  // Abort / race protection
  const listReqIdRef = useRef(0);
  const listAbortRef = useRef<AbortController | null>(null);
  const didInitialHydrateRef = useRef(false);

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
    const server =
      (json?.message ? String(json.message) : "") ||
      (json?.error ? String(json.error) : "") ||
      "";
    const rid = json?.rid ? ` RID: ${String(json.rid)}` : "";

    const statusHint =
      res.status === 401
        ? "Ikke innlogget (401)."
        : res.status === 403
        ? "Ingen tilgang (403). Krever superadmin."
        : `HTTP ${res.status}.`;

    const detail =
      json?.detail !== undefined
        ? ` Detail: ${
            typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail)
          }`
        : "";

    return server
      ? `${fallback} ${statusHint} ${server}${detail}${rid}`
      : `${fallback} ${statusHint}${detail}${rid}`;
  }

  function isAbort(err: any) {
    return err?.name === "AbortError" || String(err?.message || "").toLowerCase().includes("aborted");
  }

  function markDegraded(rid?: string | null) {
    setLocalDegraded(true);
    if (rid) setLocalDegradedRid(String(rid));
  }

  function clearDegraded() {
    setLocalDegraded(false);
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
     API: stats (never wipe)
  ========================= */

  async function loadStats() {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/superadmin/companies/stats", {
        cache: "no-store",
        credentials: "same-origin",
      });

      const json = (await readJsonSafe<CompaniesStatsResp>(res)) as CompaniesStatsResp | null;

      if (res.ok && json && (json as any).ok === true) {
        const j = json as CompaniesStatsOk;
        clearDegraded();
        setStats(normalizeSuperadminStats(j.stats));
        return;
      }

      const rid = (json as any)?.rid ?? null;
      markDegraded(rid);
      if (!res.ok) toastErr(apiErrorMessage(res, json, "Kunne ikke hente stats."));
    } catch (err) {
      if (!isAbort(err)) {
        markDegraded(null);
        toastErr("Kunne ikke hente stats (nettverksfeil).");
      }
    } finally {
      setStatsLoading(false);
    }
  }

  /* =========================
     API: list (keep last good)
  ========================= */

  async function loadFirstPage() {
    const reqId = ++listReqIdRef.current;

    listAbortRef.current?.abort();
    const ctrl = new AbortController();
    listAbortRef.current = ctrl;

    setLoadingList(true);
    setListError(null);

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
        credentials: "same-origin",
      });

      const json = (await readJsonSafe<CompaniesListResp>(res)) as CompaniesListResp | null;
      if (reqId !== listReqIdRef.current) return;

      if (!res.ok || !json || (json as any).ok !== true) {
        const rid = (json as any)?.rid ?? null;
        markDegraded(rid);
        setListError(apiErrorMessage(res, json, "Kunne ikke hente firma."));
        // ✅ KEEP LAST GOOD: do not wipe companies
        return;
      }

      clearDegraded();
      const okJson = json as CompaniesListOk;

      setCompanies((okJson.items || []).map(normalizeCompanyRow));
      setCursor(okJson.nextCursor ?? null);

      loadStats().catch(() => {});
    } catch (err) {
      if (isAbort(err)) return;
      if (reqId !== listReqIdRef.current) return;
      markDegraded(null);
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
      const res = await fetch(`/api/superadmin/companies?${usp.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = (await readJsonSafe<CompaniesListResp>(res)) as CompaniesListResp | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        const rid = (json as any)?.rid ?? null;
        markDegraded(rid);
        setListError(apiErrorMessage(res, json, "Kunne ikke hente flere firma."));
        return;
      }

      clearDegraded();
      const okJson = json as CompaniesListOk;
      const incoming = (okJson.items || []).map(normalizeCompanyRow);

      setCompanies((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const add = incoming.filter((x) => !seen.has(x.id));
        return prev.concat(add);
      });

      setCursor(okJson.nextCursor ?? null);
    } catch (err) {
      if (!isAbort(err)) {
        markDegraded(null);
        setListError("Kunne ikke hente flere firma (nettverksfeil).");
      }
    } finally {
      setLoadingMore(false);
    }
  }

  // ✅ StrictMode-safe first hydration: do NOT wipe; just refresh stats once.
  useEffect(() => {
    if (didInitialHydrateRef.current) return;
    didInitialHydrateRef.current = true;
    loadStats().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter/search
  useEffect(() => {
    loadFirstPage().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, filter]);

  /* =========================
     Infinite scroll wiring
  ========================= */

  const hasMore = Boolean(cursor);
  const canAutoLoad = hasMore && !loadingMore && !loadingList && !listError;
  const sentinelRef = useInfiniteScroll({
    enabled: canAutoLoad,
    onLoadMore: () => loadMore(),
  });

  /* =========================
     Render
  ========================= */

  const visible = useMemo(() => companies, [companies]);

  // ✅ KPI empty panel should be shown when stats are unavailable OR degraded
  const showKpiEmpty = statsUnavailable || effectiveSystemState === "DEGRADED";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
      {/* STATUS + ACTIONS */}
      <div className="flex items-center justify-end gap-2">
        <StatusPill state={effectiveSystemState} />
        <ActionMenu
          items={[
            { kind: "link", label: "Audit log", href: "/superadmin/audit" },
            { kind: "link", label: "System diagnostics", href: "/superadmin/system" },
            {
              kind: "link",
              label: "Export CSV",
              href: "/superadmin/billing",
              disabled: effectiveSystemState === "DEGRADED",
              note: "Ikke tilgjengelig i degraded mode",
            },
          ]}
        />
      </div>

      {/* KPI STRIP */}
      <KPIStrip
        title="Nøkkelindikatorer"
        items={
          statsUnavailable
            ? []
            : [
                { label: "Active firms", value: metricValue(stats.companiesActive, statsLoading) },
                { label: "Pending", value: metricValue(stats.companiesPending, statsLoading) },
                { label: "Alerts", value: metricValue(alertsCount, statsLoading) },
              ]
        }
        emptyTitle={effectiveSystemState === "DEGRADED" ? "Statistikk midlertidig utilgjengelig" : "Statistikk ikke tilgjengelig"}
        emptyBody={
          effectiveSystemState === "DEGRADED"
            ? "Systemet kjører i degraded mode. Data hentes på nytt automatisk."
            : "Data ble ikke returnert fra stats-endpointen. Prøv å laste siden på nytt."
        }
        showEmptyPanel={showKpiEmpty}
      />

      {effectiveSystemState === "DEGRADED" && (
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-4 text-sm text-neutral-700">
          <div className="font-semibold text-neutral-900">System i degraded mode</div>
          <div className="mt-1">
            Statistikk kan være midlertidig utilgjengelig, men firmalisten fungerer som normalt.
          </div>
          {localDegradedRid ? (
            <div className="mt-2 text-xs font-mono text-neutral-500">RID: {localDegradedRid}</div>
          ) : null}
        </div>
      )}

      {/* SEARCH + FILTERS */}
      <div className="mt-4 rounded-2xl bg-white/60 p-4 ring-1 ring-[rgb(var(--lp-border))] backdrop-blur">
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-xs font-extrabold tracking-wide text-neutral-600">SØK FIRMA</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk firma (navn, orgnr, id)…"
              className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-[rgb(var(--lp-border))] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className={chipBase(filter === "all")} onClick={() => setFilter("all")}>
              ALL
            </button>
            <button className={chipBase(filter === "ACTIVE")} onClick={() => setFilter("ACTIVE")}>
              ACTIVE
            </button>
            <button className={chipBase(filter === "PENDING")} onClick={() => setFilter("PENDING")}>
              PENDING
            </button>
            <button className={chipBase(filter === "PAUSED")} onClick={() => setFilter("PAUSED")}>
              PAUSED
            </button>
            <button className={chipBase(filter === "CLOSED")} onClick={() => setFilter("CLOSED")}>
              CLOSED
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={[
            "mt-4 rounded-xl px-4 py-3 text-sm font-semibold ring-1",
            toast.type === "ok"
              ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
              : "bg-rose-50 text-rose-900 ring-rose-200",
          ].join(" ")}
        >
          {toast.msg}
        </div>
      )}

      {/* TABLE */}
      <TableShell
        title="Firmaoversikt"
        subtitle="Siste endringer og status for alle selskaper."
        footer={
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs font-semibold text-neutral-600">
              Viser <span className="font-extrabold text-neutral-900">{visible.length}</span> firma
              {cursor ? " (flere tilgjengelig)" : ""}
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

              {(isPending || loadingList) && (
                <div className="text-xs font-semibold text-neutral-600">Oppdaterer…</div>
              )}
            </div>
          </div>
        }
      >
        {listError && (
          <div className="border-b border-[rgb(var(--lp-border))] px-4 py-3 text-sm font-semibold text-neutral-700">
            {listError}
          </div>
        )}

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-neutral-50 text-xs font-extrabold tracking-wide text-neutral-600">
              <tr className="border-b border-[rgb(var(--lp-border))]">
                <th className="px-4 py-3">FIRMA</th>
                <th className="px-4 py-3">ORGNR</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3">SIST ENDRET</th>
                <th className="px-4 py-3 text-right">HANDLING</th>
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

                      <td className="px-4 py-3 font-semibold text-neutral-800">
                        {c.orgnr && c.orgnr.trim().length ? c.orgnr : "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-extrabold ring-1",
                            statusPill(c.status),
                          ].join(" ")}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs font-semibold text-neutral-700">
                        {formatISO(c.updated_at)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link href={`/superadmin/firms/${encodeURIComponent(c.id)}`} className={ghostBtn()}>
                            OPEN
                          </Link>

                          <StatusDropdown
                            companyId={c.id}
                            status={toLowerStatus(c.status)}
                            endpoint={`/api/superadmin/firms/${encodeURIComponent(c.id)}/status`}
                            onChanged={(next) => {
                              const up = fromLowerStatus(next);
                              setCompanies((prev) =>
                                prev.map((row) =>
                                  row.id === c.id
                                    ? { ...row, status: up, updated_at: new Date().toISOString() }
                                    : row
                                )
                              );
                              toastOk("Oppdatert status -> " + up);
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
                        Ingen treff. Prøv et annet søk eller juster filteret.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div ref={sentinelRef} className="h-2 w-full" />
      </TableShell>
    </div>
  );
}
