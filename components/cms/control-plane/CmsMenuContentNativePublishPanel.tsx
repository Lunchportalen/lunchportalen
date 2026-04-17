"use client";

import { useState } from "react";

/**
 * CP7 — Native in-CMS publish control: broker til Sanity Actions API (samme publish som Studio).
 * Krever superadmin + SANITY_WRITE_TOKEN på server; ellers fail-closed fra API.
 */
export function CmsMenuContentNativePublishPanel() {
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/backoffice/sanity/menu-content/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: date.trim() }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: string; data?: { published?: boolean; reason?: string } };
      if (!res.ok || j?.ok === false) {
        setMsg(j?.message ?? "Kunne ikke publisere.");
        return;
      }
      const published = j?.data?.published === true;
      const reason = j?.data?.reason;
      setMsg(
        published
          ? "Publisert: utkast er flyttet til publisert perspektiv (samme som Studio Publish)."
          : 'Ingen draft å publisere for denne datoen i Sanity. Hvis du forventet endring: rediger i Studio først, eller bekreft at det finnes et utkast (menuContent). ' +
              (reason ? `(${reason})` : "")
      );
    } catch {
      setMsg("Nettverksfeil.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby="native-menucontent-publish-heading"
    >
      <h3 id="native-menucontent-publish-heading" className="text-base font-semibold text-slate-900">
        Publiser operativ meny (server-broker)
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        Publiserer <code className="rounded bg-slate-100 px-1 text-xs">menuContent</code>-utkast for valgt dato via Sanity
        Actions API — samme semantikk som «Publish» i Studio. Ansatt uke (
        <code className="rounded bg-slate-100 px-1 text-xs">GET /api/week</code>) leser publisert perspektiv som før.
      </p>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={onSubmit}>
        <label className="flex min-w-[200px] flex-col gap-1 text-sm">
          <span className="font-medium text-slate-800">Dato (YYYY-MM-DD)</span>
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900"
            type="text"
            inputMode="numeric"
            placeholder="2026-04-07"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !date.trim()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Publiserer…" : "Publiser draft"}
        </button>
      </form>
      {msg ? (
        <p className="mt-3 text-sm text-slate-700" role="status">
          {msg}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">
        Krever innlogget superadmin og <code className="rounded bg-slate-100 px-1">SANITY_WRITE_TOKEN</code> i runtime.
        Uten token returnerer API 503 (fail-closed).
      </p>
    </section>
  );
}
