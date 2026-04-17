import { summarizeAgreementJson } from "@/lib/cms/backoffice/domainRuntimeOverviewShared";
import type { CompanyRowPreview } from "@/lib/cms/backoffice/domainRuntimeOverviewShared";
import { summarizeAgreementScheduleForCms } from "@/lib/cms/backoffice/agreementScheduleAbbrev";

type CmsAgreementRuntimePreviewTableProps = {
  rows: CompanyRowPreview[];
};

export function CmsAgreementRuntimePreviewTable({ rows }: CmsAgreementRuntimePreviewTableProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="art-preview-heading">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 id="art-preview-heading" className="text-sm font-semibold text-slate-900">
          Plan (man–fre), binding og merknad — fra agreement_json der mulig
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Radene normaliseres med <code className="rounded bg-slate-100 px-1">normalizeAgreement</code>. Ved feil vises «—» for
          plan — full avtalegrid finnes i company admin / superadmin.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-2">Firma</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Man→fre (tier)</th>
              <th className="px-4 py-2">Binding / oppsigelse</th>
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
                const base = summarizeAgreementJson(row.agreement_json);
                const sched = summarizeAgreementScheduleForCms(row.agreement_json);
                const plan =
                  sched.ok === true
                    ? sched.dayTiers.map((d) => `${d.day.slice(0, 2)}:${d.tier}`).join(" ")
                    : "—";
                const bind =
                  sched.ok === true ? `${sched.bindingMonths} mnd / ${sched.noticeMonths} mnd` : "—";
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{row.name ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{row.status ?? "—"}</td>
                    <td className="max-w-[280px] px-4 py-2 font-mono text-[11px] text-slate-800">{plan}</td>
                    <td className="px-4 py-2 text-xs text-slate-700">{bind}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-800">{row.locationCount}</td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-xs text-slate-600">{base.notice ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
