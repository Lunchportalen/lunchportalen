// app/admin/audit/AuditClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type AuditRow = {
  id: string;
  created_at: string;
  actor_user_id: string;
  actor_role: string;
  action: string;
  severity: "info" | "warning" | "critical";
  company_id: string | null;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
};

type LoadState =
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "ready"; items: AuditRow[] };

export default function AuditClient() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "info" | "warning" | "critical">("all");
  const [state, setState] = useState<LoadState>({ type: "loading" });

  async function load() {
    setState({ type: "loading" });
    try {
      const r = await fetch("/api/superadmin/audit", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.message || j?.error || "Kunne ikke hente audit");
      setState({ type: "ready", items: (j.items ?? []) as AuditRow[] });
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
      .filter((x) => (filter === "all" ? true : x.severity === filter))
      .filter((x) => {
        if (!term) return true;
        const hay = `${x.action} ${x.target_label ?? ""} ${x.target_id ?? ""} ${x.company_id ?? ""}`.toLowerCase();
        return hay.includes(term);
      });
  }, [state, q, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="lp-input sm:w-[360px]"
            placeholder="Søk (action, dato, mål)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="lp-input sm:w-[200px]"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            aria-label="Filter severity"
          >
            <option value="all">Alle severity</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <button className="lp-btn w-full sm:w-auto" onClick={load}>
          Oppdater
        </button>
      </div>

      {state.type === "loading" ? (
        <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          Laster audit…
        </div>
      ) : state.type === "error" ? (
        <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Kunne ikke laste audit</div>
          <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{state.message}</div>
          <button className="lp-btn mt-4" onClick={load}>
            Prøv igjen
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-[rgb(var(--lp-border))]">
          <div className="px-5 py-4 text-sm font-semibold">Hendelser ({visible.length})</div>
          <div className="lp-divider" />

          <div className="divide-y divide-[rgb(var(--lp-divider))]">
            {visible.map((x) => (
              <div key={x.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      x.severity === "critical"
                        ? "lp-chip lp-chip-crit"
                        : x.severity === "warning"
                        ? "lp-chip lp-chip-warn"
                        : "lp-chip lp-chip-neutral"
                    }
                  >
                    {x.severity}
                  </span>

                  <div className="text-sm font-semibold">{x.action}</div>
                </div>

                <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                  {new Date(x.created_at).toLocaleString("nb-NO")} • {x.actor_role} •{" "}
                  {x.target_label ?? x.target_id ?? "—"}
                </div>

                {x.company_id ? (
                  <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                    Firma: <span className="font-mono">{x.company_id}</span>
                  </div>
                ) : null}
              </div>
            ))}

            {visible.length === 0 ? (
              <div className="px-5 py-6 text-sm text-[rgb(var(--lp-muted))]">Ingen treff.</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
