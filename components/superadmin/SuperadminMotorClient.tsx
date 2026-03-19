"use client";

import { useMemo, useState } from "react";
import { formatDateTimeNO } from "@/lib/date/format";
import { Container } from "@/components/ui/container";

type CompanyStatus = "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED";

type FirmRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus;
  updated_at: string | null;
};

type Stats = {
  total: number;
  pending: number;
  active: number;
  paused: number;
  closed: number;
  // optional: target/capacity for “2/20”
  capacity?: number | null;
};

type SystemState = "NORMAL" | "DEGRADED";

function fmtTs(ts: string | null) {
  if (!ts) return "—";
  return formatDateTimeNO(ts);
}

function statusTone(s: CompanyStatus) {
  // Stramt, tydelig – ikke “søt”
  if (s === "ACTIVE") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (s === "PENDING") return "bg-amber-50 text-amber-900 ring-amber-200";
  if (s === "PAUSED") return "bg-orange-50 text-orange-900 ring-orange-200";
  return "bg-rose-50 text-rose-900 ring-rose-200"; // CLOSED
}

function systemTone(state: SystemState) {
  if (state === "NORMAL") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  return "bg-rose-50 text-rose-900 ring-rose-200";
}

function isUuidish(v: string) {
  return /^[0-9a-fA-F-]{16,}$/.test(v);
}

export default function SuperadminMotorClient(props: {
  stats: Stats;
  firms: FirmRow[];
  systemState?: SystemState;
  lastEvent?: { label: string; ts: string | null } | null;

  onOpenFirm: (firmId: string) => void;
  onChangeStatus: (firmId: string) => void;

  onDownloadInvoiceCsv?: () => void;
  onOpenAudit?: () => void;
}) {
  const { stats, firms } = props;

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<CompanyStatus | "ALL">("ALL");

  const systemState: SystemState = props.systemState ?? "NORMAL";

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return firms.filter((f) => {
      if (filter !== "ALL" && f.status !== filter) return false;
      if (!needle) return true;

      const hay = [
        f.name ?? "",
        f.orgnr ?? "",
        f.id ?? "",
        String(f.status ?? ""),
      ]
        .join(" | ")
        .toLowerCase();

      return hay.includes(needle);
    });
  }, [firms, q, filter]);

  const primaryValue = useMemo(() => {
    const cap = stats.capacity ?? null;
    return cap ? `${stats.active} / ${cap}` : String(stats.active);
  }, [stats.active, stats.capacity]);

  return (
    <Container className="max-w-6xl pb-10 pt-6">
      {/* TOP SYSTEM BAR */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-lg bg-black px-3 py-2 text-xs font-extrabold tracking-wide text-white">
            SUPERADMIN MODE
          </span>

          <span
            className={[
              "inline-flex items-center rounded-lg px-3 py-2 text-xs font-bold ring-1",
              systemTone(systemState),
            ].join(" ")}
          >
            SYSTEM: {systemState}
          </span>

          {props.lastEvent?.label ? (
            <span className="lp-glass-surface hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-neutral-700 md:inline-flex">
              <span className="opacity-70">Sist:</span>
              <span className="font-extrabold">{props.lastEvent.label}</span>
              <span className="opacity-70">{fmtTs(props.lastEvent.ts)}</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onOpenAudit}
            className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-neutral-200 hover:bg-neutral-50"
          >
            Audit
          </button>

          <button
            type="button"
            onClick={props.onDownloadInvoiceCsv}
            className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-neutral-200 hover:bg-neutral-50"
          >
            Invoice CSV
          </button>
        </div>
      </div>

      {/* PRIMARY METRIC */}
      <div className="lp-glass-card mt-6 rounded-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-extrabold tracking-wide text-neutral-600">PRIMARY METRIC</div>
            <div className="mt-1 text-sm font-bold text-neutral-700">ACTIVE FIRMS</div>
            <div className="mt-2 text-4xl font-black tracking-tight text-neutral-950">{primaryValue}</div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:w-[420px]">
            <MiniMetric label="PENDING" value={stats.pending} tone={statusTone("PENDING")} />
            <MiniMetric label="PAUSED" value={stats.paused} tone={statusTone("PAUSED")} />
            <MiniMetric label="CLOSED" value={stats.closed} tone={statusTone("CLOSED")} />
          </div>
        </div>
      </div>

      {/* ACTION LANE */}
      <div className="lp-glass-card mt-4 rounded-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="text-xs font-extrabold tracking-wide text-neutral-600">SEARCH FIRMS</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk firma (navn, orgnr, id)…"
              className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <FilterPill value="ALL" active={filter === "ALL"} onClick={() => setFilter("ALL")} />
            <FilterPill value="PENDING" active={filter === "PENDING"} onClick={() => setFilter("PENDING")} />
            <FilterPill value="ACTIVE" active={filter === "ACTIVE"} onClick={() => setFilter("ACTIVE")} />
            <FilterPill value="PAUSED" active={filter === "PAUSED"} onClick={() => setFilter("PAUSED")} />
            <FilterPill value="CLOSED" active={filter === "CLOSED"} onClick={() => setFilter("CLOSED")} />
          </div>
        </div>
      </div>

      {/* FIRMS TABLE */}
      <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <div className="text-xs font-extrabold tracking-wide text-neutral-600">FIRMS</div>
            <div className="text-sm font-bold text-neutral-900">LIVE SYSTEM STATE</div>
          </div>
          <div className="text-xs font-semibold text-neutral-600">
            Viser <span className="font-extrabold text-neutral-900">{filtered.length}</span> /{" "}
            <span className="font-extrabold text-neutral-900">{stats.total}</span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs font-extrabold tracking-wide text-neutral-600">
                <th className="px-4 py-3">FIRMA</th>
                <th className="px-4 py-3">ORGNR</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3">SIST ENDRET</th>
                <th className="px-4 py-3 text-right">ACTION</th>
              </tr>
            </thead>

            <tbody className="text-sm">
              {filtered.map((f) => (
                <tr key={f.id} className="border-t border-neutral-200 hover:bg-neutral-50/60">
                  <td className="px-4 py-3">
                    <div className="font-extrabold text-neutral-950">{f.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-neutral-500">
                      {isUuidish(f.id) ? f.id : String(f.id ?? "")}
                    </div>
                  </td>

                  <td className="px-4 py-3 font-semibold text-neutral-800">{f.orgnr ?? "—"}</td>

                  <td className="px-4 py-3">
                    <span className={["inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-extrabold ring-1", statusTone(f.status)].join(" ")}>
                      {f.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 font-semibold text-neutral-700">{fmtTs(f.updated_at)}</td>

                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => props.onOpenFirm(f.id)}
                        className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-black"
                      >
                        OPEN
                      </button>

                      <button
                        type="button"
                        onClick={() => props.onChangeStatus(f.id)}
                        className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-extrabold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
                      >
                        ⚠ CHANGE
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-neutral-600">
                    Ingen treff.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* SIGNALS (Audit lite) */}
      <div className="lp-glass-card mt-4 rounded-card p-4">
        <div className="text-xs font-extrabold tracking-wide text-neutral-600">SIGNALS</div>
        <div className="text-sm font-bold text-neutral-900">LAST 24H</div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <Signal label="Status changes" value="0" />
          <Signal label="Firms paused" value={String(stats.paused)} />
          <Signal label="Firms closed" value={String(stats.closed)} />
        </div>
      </div>
    </Container>
  );
}

function MiniMetric(props: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
      <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">{props.label}</div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-2xl font-black text-neutral-950">{props.value}</div>
        <span className={["inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-extrabold ring-1", props.tone].join(" ")}>
          {props.label}
        </span>
      </div>
    </div>
  );
}

function FilterPill(props: { value: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "lp-motion-btn inline-flex items-center rounded-lg px-3 py-2 text-xs font-extrabold ring-1",
        props.active
          ? "bg-neutral-900 text-white ring-neutral-900"
          : "bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50",
      ].join(" ")}
    >
      {props.value}
    </button>
  );
}

function Signal(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
      <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">{props.label.toUpperCase()}</div>
      <div className="mt-2 text-2xl font-black text-neutral-950">{props.value}</div>
    </div>
  );
}
