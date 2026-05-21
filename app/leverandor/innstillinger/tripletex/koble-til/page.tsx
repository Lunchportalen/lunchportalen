export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import DirectWizard from "@/components/provider/tripletex-wizard/DirectWizard";
import type { WizardScreen } from "@/components/provider/tripletex-wizard/types";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadProviderConnectionState } from "@/lib/integrations/tripletex/loadProviderConnectionState";
import { buildProviderTripletexWebhookUrl } from "@/lib/integrations/tripletex/providerWebhookUrl";

export default async function TripletexKobleTilPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    redirect("/login?next=%2Fleverandor%2Finnstillinger%2Ftripletex%2Fkoble-til");
  }

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canEdit = await hasProviderRole(auth.user.id, provider.id, "provider_admin");
  if (!canEdit) {
    return (
      <div className="ds-container">
        <h1 className="ds-h2">Koble til Tripletex</h1>
        <p className="ds-body">Kun provider-admin kan koble til Tripletex.</p>
      </div>
    );
  }

  const connection = await loadProviderConnectionState(provider.id);
  const state = connection?.state ?? "NOT_CONNECTED";

  if (state === "CONNECTED") {
    redirect("/leverandor/innstillinger/tripletex/status");
  }

  if (state === "DEGRADED") {
    return (
      <div className="ds-container ds-wizard">
        <h1 className="ds-h2">Tripletex trenger oppmerksomhet</h1>
        <p className="ds-body ds-text-limit">
          Tilkoblingen er degradert. Re-konfigureringsflyt kommer i TPT-B-7b-edge.
        </p>
        <span className="ds-status-badge ds-status-badge--degraded">Trenger oppmerksomhet</span>
      </div>
    );
  }

  if (state === "DISCONNECTED") {
    return (
      <div className="ds-container ds-wizard">
        <h1 className="ds-h2">Tripletex er frakoblet</h1>
        <p className="ds-body ds-text-limit">
          Gjenopprettingsflyt uten nytt token kommer i TPT-B-7b-edge.
        </p>
        <span className="ds-status-badge ds-status-badge--disconnected">Frakoblet</span>
      </div>
    );
  }

  let initialStep: WizardScreen = "token";
  if (state === "CONFIGURING") {
    initialStep = connection?.provisioningComplete ? "webhook" : "provisioning";
  }

  return (
    <div className="ds-container">
      <DirectWizard
        providerId={provider.id}
        providerName={provider.name}
        webhookUrl={buildProviderTripletexWebhookUrl(provider.id)}
        initialStep={initialStep}
        initialCompanyName={connection?.companyName ?? null}
      />
    </div>
  );
}
