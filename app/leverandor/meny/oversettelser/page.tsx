export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";

import ProviderMenuTranslationsPanel from "./ProviderMenuTranslationsPanel";

export default async function LeverandorMenyOversettelserPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fmeny%2Foversettelser");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const canWrite = await hasProviderRole(auth.user.id, provider.id, "provider_admin");
  const t = await getTranslations("provider.menu.translationsPage");

  return (
    <div className="ds-container">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">{t("eyebrow")}</p>
          <h1 className="ds-h2">{t("title")}</h1>
          <p className="ds-lead">{t("lead", { providerName: provider.name })}</p>
        </div>
        <Link href="/leverandor/meny" className="ds-btn">
          {t("backToMenu")}
        </Link>
      </header>
      <ProviderMenuTranslationsPanel canWrite={canWrite} />
    </div>
  );
}
