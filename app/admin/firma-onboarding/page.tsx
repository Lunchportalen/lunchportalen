// app/admin/firma-onboarding/page.tsx
export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import AdminPageShell from "@/components/admin/AdminPageShell";
import FirmaOnboardingWizard from "@/components/onboarding/FirmaOnboardingWizard";
import { loadFirmaOnboardingCms } from "@/lib/onboarding/loadFirmaOnboardingCms";

export default async function FirmaOnboardingPage() {
  const cms = await loadFirmaOnboardingCms();

  return (
    <div className="lp-container py-8">
      <AdminPageShell
        title="Firmaoppsett"
        subtitle="Veiviser: plan, leveringsdager, meny og lokasjon — steg for steg. Ingen ugyldige kombinasjoner."
      >
        <FirmaOnboardingWizard cms={cms} />
      </AdminPageShell>
    </div>
  );
}
