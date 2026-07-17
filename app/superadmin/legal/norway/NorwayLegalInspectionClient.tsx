"use client";

import { useState } from "react";

export function NorwayLegalInspectionClient() {
  const [subjectType, setSubjectType] = useState("company");
  const [subjectId, setSubjectId] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setResult(null);
    const res = await fetch(
      `/api/superadmin/legal/norway/acceptances?subjectType=${encodeURIComponent(subjectType)}&subjectId=${encodeURIComponent(subjectId.trim())}`,
      { cache: "no-store" },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      setError(String(json?.message || json?.error || "Kunne ikke hente aksept."));
      return;
    }
    setResult(json.data);
  }

  return (
    <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Akseptstatus for subjekt</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        <select
          className="min-h-11 rounded-xl border px-3"
          value={subjectType}
          onChange={(e) => setSubjectType(e.target.value)}
        >
          <option value="company">company</option>
          <option value="provider">provider</option>
          <option value="employee">employee</option>
        </select>
        <input
          className="min-h-11 min-w-[280px] flex-1 rounded-xl border px-3"
          placeholder="subjectId (uuid)"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        />
        <button
          type="button"
          className="min-h-11 rounded-full border px-5 text-sm font-semibold"
          onClick={() => void load()}
        >
          Hent
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {result ? (
        <pre className="mt-4 max-h-[480px] overflow-auto rounded-xl bg-neutral-50 p-3 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
