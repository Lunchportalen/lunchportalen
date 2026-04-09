"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type QueuedAction = {
  id: string;
  type: string;
  payload?: unknown;
  status: string;
};

type QueuePayload = { queue: QueuedAction[] };
type ApiOk<T> = { ok: true; rid: string; data: T };
type ApiErr = { ok: false; rid: string; message: string };

export default function ExecutionControlPage() {
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/execution/queue", { credentials: "include" });
      const j = (await r.json()) as ApiOk<QueuePayload> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke hente kø.";
        setError(msg);
        setQueue([]);
        return;
      }
      setQueue(Array.isArray(j.data.queue) ? j.data.queue : []);
    } catch {
      setError("Nettverksfeil.");
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/execution/approve", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = (await r.json()) as ApiOk<{ id: string }> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Godkjenning feilet.";
        setError(msg);
        return;
      }
      await load();
    } catch {
      setError("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  };

  const runPipeline = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/execution/run", {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as ApiOk<{ processed: number }> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kjøring feilet.";
        setError(msg);
        return;
      }
      await load();
    } catch {
      setError("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 text-center sm:text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/ai" className="text-sm text-slate-600 hover:text-slate-900">
          ← AI Command Center
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Execution Control</h1>
        <p className="mt-1 text-sm text-slate-600">
          Kø i minne per instans — ingen kjøring før godkjenning. Alle steg logges i revisjonssystemet.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55 disabled:opacity-50"
          onClick={() => void load()}
          disabled={busy || loading}
        >
          Oppdater kø
        </button>
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55 disabled:opacity-50"
          onClick={() => void runPipeline()}
          disabled={busy || loading}
        >
          Kjør godkjente
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && queue.length === 0 ? (
        <p className="text-sm text-slate-600">Køen er tom.</p>
      ) : null}

      <ul className="space-y-4">
        {queue.map((a) => (
          <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
            <div className="text-sm font-medium text-slate-900">{a.type}</div>
            <div className="mt-1 font-mono text-xs text-slate-500">{a.id}</div>
            <div className="mt-2 text-sm text-slate-700">Status: {a.status}</div>
            {a.status === "pending" ? (
              <button
                type="button"
                className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55 disabled:opacity-50"
                onClick={() => void approve(a.id)}
                disabled={busy}
              >
                Godkjenn
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
