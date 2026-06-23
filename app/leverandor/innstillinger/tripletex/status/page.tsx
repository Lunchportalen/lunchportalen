export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import StatusDashboardClient from "@/components/provider/tripletex-status/StatusDashboardClient";
import { getDashboardDataAction } from "@/app/leverandor/innstillinger/tripletex/status/actions";
import { canAccessProvider, hasProviderRole } from "@/lib/auth/provider";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";

export default async function TripletexStatusPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    redirect("/login?next=%2Fleverandor%2Finnstillinger%2Ftripletex%2Fstatus");
  }

  const t = await getTranslations("provider.tripletex.page.status");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await canAccessProvider(auth.user.id, provider.id);
  if (!canView) {
    return (
      <div className="ds-container">
        <h1 className="ds-h2">{t("fallbackHeading")}</h1>
        <p className="ds-body">{t("noAccess")}</p>
      </div>
    );
  }

  const dashboardRes = await getDashboardDataAction({ providerId: provider.id });
  if (dashboardRes.ok === false) {
    return (
      <div className="ds-container">
        <h1 className="ds-h2">{t("fallbackHeading")}</h1>
        <p className="ds-body">{dashboardRes.error}</p>
      </div>
    );
  }

  const { state } = dashboardRes.data;

  if (state === "NOT_CONNECTED") {
    redirect("/leverandor/innstillinger/tripletex/koble-til");
  }

  const isAdmin =
    (await hasProviderRole(auth.user.id, provider.id, "provider_admin")) ||
    (await isSuperadminProfile(auth.user.id));

  return (
    <div className="ds-page">
      <div className="ds-container">
        <header className="ds-section">
          <p className="ds-eyebrow">{t("eyebrow")}</p>
          <h1 className="ds-h2">{t("heading")}</h1>
          <p className="ds-lead">{t("subheading")}</p>
        </header>

        <StatusDashboardClient
          providerId={provider.id}
          isAdmin={isAdmin}
          initialData={dashboardRes.data}
        />
      </div>
    </div>
  );
}
