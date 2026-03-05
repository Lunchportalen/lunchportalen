"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FormRow = {
  id: string;
  name: string;
  environment: string;
  locale: string;
  updated_at: string;
};

export default function FormsPage() {
  const router = useRouter();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [env, setEnv] = useState<"prod" | "staging">("prod");
  const [name, setName] = useState("");
  const [locale, setLocale] = useState<"nb" | "en">("nb");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backoffice/forms?environment=${env}`);
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Ikke innlogget"
            : res.status === 403
            ? "Krever superadmin"
            : `Feil ${res.status}`
        );
      }
      const data = await res.json();
      if (data?.ok && Array.isArray(data.forms)) {
        setForms(data.forms as FormRow[]);
      } else {
        setForms([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste skjemaer");
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, [env]);

  useEffect(() => {
    void fetchForms();
  }, [fetchForms]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), environment: env, locale }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Feil ${res.status}`);
      }
      const data = await res.json();
      setName("");
      await fetchForms();
      if (data?.form?.id) {
        router.push(`/backoffice/forms/${encodeURIComponent(data.form.id)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke opprette skjema");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleString("nb-NO") : "—";

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900">Forms</h1>
      <p className="mt-1 text-sm text-slate-600">
        Enkle skjemaer for landingssider og innhold. Kun superadmin i MVP.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">Miljø:</span>
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value as "prod" | "staging")}
            className="rounded border border-slate-200 px-2 py-1 text-sm"
          >
            <option value="prod">prod</option>
            <option value="staging">staging</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Navn på nytt skjema"
            className="w-56 rounded border border-slate-200 px-3 py-1.5 text-sm"
          />
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as "nb" | "en")}
            className="rounded border border-slate-200 px-2 py-1 text-sm"
          >
            <option value="nb">nb</option>
            <option value="en">en</option>
          </select>
          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting || !name.trim()}
            className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Oppretter…" : "Nytt skjema"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">
                Navn
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">
                Locale
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">
                Oppdatert
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  className="px-3 py-3 text-sm text-slate-500"
                  colSpan={3}
                >
                  Laster…
                </td>
              </tr>
            ) : forms.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-3 text-sm text-slate-500"
                  colSpan={3}
                >
                  Ingen skjemaer.
                </td>
              </tr>
            ) : (
              forms.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-2 align-top">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/backoffice/forms/${encodeURIComponent(f.id)}`
                        )
                      }
                      className="text-slate-900 hover:underline"
                    >
                      {f.name}
                    </button>
                  </td>
                  <td className="px-3 py-2 align-top text-slate-600">
                    {f.locale}
                  </td>
                  <td className="px-3 py-2 align-top text-slate-600">
                    {formatDate(f.updated_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

