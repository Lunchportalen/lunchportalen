// app/superadmin/firms/[companyId]/page.tsx
import CompanyHeader from "@/components/superadmin/CompanyHeader";
import CompanyAgreement from "@/components/superadmin/CompanyAgreement";
import CompanyDeliveries from "@/components/superadmin/CompanyDeliveries";
import CompanyQuality from "@/components/superadmin/CompanyQuality";
import CompanyAudit from "@/components/superadmin/CompanyAudit";

export default function CompanyPage({ params }: { params: { companyId: string } }) {
  return (
    <div className="space-y-6">
      <CompanyHeader companyId={params.companyId} />
      <CompanyAgreement companyId={params.companyId} />
      <CompanyDeliveries companyId={params.companyId} />
      <CompanyQuality companyId={params.companyId} />
      <CompanyAudit companyId={params.companyId} />
    </div>
  );
}
