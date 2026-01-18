"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";

type CompanyStatus = "active" | "paused" | "closed";

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

type ApiOk = { ok: true; company: CompanyRow };
type ApiErr = { ok: false; error: string; detail?: string };
type ApiResp = ApiOk | ApiErr;

function statusPill(status: CompanyStatus) {
  if (status === "active")
    return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
  if (status === "paused")
    return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
  return "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-200";
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
    companiesActive: list.filter((c) => c.status === "active").length,
    companiesPaused: list.filter((c) => c.status === "paused").length,
    companiesClosed: list.filter((c) => c.status === "closed").length,
  };
}

export default function SuperadminClient({
  initialCompanies,
  initialStats,
}: Props) {
  const [q, setQ] = useState("");
  const [companies, setCompanies] = useState<CompanyRow[]>(initialCompanies);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [toast, setToast] = useState<{
    type: "ok" | "error";
    msg: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return companies;
    return companies.filter((c) => {
      const hay = `${c.name} ${c.orgnr ?? ""} ${c.id}`.toLowerCase();
      return hay.includes(s);
    });
  }, [q, companies]);

  async function setCompanyStatus(companyId: string, status: CompanyStatus) {
    const reason =
      status === "paused"
        ? "Midlertidig pause (manglende betaling / kontrakt)"
        : status === "closed"
        ? "Stengt (kontrakt avsluttet / mislighold)"
        : "Gjenåpnet";

    startTransition(async () => {
      setToast(null);

      const res = await fetch("/api/superadmin/company-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, status, reason }),
      });

      const json = (await res.json().catch(() => null)) as ApiResp | null;

      if (!json) {
        setToast({ type: "error", msg: "Uventet svar fra server." });
        return;
      }

      if (json.ok === false) {
        setToast({ type: "error", msg: json.error || "Kunne ikke oppdatere." });
        return;
      }

      const updated = json.company;

      setCompanies((prev) => {
        const next = prev.map((c) => (c.id === companyId ? updated : c));
        setStats(calcStats(next));
        return next;
      });

      setToast({
        type: "ok",
        msg: `Oppdatert: ${updated.name} → ${updated.status}`,
      });
      setTimeout(() => setToast(null), 2800);
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Superadmin
          </h1>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Drift og kontroll på firmanivå. Ingen unntak, ingen manuell støy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk firma (navn, orgnr, id)…"
            className="w-full rounded-2xl bg-white/70 px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none focus:ring-2 focus:ring-black/10 md:w-[320px]"
          />
        </div>
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

      {/* Stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Totalt" value={stats.companiesTotal} />
        <StatCard label="Active" value={stats.companiesActive} />
        <StatCard label="Paused" value={stats.companiesPaused} />
        <StatCard label="Closed" value={stats.companiesClosed} />
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-3xl bg-white/70 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="border-b border-[rgb(var(--lp-border))] px-5 py-4">
          <div className="text-sm font-semibold">Firma</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Endringer her påvirker hele firmaet. Ansatte kan ikke omgå sperre.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs text-[rgb(var(--lp-muted))]">
              <tr className="border-b border-[rgb(var(--lp-border))]">
                <th className="px-5 py-3">Firma</th>
                <th className="px-5 py-3">Org.nr</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Opprettet</th>
                <th className="px-5 py-3">Sist endret</th>
                <th className="px-5 py-3 text-right">Handling</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[rgb(var(--lp-border))] last:border-b-0"
                >
                  <td className="px-5 py-4">
                    <div className="font-medium">{c.name}</div>
                    <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                      {c.id}
                    </div>
                  </td>

                  <td className="px-5 py-4">{c.orgnr ?? "—"}</td>

                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${statusPill(
                        c.status
                      )}`}
                    >
                      {c.status}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-xs text-[rgb(var(--lp-muted))]">
                    {formatISO(c.created_at)}
                  </td>
                  <td className="px-5 py-4 text-xs text-[rgb(var(--lp-muted))]">
                    {formatISO(c.updated_at)}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <ActionBtn
                        disabled={isPending || c.status === "active"}
                        onClick={() => setCompanyStatus(c.id, "active")}
                      >
                        Activate
                      </ActionBtn>

                      <ActionBtn
                        disabled={
                          isPending ||
                          c.status === "paused" ||
                          c.status === "closed"
                        }
                        onClick={() => setCompanyStatus(c.id, "paused")}
                      >
                        Pause
                      </ActionBtn>

                      <ActionBtn
                        disabled={isPending || c.status === "closed"}
                        danger
                        onClick={() => setCompanyStatus(c.id, "closed")}
                      >
                        Close
                      </ActionBtn>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-[rgb(var(--lp-muted))]"
                  >
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

function ActionBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-2xl px-3 py-2 text-xs font-medium ring-1 transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        danger
          ? "bg-white text-red-700 ring-red-200 hover:bg-red-50"
          : "bg-white text-black ring-[rgb(var(--lp-border))] hover:bg-black/5",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
