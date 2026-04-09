"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type QueuePayload = {
  count: number;
  leads: Array<{ company: string; pain: string; idempotencyKey: string | null }>;
};

type RunPayload = {
  results: Array<{ lead: QueuePayload["leads"][number]; msg: string }>;
  count: number;
};

type ApiOk<T> = { ok: true; rid: string; data: T };
type ApiErr = { ok: false; rid: string; message: string };

export default function SdrWorkbenchPage() {
  const [queue, setQueue] = useState<QueuePayload | null>(null);
  const [runOut, setRunOut] = useState<RunPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [pain, setPain] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/sdr/queue", { credentials: "include" });
      const j = (await r.json()) as ApiOk<QueuePayload> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke laste kø.";
        setError(msg);
        setQueue(null);
        return;
      }
      setQueue(j.data);
    } catch {
      setError("Nettverksfeil.");
      setQueue(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const enqueue = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/sdr/queue", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company, pain }),
      });
      const j = (await r.json()) as ApiOk<{ queued: number }> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "Kunne ikke legge til lead.";
        setError(msg);
        return;
      }
      setCompany("");
      setPain("");
      await loadQueue();
    } catch {
      setError("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  };

  const runBatch = async () => {
    setBusy(true);
    setError(null);
    setRunOut(null);
    try {
      const r = await fetch("/api/sdr/run", {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as ApiOk<RunPayload> | ApiErr;
      if (!r.ok || !j || typeof j !== "object" || !("ok" in j) || j.ok !== true) {
        const msg =
          (j as ApiErr).message && typeof (j as ApiErr).message === "string"
            ? (j as ApiErr).message
            : "SDR-kjøring feilet.";
        setError(msg);
        return;
      }
      setRunOut(j.data);
      await loadQueue();
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
        <h1 className="font-heading text-xl font-semibold text-slate-900">AI SDR (utkast)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Legg leads i kø, kjør generering (superadmin). Ingen automatisk utsending — kun utkast og revisjonslogg.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Laster kø…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && queue ? (
        <p className="text-sm text-slate-700">
          Kø: <span className="font-medium tabular-nums">{queue.count}</span> lead(s)
        </p>
      ) : null}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
        <label className="block text-sm font-medium text-slate-800">Selskap</label>
        <input
          className="w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={busy}
          autoComplete="organization"
        />
        <label className="block text-sm font-medium text-slate-800">Smerte / behov</label>
        <textarea
          className="min-h-[88px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={pain}
          onChange={(e) => setPain(e.target.value)}
          disabled={busy}
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55 disabled:opacity-50"
            onClick={() => void enqueue()}
            disabled={busy || !company.trim() || !pain.trim()}
          >
            Legg i kø
          </button>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-800 transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/55 disabled:opacity-50"
            onClick={() => void runBatch()}
            disabled={busy || !queue || queue.count === 0}
          >
            Generer utkast (batch)
          </button>
        </div>
      </div>

      {runOut && runOut.results.length > 0 ? (
        <div className="mt-4 space-y-3 text-left">
          <h2 className="text-sm font-semibold text-slate-900">Siste kjøring ({runOut.count})</h2>
          <ul className="space-y-3 text-sm text-slate-800">
            {runOut.results.map((row, i) => (
              <li key={i} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <p className="font-medium">{row.lead.company}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{row.msg}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
