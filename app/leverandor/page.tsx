// app/leverandor/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import LocaleSwitcher from "@/components/nav/LocaleSwitcher";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getVerifiedSanityStudioBaseUrl } from "@/lib/cms/sanityStudioUrl";
import { formatProviderRevenue, loadProviderDashboard } from "@/lib/providers/loadProviderDashboard";
import {
  buildProviderFollowUps,
  mapProviderDashboardActivity,
  type ProviderFollowUpItem,
} from "@/lib/providers/providerDashboardActivity";
import { PROVIDER_AGREEMENTS_KPI_COPY } from "@/lib/providers/providerDashboardKpis";

const FOLLOW_UP_MESSAGE_KEYS: Record<string, { title: string; text: string; action: string }> = {
  "menu-editing-disabled": {
    title: "menuEditingDisabled.title",
    text: "menuEditingDisabled.text",
    action: "menuEditingDisabled.action",
  },
  "no-orders-this-week": {
    title: "noOrdersThisWeek.title",
    text: "noOrdersThisWeek.text",
    action: "noOrdersThisWeek.action",
  },
  "no-revenue-30d": {
    title: "noRevenue30d.title",
    text: "noRevenue30d.text",
    action: "noRevenue30d.action",
  },
};

function translateFollowUp(
  item: ProviderFollowUpItem,
  t: Awaited<ReturnType<typeof getTranslations<"provider.dashboard">>>,
): ProviderFollowUpItem {
  const keys = FOLLOW_UP_MESSAGE_KEYS[item.id];
  if (!keys) return item;
  return {
    ...item,
    title: t(`followUp.${keys.title}`),
    text: t(`followUp.${keys.text}`),
    actionLabel: t(`followUp.${keys.action}`),
  };
}

function translateActivity(
  item: ReturnType<typeof mapProviderDashboardActivity>[number],
  t: Awaited<ReturnType<typeof getTranslations<"provider.dashboard">>>,
) {
  return {
    ...item,
    title: t(`activity.${item.messageId}.title`),
    description: t(`activity.${item.messageId}.description`),
  };
}

export default async function LeverandorDashboardPage() {
  const t = await getTranslations("provider.dashboard");
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

  const activity = mapProviderDashboardActivity(recentActivity).map((item) => translateActivity(item, t));
  const followUps = buildProviderFollowUps({
    menuEditingEnabled,
    ordersThisWeek: stats.ordersThisWeek,
    activeCustomers: stats.activeCustomers,
    revenueLast30DaysNok: stats.revenueLast30DaysNok,
  }).map((item) => translateFollowUp(item, t));

  const kpis: Array<{ label: string; value: string; foot: string; href?: string; linkTitle?: string }> = [
    {
      label: t("activeCustomers"),
      value: String(stats.activeCustomers),
      foot: t("activeCustomersFoot"),
    },
    {
      label: t("activeAgreements"),
      value: String(stats.activeAgreements),
      foot: t("activeAgreementsFoot"),
      href: PROVIDER_AGREEMENTS_KPI_COPY.href,
      linkTitle: t("activeAgreementsLinkTitle"),
    },
    {
      label: t("ordersThisWeek"),
      value: String(stats.ordersThisWeek),
      foot: t("ordersThisWeekFoot"),
    },
    {
      label: t("revenueLast30Days"),
      value: formatProviderRevenue(stats.revenueLast30DaysNok),
      foot: t("revenueLast30DaysFoot"),
    },
  ];

  const quickActions = [
    {
      href: "/leverandor/ordrer",
      title: t("quickActionOrdersTitle"),
      text: t("quickActionOrdersText"),
    },
    {
      href: "/leverandor/kunder",
      title: t("quickActionCustomersTitle"),
      text: t("quickActionCustomersText"),
    },
    {
      href: "/leverandor/meny",
      title: t("quickActionMenuTitle"),
      text: menuEditingEnabled ? t("quickActionMenuTextEnabled") : t("quickActionMenuTextDisabled"),
    },
  ];

  return (
    <div className="ds-container">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">{t("eyebrow")}</p>
          <h1 className="ds-h2">{provider.name}</h1>
          <p className="ds-lead">{t("lead")}</p>
        </div>
        <LocaleSwitcher className="ds-provider-topbar__locale" persistProfile />
      </header>

      <section className="ds-section" aria-label={t("kpiSection")}>
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

      <section className="ds-section" aria-label={t("followUpSection")}>
        <h2 className="ds-h2">{t("followUpSection")}</h2>
        {followUps.length === 0 ? (
          <div className="ds-provider-empty">
            <p className="ds-provider-empty__title">{t("followUpAllClearTitle")}</p>
            <p className="ds-provider-empty__text">{t("followUpAllClearText")}</p>
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

      <section className="ds-section" aria-label={t("quickActionsSection")}>
        <h2 className="ds-h2">{t("quickActionsSection")}</h2>
        <div className="ds-provider-quick-grid">
          {quickActions.map((action) => (
            <Link href={action.href} className="ds-card" key={action.href}>
              <h3 className="ds-card__title">{action.title}</h3>
              <p className="ds-card__text">{action.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="ds-section" aria-label={t("recentActivitySection")}>
        <h2 className="ds-h2">{t("recentActivitySection")}</h2>
        {activity.length === 0 ? (
          <div className="ds-provider-empty">
            <p className="ds-provider-empty__title">{t("activityEmptyTitle")}</p>
            <p className="ds-provider-empty__text">{t("activityEmptyText")}</p>
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
