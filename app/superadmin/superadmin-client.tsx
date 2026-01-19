// app/superadmin/superadmin-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED";

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus; // vi holder state i UPPERCASE
  created_at: string;
  updated_at: string;
};

type Stats = {
  companiesTotal: number;
  companiesActive: number;
  companiesPaused: number;
  companiesClosed: number;
};

type Props = {
  // ✅ Deprecated: denne kan være tom nå (eller inneholde første side)
  // Vi normaliserer og bruker den som initial page.
  initialCompanies: any[];
  // ✅ Deprecated: brukes som initial render inntil stats-endpoint svarer
  initialStats: Stats;
};

type ApiOk = { ok: true; company: any; meta?: any };
type ApiDelOk = { ok: true; deleted: { id: string }; meta?: any };
type ApiErr = { ok: false; error: string; message?: string; detail?: any };
type ApiResp = ApiOk | ApiErr;
type ApiDelResp = ApiDelOk | ApiErr;

type Tab = "firms" | "alerts" | "audit" | "system";

/* =========================
   Helpers: status normalization
========================= */

function normalizeStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim();
  const up = s.toUpperCase();
  if (up === "ACTIVE" || up === "PAUSED" || up === "CLOSED") return up as CompanyStatus;

  const low = s.toLowerCase();
  if (low === "active") return "ACTIVE";
  if (low === "paused") return "PAUSED";
  if (low === "closed") return "CLOSED";

  // safe fallback
  return "ACTIVE";
}

function normalizeCompanyRow(raw: any): CompanyRow {
  return {
    id: String(raw?.id ?? ""),
    name: String(raw?.name ?? ""),
    orgnr: raw?.orgnr ? String(raw.orgnr) : null,
    status: normalizeStatus(raw?.status),
    created_at: String(raw?.created_at ?? raw?.createdAt ?? ""),
    updated_at: String(raw?.updated_at ?? raw?.updatedAt ?? ""),
  };
}

function statusPill(status: CompanyStatus) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
  if (status === "PAUSED") return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
  return "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-200";
}

function statusLabel(status: CompanyStatus) {
  if (status === "ACTIVE") return "Active";
  if (status === "PAUSED") return "Paused";
  return "Closed";
}

function formatISO(iso: string) {
  try {
    return new Date(iso).toLocaleString("no-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function calcStats(list: CompanyRow[]): Stats {
  return {
    companiesTotal: list.length,
    companiesActive: list.filter((c) => c.status === "ACTIVE").length,
    companiesPaused: list.filter((c) => c.status === "PAUSED").length,
    companiesClosed: list.filter((c) => c.status === "CLOSED").length,
  };
}

function chipBase(active: boolean) {
  return [
    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 transition",
    active
      ? "bg-black text-white ring-black"
      : "bg-white/60 text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))] hover:bg-white",
  ].join(" ");
}

function reasonForStatus(status: CompanyStatus) {
  if (status === "PAUSED") return "Midlertidig pause (manglende betaling / kontrakt)";
  if (status === "CLOSED") return "Stengt (kontrakt avsluttet / mislighold)";
  return "Gjenåpnet";
}

function errMsg(json: ApiErr | null | undefined, fallback = "UPDATE_FAILED") {
  const msg = json?.message || json?.error || fallback;
  const detail = json?.detail ? `: ${typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail)}` : "";
  return `${msg}${detail}`;
}

/* =========================
   Paging API types (NEW)
========================= */

type ListRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: "active" | "paused" | "closed" | "ACTIVE" | "PAUSED" | "CLOSED";
  created_at?: string;
  updated_at?: string;
};

type CompaniesListOk = { ok: true; rows: ListRow[]; nextCursor: string | null };
type CompaniesListErr = ApiErr;
type CompaniesListResp = CompaniesListOk | CompaniesListErr;

type CompaniesStatsOk = { ok: true; total: number; active: number; paused: number; closed: number };
type CompaniesStatsResp = CompaniesStatsOk | ApiErr;

const PAGE_LIMIT = 50;

/* =========================
   Main component
========================= */

export default function SuperadminClient({ initialCompanies, initialStats }: Props) {
  const [tab, setTab] = useState<Tab>("firms");

  // UI controls
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | CompanyStatus>("all");

  // Debounced search (important for server paging)
  const [qDebounced, setQDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Data + paging
  const [companies, setCompanies] = useState<CompanyRow[]>(() =>
    (initialCompanies || []).map(normalizeCompanyRow)
  );
  const [cursor, setCursor] = useState<string | null>(null);

  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // ✅ richer error (shows status + server error if available)
  const [listError, setListError] = useState<string | null>(null);

  // Stats (enterprise: from stats endpoint)
  const [stats, setStats] = useState<Stats>(() => {
    const derived = calcStats((initialCompanies || []).map(normalizeCompanyRow));
    return {
      companiesTotal: initialStats?.companiesTotal ?? derived.companiesTotal ?? 0,
      companiesActive: initialStats?.companiesActive ?? derived.companiesActive ?? 0,
      companiesPaused: initialStats?.companiesPaused ?? derived.companiesPaused ?? 0,
      companiesClosed: initialStats?.companiesClosed ?? derived.companiesClosed ?? 0,
    };
  });
  const [statsLoading, setStatsLoading] = useState<boolean>(false);

  // UX
  const [toast, setToast] = useState<{ type: "ok" | "error"; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [openRow, setOpenRow] = useState<string | null>(null);

  // Abort / race protection for list loads
  const listReqIdRef = useRef(0);

  /* =========================
     API: helpers
  ========================= */

  function statusParam(v: "all" | CompanyStatus): string | null {
    if (v === "all") return null;
    // API expects lower-case in our paging route
    if (v === "ACTIVE") return "active";
    if (v === "PAUSED") return "paused";
    return "closed";
  }

  async function readJsonSafe<T = any>(res: Response): Promise<T | null> {
    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  function apiErrorMessage(res: Response, json: any, fallback: string) {
    // prefer server-provided message/error
    const server =
      (json?.message ? String(json.message) : "") ||
      (json?.error ? String(json.error) : "") ||
      "";

    // enrich based on HTTP status
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

  /* =========================
     API: load stats
  ========================= */

  async function loadStats() {
    setStatsLoading(true);

    const res = await fetch("/api/superadmin/companies/stats", { cache: "no-store" });
    const json = (await readJsonSafe<CompaniesStatsResp>(res)) as CompaniesStatsResp | null;

    if (res.ok && json && (json as any).ok === true) {
      const j = json as CompaniesStatsOk;
      setStats({
        companiesTotal: j.total,
        companiesActive: j.active,
        companiesPaused: j.paused,
        companiesClosed: j.closed,
      });
    } else {
      // We do NOT block UI on stats; but we can show a soft toast once
      if (!res.ok) {
        const msg = apiErrorMessage(res, json, "Kunne ikke hente stats.");
        // show only if no other toast is active
        setToast((prev) => prev ?? { type: "error", msg });
        setTimeout(() => setToast(null), 3500);
      }
    }

    setStatsLoading(false);
  }

  /* =========================
     API: load first page (server-side search/filter)
  ========================= */

  async function loadFirstPage() {
    const reqId = ++listReqIdRef.current;

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

    const res = await fetch(`/api/superadmin/companies?${usp.toString()}`, { cache: "no-store" });
    const json = (await readJsonSafe<CompaniesListResp>(res)) as CompaniesListResp | null;

    // ignore race
    if (reqId !== listReqIdRef.current) return;

    if (!res.ok || !json || (json as any).ok !== true) {
      setListError(apiErrorMessage(res, json, "Kunne ikke hente firma."));
      setLoadingList(false);
      return;
    }

    const ok = json as CompaniesListOk;
    const normalized = (ok.rows || []).map((r) =>
      normalizeCompanyRow({
        id: r.id,
        name: r.name,
        orgnr: r.orgnr,
        status: r.status,
        created_at: (r as any).created_at,
        updated_at: (r as any).updated_at,
      })
    );

    setCompanies(normalized);
    setCursor(ok.nextCursor ?? null);
    setLoadingList(false);

    // Stats refresh (always correct)
    loadStats().catch(() => {});
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

    const res = await fetch(`/api/superadmin/companies?${usp.toString()}`, { cache: "no-store" });
    const json = (await readJsonSafe<CompaniesListResp>(res)) as CompaniesListResp | null;

    if (!res.ok || !json || (json as any).ok !== true) {
      setListError(apiErrorMessage(res, json, "Kunne ikke hente flere firma."));
      setLoadingMore(false);
      return;
    }

    const ok = json as CompaniesListOk;
    const incoming = (ok.rows || []).map((r) =>
      normalizeCompanyRow({
        id: r.id,
        name: r.name,
        orgnr: r.orgnr,
        status: r.status,
        created_at: (r as any).created_at,
        updated_at: (r as any).updated_at,
      })
    );

    setCompanies((prev) => {
      const seen = new Set(prev.map((x) => x.id));
      const add = incoming.filter((x) => !seen.has(x.id));
      return prev.concat(add);
    });

    setCursor(ok.nextCursor ?? null);
    setLoadingMore(false);
  }

  // reload list on query/filter change
  useEffect(() => {
    if (tab !== "firms") return;
    loadFirstPage().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, filter, tab]);

  // initial stats refresh
  useEffect(() => {
    loadStats().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================
     PATCH status (existing endpoint)
  ========================= */

  async function setCompanyStatus(companyId: string, status: CompanyStatus) {
    const reason = reasonForStatus(status);

    startTransition(async () => {
      setToast(null);

      const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ status, reason }),
      });

      const json = (await readJsonSafe<ApiResp>(res)) as ApiResp | null;

      if (!json) {
        setToast({ type: "error", msg: "Uventet svar fra server." });
        return;
      }

      if (!res.ok || json.ok === false) {
        setToast({ type: "error", msg: errMsg(json as any) });
        return;
      }

      const updated = normalizeCompanyRow((json as ApiOk).company);

      // Update current list row if present (do not assume it's loaded)
      setCompanies((prev) => prev.map((c) => (c.id === companyId ? updated : c)));

      setOpenRow(null);
      setToast({ type: "ok", msg: `Oppdatert: ${updated.name} → ${statusLabel(updated.status)}` });
      setTimeout(() => setToast(null), 2800);

      // Always refresh stats (source of truth)
      loadStats().catch(() => {});
    });
  }

  /* =========================
     PURGE (existing endpoint)
  ========================= */

  async function deleteCompany(companyId: string, name: string) {
    const typed = window.prompt(`Skriv PURGE for å slette firma "${name}" (inkl. ordre).`);
    if (typed !== "PURGE") return;

    startTransition(async () => {
      setToast(null);

      const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}/purge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ confirm: true, reason: "Purged av superadmin" }),
      });

      const json = (await readJsonSafe<ApiDelResp>(res)) as ApiDelResp | null;

      if (!json) {
        setToast({ type: "error", msg: "Uventet svar fra server." });
        return;
      }

      if (!res.ok || (json as any).ok === false) {
        setToast({ type: "error", msg: errMsg(json as any, "DELETE_FAILED") });
        return;
      }

      // Remove from current list if present
      setCompanies((prev) => prev.filter((c) => c.id !== companyId));

      setOpenRow(null);
      setToast({ type: "ok", msg: `Slettet (purge): ${name}` });
      setTimeout(() => setToast(null), 2800);

      // Refresh stats + list to keep paging consistent
      loadStats().catch(() => {});
      loadFirstPage().catch(() => {});
    });
  }

  /* =========================
     Render
  ========================= */

  const visible = useMemo(() => companies, [companies]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Superadmin</h1>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Drift og kontroll på firmanivå. Ingen unntak, ingen manuell støy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk firma (navn, orgnr, id)…"
            className="w-full rounded-2xl bg-white/70 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none focus:ring-2 focus:ring-black/10 md:w-[360px]"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button className={chipBase(tab === "firms")} onClick={() => setTab("firms")}>
          Firma
        </button>
        <button className={chipBase(tab === "alerts")} onClick={() => setTab("alerts")}>
          Varsler
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">0</span>
        </button>
        <button className={chipBase(tab === "audit")} onClick={() => setTab("audit")}>
          Audit
        </button>
        <button className={chipBase(tab === "system")} onClick={() => setTab("system")}>
          Systemhelse
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={[
            "mt-5 rounded-2xl px-4 py-3 text-sm ring-1",
            toast.type === "ok"
              ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
              : "bg-red-50 text-red-900 ring-red-200",
          ].join(" ")}
        >
          {toast.msg}
        </div>
      )}

      {/* KPI */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Totalt" value={statsLoading ? "…" : String(stats.companiesTotal)} />
        <StatCard label="Active" value={statsLoading ? "…" : String(stats.companiesActive)} />
        <StatCard label="Paused" value={statsLoading ? "…" : String(stats.companiesPaused)} />
        <StatCard label="Closed" value={statsLoading ? "…" : String(stats.companiesClosed)} />
      </div>

      {/* Body */}
      {tab === "firms" && (
        <div className="mt-6 rounded-3xl bg-white/70 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="flex flex-col gap-3 border-b border-[rgb(var(--lp-border))] px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">Firma</div>
              <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                Endringer her påvirker hele firmaet. Ansatte kan ikke omgå sperre.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className={chipBase(filter === "all")} onClick={() => setFilter("all")}>
                Alle
              </button>
              <button className={chipBase(filter === "ACTIVE")} onClick={() => setFilter("ACTIVE")}>
                Active
              </button>
              <button className={chipBase(filter === "PAUSED")} onClick={() => setFilter("PAUSED")}>
                Paused
              </button>
              <button className={chipBase(filter === "CLOSED")} onClick={() => setFilter("CLOSED")}>
                Closed
              </button>
            </div>
          </div>

          {/* Error */}
          {listError && (
            <div className="border-b border-[rgb(var(--lp-border))] px-5 py-3 text-sm text-red-700">
              {listError}
            </div>
          )}

          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white/80 text-xs text-[rgb(var(--lp-muted))] backdrop-blur">
                <tr className="border-b border-[rgb(var(--lp-border))]">
                  <th className="px-5 py-3">Firma</th>
                  <th className="px-5 py-3">Org.nr</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Sist endret</th>
                  <th className="px-5 py-3 text-right">Handling</th>
                </tr>
              </thead>

              <tbody>
                {loadingList ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-[rgb(var(--lp-muted))]">
                      Laster…
                    </td>
                  </tr>
                ) : (
                  <>
                    {visible.map((c, idx) => (
                      <tr
                        key={c.id}
                        className={[
                          "border-b border-[rgb(var(--lp-border))] last:border-b-0",
                          idx % 2 === 0 ? "bg-white/30" : "bg-white/10",
                        ].join(" ")}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-medium">{c.name}</div>
                              <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{c.id}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">{c.orgnr ?? "—"}</td>

                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${statusPill(c.status)}`}>
                            {statusLabel(c.status)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs text-[rgb(var(--lp-muted))]">{formatISO(c.updated_at)}</td>

                        <td className="px-5 py-4 relative overflow-visible">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/superadmin/firms/${encodeURIComponent(c.id)}`}
                              className="rounded-2xl bg-white px-3 py-2 text-xs font-medium ring-1 ring-[rgb(var(--lp-border))] transition hover:bg-black/5"
                            >
                              Åpne
                            </Link>

                            <div className="relative">
                              <button
                                disabled={isPending}
                                onClick={() => setOpenRow((v) => (v === c.id ? null : c.id))}
                                className={[
                                  "rounded-2xl px-3 py-2 text-xs font-medium ring-1 transition",
                                  "disabled:cursor-not-allowed disabled:opacity-60",
                                  "bg-white text-black ring-[rgb(var(--lp-border))] hover:bg-black/5",
                                ].join(" ")}
                              >
                                Endre status
                              </button>

                              {openRow === c.id && (
                                <div
                                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-[rgb(var(--lp-border))] z-[9999]"
                                  onMouseLeave={() => setOpenRow(null)}
                                >
                                  <MenuItem
                                    disabled={isPending || c.status === "ACTIVE"}
                                    onClick={() => setCompanyStatus(c.id, "ACTIVE")}
                                    title="Gjenåpne firma (Active)"
                                  >
                                    Sett Active
                                  </MenuItem>

                                  <MenuItem
                                    disabled={isPending || c.status === "PAUSED" || c.status === "CLOSED"}
                                    onClick={() => setCompanyStatus(c.id, "PAUSED")}
                                    title="Sett firma på pause"
                                  >
                                    Sett Paused
                                  </MenuItem>

                                  <MenuItem
                                    disabled={isPending || c.status === "CLOSED"}
                                    danger
                                    onClick={() => setCompanyStatus(c.id, "CLOSED")}
                                    title="Steng firma (irreversibelt i praksis)"
                                  >
                                    Sett Closed
                                  </MenuItem>

                                  <div className="border-t border-[rgb(var(--lp-border))]" />

                                  <MenuItem
                                    disabled={isPending}
                                    danger
                                    onClick={() => deleteCompany(c.id, c.name)}
                                    title='Purge: Sletter firma + ordre. Skriv "PURGE" for å bekrefte.'
                                  >
                                    Slett firma
                                  </MenuItem>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-sm text-[rgb(var(--lp-muted))]">
                          Ingen treff.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: paging */}
          <div className="flex flex-col gap-2 border-t border-[rgb(var(--lp-border))] px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-[rgb(var(--lp-muted))]">
              Viser {visible.length} firma{cursor ? " (flere tilgjengelig)" : ""}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={!cursor || loadingMore || loadingList}
                onClick={loadMore}
                className={[
                  "rounded-2xl px-4 py-2 text-xs font-medium ring-1 transition",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  "bg-white text-black ring-[rgb(var(--lp-border))] hover:bg-black/5",
                ].join(" ")}
              >
                {loadingMore ? "Laster…" : cursor ? "Last flere" : "Ingen flere"}
              </button>

              {(isPending || loadingList) && (
                <div className="text-xs text-[rgb(var(--lp-muted))]">Oppdaterer…</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "alerts" && <Placeholder title="Varsler" note="Knyttes til kvalitet/levering/betaling (kommer)." />}
      {tab === "audit" && <Placeholder title="Audit" note="Audit trail for superadmin (kommer)." />}
      {tab === "system" && <Placeholder title="Systemhelse" note="Driftstatus, cron, outbox, feilkø (kommer)." />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="text-xs text-[rgb(var(--lp-muted))]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "flex w-full items-center justify-between px-4 py-3 text-left text-sm transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        danger ? "text-red-700 hover:bg-red-50" : "text-black hover:bg-black/5",
      ].join(" ")}
    >
      <span>{children}</span>
    </button>
  );
}

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="mt-6 overflow-hidden rounded-3xl bg-white/70 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="border-b border-[rgb(var(--lp-border))] px-5 py-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{note}</div>
      </div>
      <div className="px-5 py-10 text-sm text-[rgb(var(--lp-muted))]">Klar for neste modul.</div>
    </div>
  );
}
