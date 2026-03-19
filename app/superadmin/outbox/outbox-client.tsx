"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatDateTimeNO } from "@/lib/date/format";

type OutboxStatus = "ALL" | "PENDING" | "PROCESSING" | "FAILED" | "FAILED_PERMANENT" | "SENT";

type Row = {
  event_key: string;
  status: "PENDING" | "PROCESSING" | "FAILED" | "FAILED_PERMANENT" | "SENT";
  attempts: number;
  created_at: string;
  sent_at: string | null;
  last_error: string | null;
  payload: any;
};

type Counts = { PENDING: number; FAILED: number; SENT: number };

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function fmt(iso?: string | null) {
  try {
    if (!iso) return "—";
    return formatDateTimeNO(iso);
  } catch {
    return "—";
  }
}

async function readJsonSafe(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function statusBadge(status: Row["status"]) {
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs";
  if (status === "FAILED_PERMANENT") return `${base} border-red-300 bg-red-50 text-red-900`;
  if (status === "FAILED") return `${base} border-red-200 bg-red-50 text-red-800`;
  if (status === "PENDING" || status === "PROCESSING") return `${base} border-amber-200 bg-amber-50 text-amber-900`;
  return `${base} border-emerald-200 bg-emerald-50 text-emerald-900`;
}

function limitClamp(n: number) {
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(200, Math.floor(n)));
}

type Props = {
  /** superadmin: "/api/superadmin/outbox"  | ordre-ops: "/api/outbox" */
  apiBase?: string;
  /** superadmin: "/superadmin/outbox" | ordre-ops: "/outbox" */
  loginNext?: string;
};

export default function OutboxClient({ apiBase = "/api/superadmin/outbox", loginNext = "/superadmin/outbox" }: Props) {
  const [isPending, startTransition] = useTransition();

  const [status, setStatus] = useState<OutboxStatus>("FAILED");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);

  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);

  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const loginHref = useMemo(() => `/login?next=${encodeURIComponent(loginNext)}`, [loginNext]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    p.set("limit", String(limitClamp(limit)));
    return p.toString();
  }, [status, q, limit]);

  async function load() {
    setErr("");
    setMsg("");

    const res = await fetch(`${apiBase}/list?${qs}`, {
      headers: { "Cache-Control": "no-store" },
    });
    const json = await readJsonSafe(res);

    if (!res.ok) {
      const message = safeStr(json?.message) || "Kunne ikke hente outbox.";
      setErr(message);
      setRows([]);
      setCounts(null);

      if (res.status === 401 || res.status === 403) {
        setMsg("Ingen tilgang. Auth håndteres server-side; logg inn på nytt om nødvendig.");
      }
      return;
    }

    setCounts((json?.counts || null) as Counts | null);
    setRows((json?.rows || []) as Row[]);
    setLastUpdated(fmt(new Date().toISOString()));
  }

  async function runNow() {
    setErr("");
    setMsg("");

    const res = await fetch(`${apiBase}/run`, {
      method: "POST",
      headers: { "Cache-Control": "no-store" },
    });
    const json = await readJsonSafe(res);

    if (!res.ok) {
      const message = safeStr(json?.message) || "Kunne ikke kjøre outbox.";
      setErr(message);

      if (res.status === 401 || res.status === 403) {
        setMsg("Ingen tilgang. Auth håndteres server-side; logg inn på nytt om nødvendig.");
      }
      return;
    }

    const run = json?.run ?? json;
    const processed = run?.processed ?? 0;
    const sent = run?.sent ?? 0;
    const failed = run?.failed ?? 0;

    setMsg(`Kjøring OK: processed=${processed}, sent=${sent}, failed=${failed}`);
    await load();
  }

  function onLimitChange(v: string) {
    const n = Number(v);
    setLimit(limitClamp(Number.isFinite(n) ? n : 50));
  }

  useEffect(() => {
    startTransition(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, apiBase]);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Outbox – e-post backup</h1>
          <div className="text-sm opacity-70">
            {counts ? (
              <>
                PENDING: <span className="font-medium">{counts.PENDING}</span> · FAILED:{" "}
                <span className="font-medium">{counts.FAILED}</span> · SENT:{" "}
                <span className="font-medium">{counts.SENT}</span>
                {lastUpdated ? <span className="ml-3">Sist oppdatert: {lastUpdated}</span> : null}
              </>
            ) : (
              <>—{lastUpdated ? <span className="ml-3">Sist oppdatert: {lastUpdated}</span> : null}</>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as OutboxStatus)}
            disabled={isPending}
          >
            <option value="ALL">ALL</option>
            <option value="PENDING">PENDING</option>
            <option value="FAILED">FAILED</option>
            <option value="FAILED_PERMANENT">FAILED_PERMANENT</option>
            <option value="SENT">SENT</option>
          </select>

          <input
            className="w-64 rounded-xl border px-3 py-2 text-sm"
            placeholder="Søk event_key…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={isPending}
          />

          <input
            className="w-24 rounded-xl border px-3 py-2 text-sm"
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => onLimitChange(e.target.value)}
            disabled={isPending}
          />

          <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => startTransition(load)} disabled={isPending}>
            Oppdater
          </button>

          <button
            className="rounded-xl border px-3 py-2 text-sm"
            onClick={() => startTransition(runNow)}
            disabled={isPending}
            title="Prosesserer opptil 25 rader (PENDING/FAILED)"
          >
            Kjør nå (25)
          </button>
        </div>
      </div>

      {err ? (
        <div className="mb-3 rounded-2xl border p-3 text-sm">
          <div className="font-medium">Feil</div>
          <div className="opacity-80">{err}</div>
        </div>
      ) : null}

      {msg ? (
        <div className="mb-3 rounded-2xl border p-3 text-sm">
          <div>{msg}</div>
          {err && (err.includes("401") || err.includes("403") || msg.toLowerCase().includes("tilgang")) ? (
            <div className="mt-1 text-xs">
              <a className="underline" href={loginHref}>
                Gå til innlogging
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left font-medium">event_key</th>
              <th className="p-3 text-left font-medium">status</th>
              <th className="p-3 text-left font-medium">attempts</th>
              <th className="p-3 text-left font-medium">created</th>
              <th className="p-3 text-left font-medium">sent</th>
              <th className="p-3 text-left font-medium">last_error</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-4 opacity-70" colSpan={6}>
                  Ingen rader.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.event_key} className="border-b last:border-b-0">
                  <td className="p-3 font-mono text-xs">{r.event_key}</td>
                  <td className="p-3">
                    <span className={statusBadge(r.status)}>{r.status}</span>
                  </td>
                  <td className="p-3">{r.attempts}</td>
                  <td className="p-3">{fmt(r.created_at)}</td>
                  <td className="p-3">{fmt(r.sent_at)}</td>
                  <td className="p-3 max-w-xl truncate" title={r.last_error || ""}>
                    {r.last_error || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs opacity-60">Tips: “Kjør nå” prosesserer PENDING + FAILED.</div>
    </div>
  );
}
