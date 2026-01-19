// app/superadmin/superadmin-client.tsx
"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";

type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED";

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus;
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
  initialCompanies: CompanyRow[];
  initialStats: Stats;
};

type ApiOk = { ok: true; company: CompanyRow; meta?: any };
type ApiErr = { ok: false; error: string; message?: string; detail?: string };
type ApiResp = ApiOk | ApiErr;

type Tab = "firms" | "alerts" | "audit" | "system";

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

export default function SuperadminClient({ initialCompanies, initialStats }: Props) {
  const [tab, setTab] = useState<Tab>("firms");

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | CompanyStatus>("all");

  const [companies, setCompanies] = useState<CompanyRow[]>(initialCompanies);
  const [stats, setStats] = useState<Stats>(initialStats);

  const [toast, setToast] = useState<{ type: "ok" | "error"; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // dropdown state per row
  const [openRow, setOpenRow] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = companies;

    if (filter !== "all") list = list.filter((c) => c.status === filter);
    if (!needle) return list;

    return list.filter((c) => {
      const hay = `${c.name} ${c.orgnr ?? ""} ${c.id}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [q, companies, filter]);

  async function setCompanyStatus(companyId: string, status: CompanyStatus) {
    const reason = reasonForStatus(status);

    startTransition(async () => {
      setToast(null);

      const res = await fetch("/api/superadmin/company-status", {
        method: "PATCH", // ✅ viktig (du så tidligere 500 på POST/PATCH-mismatch)
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ companyId, status, reason }),
      });

      const json = (await res.json().catch(() => null)) as ApiResp | null;

      if (!json) {
        setToast({ type: "error", msg: "Uventet svar fra server." });
        return;
      }

      if (json.ok === false) {
        const msg = json.message || json.error || "UPDATE_FAILED";
        const detail = json.detail ? `: ${json.detail}` : "";
        setToast({ type: "error", msg: `${msg}${detail}` });
        return;
      }

      const updated = json.company;

      setCompanies((prev) => {
        const next = prev.map((c) => (c.id === companyId ? updated : c));
        setStats(calcStats(next));
        return next;
      });

      setOpenRow(null);
      setToast({ type: "ok", msg: `Oppdatert: ${updated.name} → ${statusLabel(updated.status)}` });
      setTimeout(() => setToast(null), 2800);
    });
  }

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
        <StatCard label="Totalt" value={stats.companiesTotal} />
        <StatCard label="Active" value={stats.companiesActive} />
        <StatCard label="Paused" value={stats.companiesPaused} />
        <StatCard label="Closed" value={stats.companiesClosed} />
      </div>

      {/* Body */}
      {tab === "firms" && (
        // ✅ FIKS: IKKE overflow-hidden her (dropdown blir klippet / stacking issues)
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

          {/* ✅ FIKS: allow dropdown to escape vertically */}
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
                {filtered.map((c, idx) => (
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

                    {/* ✅ FIKS: relative + overflow-visible + z-index on menu */}
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
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-[rgb(var(--lp-muted))]">
                      Ingen treff.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {isPending && (
            <div className="border-t border-[rgb(var(--lp-border))] px-5 py-3 text-xs text-[rgb(var(--lp-muted))]">
              Oppdaterer…
            </div>
          )}
        </div>
      )}

      {tab === "alerts" && <Placeholder title="Varsler" note="Knyttes til kvalitet/levering/betaling (kommer)." />}
      {tab === "audit" && <Placeholder title="Audit" note="Audit trail for superadmin (kommer)." />}
      {tab === "system" && <Placeholder title="Systemhelse" note="Driftstatus, cron, outbox, feilkø (kommer)." />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
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
