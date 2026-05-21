export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";

import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadProviderConnectionState } from "@/lib/integrations/tripletex/loadProviderConnectionState";

export default async function TripletexStatusPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    redirect("/login?next=%2Fleverandor%2Finnstillinger%2Ftripletex%2Fstatus");
  }

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_admin");
  if (!canView) {
    return (
      <div className="ds-container">
        <h1 className="ds-h2">Tripletex-status</h1>
        <p className="ds-body">Kun provider-admin har tilgang.</p>
      </div>
    );
  }

  const connection = await loadProviderConnectionState(provider.id);
  const state = connection?.state ?? "NOT_CONNECTED";

  if (state === "NOT_CONNECTED") {
    redirect("/leverandor/innstillinger/tripletex/koble-til");
  }

  const badgeClass =
    state === "CONNECTED"
      ? "ds-status-badge--connected"
      : state === "CONFIGURING"
        ? "ds-status-badge--configuring"
        : state === "DEGRADED"
          ? "ds-status-badge--degraded"
          : "ds-status-badge--disconnected";

  const badgeLabel =
    state === "CONNECTED"
      ? "Tilkoblet"
      : state === "CONFIGURING"
        ? "Konfigurerer…"
        : state === "DEGRADED"
          ? "Trenger oppmerksomhet"
          : "Frakoblet";

  return (
    <div className="ds-container">
      <header className="ds-section">
        <p className="ds-eyebrow">Tripletex</p>
        <h1 className="ds-h2">Tilkoblingsstatus</h1>
        <p className="ds-lead">Placeholder for TPT-B-7c dashboard.</p>
      </header>

      <section className="ds-surface">
        <span className={`ds-status-badge ${badgeClass}`}>{badgeLabel}</span>
        {connection?.companyName ? (
          <p className="ds-body">Selskap: {connection.companyName}</p>
        ) : null}
        {state === "CONFIGURING" ? (
          <Link className="ds-btn ds-btn--primary" href="/leverandor/innstillinger/tripletex/koble-til">
            Fortsett oppsett
          </Link>
        ) : null}
      </section>
    </div>
  );
}
