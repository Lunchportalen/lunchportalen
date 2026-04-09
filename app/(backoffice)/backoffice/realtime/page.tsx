"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SsePayload = { ts: number; rid?: string; tick?: string };

export default function RealtimeOpsPage() {
  const [events, setEvents] = useState<SsePayload[]>([]);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    setError(null);
    const es = new EventSource("/api/stream");

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SsePayload;
        setEvents((prev) => [data, ...prev].slice(0, 20));
      } catch {
        setError("Ugyldig SSE-data.");
      }
    };

    es.onerror = () => {
      setError("SSE avbrutt eller ikke tilgang. Krever superadmin og gyldig sesjon.");
      es.close();
    };

    return () => {
      es.close();
    };
  }, []);

  useEffect(() => {
    return connect();
  }, [connect]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 text-center sm:text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/backoffice/observability" className="text-sm text-slate-600 hover:text-slate-900">
          ← Observabilitet
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Sanntidsoperasjoner</h1>
        <p className="mt-1 text-sm text-slate-600">
          SSE fra <code className="text-xs">/api/stream</code> (superadmin). Hendelser vises nyeste først.
        </p>
      </div>

      {error ? <p className="text-sm text-amber-800">{error}</p> : null}

      <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-800 shadow-sm">
        {events.length === 0 ? (
          <li className="text-slate-600">Venter på første hendelse…</li>
        ) : (
          events.map((e, i) => (
            <li key={`${e.ts}-${i}`} className="tabular-nums">
              {new Date(e.ts).toISOString()}
              {e.rid ? <span className="ml-2 break-all text-xs text-slate-500">{e.rid}</span> : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
