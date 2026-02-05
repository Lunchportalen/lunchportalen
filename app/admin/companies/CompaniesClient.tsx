"use client";

import { useEffect, useMemo, useState } from "react";

type CompanyStatus = "active" | "paused" | "closed";

type CompanyRow = {
  id: string;
  name: string;
  status: CompanyStatus;
  usersCount: number;
  orgnr?: string | null;
  updatedAt?: string | null;
};

type LoadState =
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "ready"; items: CompanyRow[] };

function statusChip(status: CompanyStatus) {
  if (status === "active") return "lp-chip lp-chip-ok";
  if (status === "paused") return "lp-chip lp-chip-warn";
  return "lp-chip lp-chip-neutral";
}

function statusLabel(status: CompanyStatus) {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  return "Closed";
}

export default function CompaniesClient() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<CompanyStatus | "all">("all");
  const [state, setState] = useState<LoadState>({ type: "loading" });
  const [confirm, setConfirm] = useState<{ open: boolean; company?: CompanyRow }>({
    open: false,
  });

  async function load() {
    setState({ type: "loading" });
    try {
      const r = await fetch("/api/superadmin/companies", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) {
        throw new Error(j?.message || j?.error || "Kunne ikke hente firma");
      }

      const items = Array.isArray(j?.data?.items) ? j.data.items : [];
      const mapped: CompanyRow[] = items.map((c: any) => {
        const employees = Number.isFinite(Number(c?.employeesCount)) ? Number(c?.employeesCount) : 0;
        const admins = Number.isFinite(Number(c?.adminsCount)) ? Number(c?.adminsCount) : 0;
        const st = String(c?.status ?? "active").toLowerCase();
        const status: CompanyStatus = st === "paused" || st === "closed" || st === "active" ? (st as CompanyStatus) : "active";
        return {
          id: String(c?.id ?? ""),
          name: String(c?.name ?? ""),
          status,
          usersCount: employees + admins,
          orgnr: c?.orgnr ?? null,
          updatedAt: c?.updatedAt ?? c?.updated_at ?? null,
        };
      });
      setState({ type: "ready", items: mapped });
    } catch (e: any) {
      setState({ type: "error", message: e?.message || "Ukjent feil" });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (state.type !== "ready") return [];
    const term = q.trim().toLowerCase();

    return state.items
      .filter((c) => (filter === "all" ? true : c.status === filter))
      .filter((c) => {
        if (!term) return true;
        const hay = `${c.name ?? ""} ${c.orgnr ?? ""}`.toLowerCase();
        return hay.includes(term);
      });
  }, [state, q, filter]);

  async function setCompanyStatus(companyId: string, status: CompanyStatus) {
    // Optimistisk UI, men last fasit etterpå
    if (state.type === "ready") {
      setState({
        type: "ready",
        items: state.items.map((c) => (c.id === companyId ? { ...c, status } : c)),
      });
    }

    const r = await fetch("/api/superadmin/company-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, status }),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) {
      await load(); // revert
      throw new Error(j?.message || j?.error || "Kunne ikke oppdatere status");
    }

    await load();
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk firma (navn/orgnr)…"
            className="lp-input sm:w-[360px]"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="lp-input sm:w-[200px]"
            aria-label="Filter status"
          >
            <option value="all">Alle statuser</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <button onClick={load} className="lp-btn w-full sm:w-auto">
          Oppdater
        </button>
      </div>

      {/* Content */}
      {state.type === "loading" ? (
        <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm text-[rgb(var(--lp-muted))]">Laster firma…</div>
        </div>
      ) : state.type === "error" ? (
        <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Kunne ikke laste firma</div>
          <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{state.message}</div>
          <button onClick={load} className="lp-btn mt-4">
            Prøv igjen
          </button>
        </div>
      ) : (
        <div className="rounded-3xl bg-white ring-1 ring-[rgb(var(--lp-border))]">
          <div className="px-5 py-4 text-sm font-semibold">Firma ({visible.length})</div>
          <div className="lp-divider" />

          <div className="divide-y divide-[rgb(var(--lp-divider))]">
            {visible.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <span className={statusChip(c.status)}>{statusLabel(c.status)}</span>
                  </div>

                  <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                    {c.usersCount} brukere
                    {c.orgnr ? ` • orgnr: ${c.orgnr}` : ""}
                    {" • "}
                    ID: <span className="break-all">{c.id}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="lp-btn"
                    disabled={c.status === "active"}
                    onClick={async () => {
                      try {
                        await setCompanyStatus(c.id, "active");
                      } catch (e: any) {
                        alert(e?.message || "Feil");
                      }
                    }}
                  >
                    Activate
                  </button>

                  <button
                    className="lp-btn"
                    disabled={c.status === "paused"}
                    onClick={async () => {
                      try {
                        await setCompanyStatus(c.id, "paused");
                      } catch (e: any) {
                        alert(e?.message || "Feil");
                      }
                    }}
                  >
                    Pause
                  </button>

                  <button
                    className="lp-btn"
                    disabled={c.status === "closed"}
                    onClick={() => setConfirm({ open: true, company: c })}
                  >
                    Close
                  </button>
                </div>
              </div>
            ))}

            {visible.length === 0 ? (
              <div className="px-5 py-6 text-sm text-[rgb(var(--lp-muted))]">
                Ingen treff.
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Confirm close modal */}
      {confirm.open && confirm.company ? (
        <div className="lp-modalOverlay" role="dialog" aria-modal="true">
          <div className="lp-modal">
            <div className="lp-modalHeader">
              <div className="text-sm font-semibold">Lukke firma</div>
              <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                Hard stenging på firmanivå. Dette skal ikke brukes som “pause”.
              </div>
            </div>

            <div className="lp-modalBody">
              Du er i ferd med å lukke <b>{confirm.company.name}</b>. Firmaet settes til{" "}
              <b>Closed</b> og stoppes av middleware og API-guards.
            </div>

            <div className="lp-modalActions">
              <button className="lp-btn" onClick={() => setConfirm({ open: false })}>
                Avbryt
              </button>

              <button
                className="lp-btn-primary"
                onClick={async () => {
                  const company = confirm.company!;
                  setConfirm({ open: false });

                  try {
                    await setCompanyStatus(company.id, "closed");
                  } catch (e: any) {
                    alert(e?.message || "Feil");
                  }
                }}
              >
                Bekreft Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
