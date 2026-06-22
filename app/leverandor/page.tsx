// app/leverandor/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";

import LocaleSwitcher from "@/components/nav/LocaleSwitcher";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getVerifiedSanityStudioBaseUrl } from "@/lib/cms/sanityStudioUrl";
import { formatProviderRevenue, loadProviderDashboard } from "@/lib/providers/loadProviderDashboard";
import {
  PROVIDER_ACTIVITY_EMPTY_STATE,
  PROVIDER_FOLLOW_UP_ALL_CLEAR,
  buildProviderFollowUps,
  mapProviderDashboardActivity,
} from "@/lib/providers/providerDashboardActivity";
import { PROVIDER_AGREEMENTS_KPI_COPY } from "@/lib/providers/providerDashboardKpis";

export default async function LeverandorDashboardPage() {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/login?next=%2Fleverandor");

  const hasProviderAdmin = ctx.memberships.some((m) => m.role === "provider_admin");
  if (ctx.role === "provider_kitchen" && !hasProviderAdmin) {
    redirect("/leverandor/ordrer");
  }

  const { stats, recentActivity } = await loadProviderDashboard(provider.id);

  // Samme sannhetskilde som /leverandor/meny (PR #167): kun verifisert env
  // aktiverer ekstern menyredigering.
  const menuEditingEnabled = Boolean(getVerifiedSanityStudioBaseUrl());

  const activity = mapProviderDashboardActivity(recentActivity);
  const followUps = buildProviderFollowUps({
    menuEditingEnabled,
    ordersThisWeek: stats.ordersThisWeek,
    activeCustomers: stats.activeCustomers,
    revenueLast30DaysNok: stats.revenueLast30DaysNok,
  });

  const kpis: Array<{ label: string; value: string; foot: string; href?: string; linkTitle?: string }> = [
    { label: "Aktive kunder", value: String(stats.activeCustomers), foot: "Bedrifter med aktiv lunsjordning" },
    {
      label: PROVIDER_AGREEMENTS_KPI_COPY.label,
      value: String(stats.activeAgreements),
      foot: PROVIDER_AGREEMENTS_KPI_COPY.foot,
      href: PROVIDER_AGREEMENTS_KPI_COPY.href,
      linkTitle: PROVIDER_AGREEMENTS_KPI_COPY.linkTitle,
    },
    { label: "Ordrer denne uken", value: String(stats.ordersThisWeek), foot: "Bestillinger i inneværende uke" },
    {
      label: "Ordreverdi siste 30 dager",
      value: formatProviderRevenue(stats.revenueLast30DaysNok),
      foot: "Samlet ordreverdi",
    },
  ];

  const quickActions = [
    {
      href: "/leverandor/ordrer",
      title: "Se dagens leveranser",
      text: "Få oversikt over ordre og produksjon for neste leveringsdag.",
    },
    {
      href: "/leverandor/kunder",
      title: "Se kunder",
      text: "Administrer bedrifter, avtaler og leveringsoppsett.",
    },
    {
      href: "/leverandor/meny",
      title: "Meny og publisering",
      text: menuEditingEnabled
        ? "Administrer menyinnholdet som vises for kundene."
        : "Se status for menyinnhold og provider-redigering.",
    },
  ];

  return (
    <div className="ds-container">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Leverandør</p>
          <h1 className="ds-h2">{provider.name}</h1>
          <p className="ds-lead">Oversikt over kunder, avtaler og drift.</p>
        </div>
        <LocaleSwitcher className="ds-provider-topbar__locale" persistProfile />
      </header>

      <section className="ds-section" aria-label="Nøkkeltall">
        <div className="ds-admin-kpi-row">
          {kpis.map((item) =>
            item.href ? (
              <Link
                href={item.href}
                title={item.linkTitle}
                className="ds-admin-kpi ds-admin-kpi--link"
                key={item.label}
              >
                <div className="ds-admin-kpi__label">{item.label}</div>
                <div className="ds-admin-kpi__value">{item.value}</div>
                <div className="ds-admin-kpi__foot">{item.foot}</div>
              </Link>
            ) : (
              <div className="ds-admin-kpi" key={item.label}>
                <div className="ds-admin-kpi__label">{item.label}</div>
                <div className="ds-admin-kpi__value">{item.value}</div>
                <div className="ds-admin-kpi__foot">{item.foot}</div>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="ds-section" aria-label="Må følges opp">
        <h2 className="ds-h2">Må følges opp</h2>
        {followUps.length === 0 ? (
          <div className="ds-provider-empty">
            <p className="ds-provider-empty__title">{PROVIDER_FOLLOW_UP_ALL_CLEAR.title}</p>
            <p className="ds-provider-empty__text">{PROVIDER_FOLLOW_UP_ALL_CLEAR.text}</p>
          </div>
        ) : (
          <div className="ds-provider-followup-grid">
            {followUps.map((item) => (
              <article className={`ds-card ds-provider-followup ds-provider-followup--${item.tone}`} key={item.id}>
                <h3 className="ds-card__title">{item.title}</h3>
                <p className="ds-card__text">{item.text}</p>
                <Link href={item.href} className="ds-provider-followup__action">
                  {item.actionLabel}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="ds-section" aria-label="Hurtighandlinger">
        <h2 className="ds-h2">Hurtighandlinger</h2>
        <div className="ds-provider-quick-grid">
          {quickActions.map((action) => (
            <Link href={action.href} className="ds-card" key={action.href}>
              <h3 className="ds-card__title">{action.title}</h3>
              <p className="ds-card__text">{action.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="ds-section" aria-label="Siste aktivitet">
        <h2 className="ds-h2">Siste aktivitet</h2>
        {activity.length === 0 ? (
          <div className="ds-provider-empty">
            <p className="ds-provider-empty__title">{PROVIDER_ACTIVITY_EMPTY_STATE.title}</p>
            <p className="ds-provider-empty__text">{PROVIDER_ACTIVITY_EMPTY_STATE.text}</p>
          </div>
        ) : (
          <div className="ds-provider-activity">
            {activity.map((item) => (
              <article className="ds-provider-activity__row" key={item.id}>
                <div className="ds-provider-activity__meta">{item.timeLabel}</div>
                <div className="ds-provider-activity__action">
                  <span className={`ds-provider-activity__dot ds-provider-activity__dot--${item.tone}`} aria-hidden />
                  {item.title}
                </div>
                {item.description ? (
                  <p className="ds-body ds-provider-activity__meta--desktop">{item.description}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
