"use client";

// app/admin/kitchen-test/test-client.tsx
import { useState } from "react";

export default function KitchenRpcTestClient() {
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setErr(null);
    setOut(null);

    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/kitchen/day?date=${encodeURIComponent(today)}`, { cache: "no-store" }).catch(
      (e) => ({ ok: false, error: e }),
    );

    setLoading(false);

    if (!res || typeof res !== "object" || !("ok" in res)) {
      setErr({ message: "Nettverksfeil mot /api/kitchen/day." });
      return;
    }

    const httpRes = res as Response;
    const body = await httpRes.json().catch(() => null);

    if (!httpRes.ok) {
      setErr(body ?? { message: `HTTP ${httpRes.status}` });
      return;
    }

    setOut(body);
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="rounded-full border px-4 py-2 text-sm"
        onClick={run}
        disabled={loading}
      >
        {loading ? "Kjører…" : "Test kitchen API (/api/kitchen/day)"}
      </button>
      {err ? (
        <pre className="overflow-auto rounded border bg-red-50 p-3 text-xs">{JSON.stringify(err, null, 2)}</pre>
      ) : null}
      {out ? (
        <pre className="overflow-auto rounded border bg-white p-3 text-xs">{JSON.stringify(out, null, 2)}</pre>
      ) : null}
    </div>
  );
}
