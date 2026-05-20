// app/leverandor/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";

import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { formatProviderRevenue, loadProviderDashboard } from "@/lib/providers/loadProviderDashboard";

function formatTs(iso: string) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Oslo",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function truncateReason(reason: string | null, max = 80) {
  const t = String(reason ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

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

  const kpis = [
    { label: "Aktive kunder", value: String(stats.activeCustomers), foot: "Ikke suspendert eller pauset" },
    { label: "Aktive avtaler", value: String(stats.activeAgreements), foot: "Status ACTIVE" },
    { label: "Ordrer denne uken", value: String(stats.ordersThisWeek), foot: "ISO-uke, status ACTIVE" },
    {
      label: "Omsetning siste 30 dager",
      value: formatProviderRevenue(stats.revenueLast30DaysNok),
      foot: "Sum line_total på ordrer",
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
      </header>

      <section className="ds-section" aria-label="Nøkkeltall">
        <div className="ds-admin-kpi-row">
          {kpis.map((item) => (
            <div className="ds-admin-kpi" key={item.label}>
              <div className="ds-admin-kpi__label">{item.label}</div>
              <div className="ds-admin-kpi__value">{item.value}</div>
              <div className="ds-admin-kpi__foot">{item.foot}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="ds-section" aria-label="Hurtighandlinger">
        <h2 className="ds-h2">Hurtighandlinger</h2>
        <div className="ds-provider-quick-grid">
          <Link href="/leverandor/kunder/ny" className="ds-card">
            <h3 className="ds-card__title">Legg til kunde</h3>
            <p className="ds-card__text">Registrer ny bedrift (Patch 13).</p>
          </Link>
          <Link href="/leverandor/kunder" className="ds-card">
            <h3 className="ds-card__title">Se kunder</h3>
            <p className="ds-card__text">
              {stats.ordersThisWeek} ordrer denne uken · administrer kunder.
            </p>
          </Link>
          <div className="ds-card ds-provider-nav__item is-disabled">
            <h3 className="ds-card__title">Oppdater meny</h3>
            <p className="ds-card__text">Meny-redigering kommer i Patch 11.</p>
          </div>
        </div>
      </section>

      <section className="ds-section" aria-label="Siste aktivitet">
        <h2 className="ds-h2">Siste aktivitet</h2>
        {recentActivity.length === 0 ? (
          <p className="ds-body">Ingen registrerte hendelser ennå.</p>
        ) : (
          <div className="ds-provider-activity">
            {recentActivity.map((row) => (
              <article className="ds-provider-activity__row" key={row.id}>
                <div className="ds-provider-activity__meta">{formatTs(row.createdAt)}</div>
                <div className="ds-provider-activity__action">
                  {row.action} · {row.entityType}
                </div>
                {truncateReason(row.reason) ? (
                  <p className="ds-body ds-provider-activity__meta--desktop">{truncateReason(row.reason)}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
