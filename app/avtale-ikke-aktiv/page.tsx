import { Ban } from "lucide-react";

import { loadInactiveAgreementPageContext } from "@/lib/auth/inactiveAgreementGateRecovery";

import InactiveAgreementRecovery from "./InactiveAgreementRecovery.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InactiveAgreementPage() {
  const { showProviderRecovery } = await loadInactiveAgreementPageContext();

  return (
    <main className="ds-page ds-empty-state">
      <div className="ds-container">
        <div className="ds-text-limit ds-empty-state__limit">
          <div className="ds-empty-state__panel ds-fade-up" role="alert">
            <div className="ds-empty-state__icon-wrap" aria-hidden="true">
              <Ban />
            </div>

            <p className="ds-eyebrow">Tilgang stoppet</p>

            <h1 className="ds-h2">Avtalen er ikke aktiv</h1>

            <p className="ds-lead">
              Vi finner ikke en aktiv lunsjavtale for firmaet ditt akkurat nå. Logg ut og inn igjen, eller kontakt
              administrator hvis dette ikke stemmer.
            </p>

            <InactiveAgreementRecovery showProviderRecovery={showProviderRecovery} />
          </div>
        </div>
      </div>
    </main>
  );
}
