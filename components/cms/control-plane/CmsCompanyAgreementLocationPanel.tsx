import { summarizeAgreementJson } from "@/lib/cms/backoffice/domainRuntimeOverviewShared";
import type { CompanyRowPreview } from "@/lib/cms/backoffice/domainRuntimeOverviewShared";

type CmsCompanyAgreementLocationPanelProps = {
  rows: CompanyRowPreview[];
  caption?: string;
};

export function CmsCompanyAgreementLocationPanel({ rows, caption }: CmsCompanyAgreementLocationPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="cap-panel-heading">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 id="cap-panel-heading" className="text-sm font-semibold text-slate-900">
          Firma · avtale (JSON) · lokasjoner
        </h2>
        {caption ? <p className="mt-1 text-xs text-slate-500">{caption}</p> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-2">Firma</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Tier (JSON)</th>
              <th className="px-4 py-2">Admin e-post</th>
              <th className="px-4 py-2">Lok.</th>
              <th className="px-4 py-2">Merknad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-500">
                  Ingen rader.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const s = summarizeAgreementJson(row.agreement_json);
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{row.name ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{row.status ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-800">{s.tierLabel ?? "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-xs text-slate-600">{s.adminEmail ?? "—"}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-800">{row.locationCount}</td>
                    <td className="max-w-[220px] truncate px-4 py-2 text-xs text-slate-600">{s.notice ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        Kilde: <code className="rounded bg-slate-100 px-1">companies</code> + <code className="rounded bg-slate-100 px-1">company_locations</code>.
        Full styring skjer i superadmin — dette er innsyn.
      </p>
    </section>
  );
}
