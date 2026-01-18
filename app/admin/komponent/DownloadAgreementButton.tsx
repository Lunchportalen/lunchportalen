"use client";

import { useState } from "react";

export default function DownloadAgreementButton() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setErr(null);

    try {
      const resp = await fetch("/api/agreements/my-latest", { method: "GET" });
      const json = await resp.json();

      if (!resp.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || "Kunne ikke hente avtalen.");
      }

      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message || "Noe gikk galt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-xl border px-4 py-2 text-sm disabled:opacity-60"
      >
        {loading ? "Henter avtale..." : "Last ned avtale (PDF)"}
      </button>
      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      <p className="text-xs opacity-70">
        Lenken er tidsbegrenset og åpnes i ny fane.
      </p>
    </div>
  );
}
