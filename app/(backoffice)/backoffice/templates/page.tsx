"use client";

import { documentTypes } from "../content/_components/documentTypes";

export default function TemplatesPage() {
  const templates = Array.isArray(documentTypes) ? documentTypes : [];

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900">Maler</h1>
      <p className="mt-1 text-sm text-slate-600">
        Oversikt over tilgjengelige dokumenttyper i editoren. Listen er skrivebeskyttet og hentes direkte fra dokumenttype‑registeret.
      </p>

      {templates.length === 0 ? (
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Ingen dokumenttyper registrert. Opprett eller utvid dokumenttyper i dokumenttype‑registeret.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  Navn
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  Alias
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  Tillatte underdokumenter
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                  Bruk
                </th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => {
                const allowed =
                  Array.isArray(t.allowedChildren) && t.allowedChildren.length > 0
                    ? t.allowedChildren.join(", ")
                    : "Ingen (ingen undernoder)";
                return (
                  <tr key={t.alias} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-900">
                      {t.name}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 font-mono text-xs text-slate-600">
                      {t.alias}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {allowed}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-500">
                      Bruk ikke tilgjengelig ennå
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
