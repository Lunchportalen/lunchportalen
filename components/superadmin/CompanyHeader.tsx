// STATUS: KEEP

// components/superadmin/CompanyHeader.tsx
import { getCompanyById } from "@/lib/superadmin/queries";
import CompanyStatusControls from "./CompanyStatusControls";

export default async function CompanyHeader({ companyId }: { companyId: string }) {
  const company = await getCompanyById(companyId);

  return (
    <div className="rounded-2xl border bg-surface p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs text-muted">Firma</div>
          <div className="mt-1 text-xl font-semibold">{company.name}</div>
          <div className="mt-1 text-sm text-muted">Status: {company.status}</div>
        </div>

        {/* Client controls: type-to-confirm + actions */}
        <CompanyStatusControls
          companyId={company.id}
          companyName={company.name}
          currentStatus={company.status}
        />
      </div>
    </div>
  );
}
