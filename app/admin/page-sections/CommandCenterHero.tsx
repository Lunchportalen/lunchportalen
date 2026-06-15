import Link from "next/link";

import { AGREEMENT_HREF, INVITE_EMPLOYEES_HREF } from "@/lib/admin/dashboardOnboarding";

type CommandCenterHeroProps = {
  heading: string;
  subtext: string;
  agreementLabel: string;
  providerLabel: string;
  deliveryDays: string;
  onboarding: boolean;
  orderCountToday?: number;
};

export default function CommandCenterHero({
  heading,
  subtext,
  agreementLabel,
  providerLabel,
  deliveryDays,
  onboarding,
  orderCountToday = 0,
}: CommandCenterHeroProps) {
  const tertiary = onboarding
    ? `Levering følger avtalen ${deliveryDays.toLowerCase()}. Cut-off er 08:00.`
    : `${orderCountToday} bestillinger i dag · cut-off 08:00 · ${deliveryDays.toLowerCase()}`;

  return (
    <section className="ds-admin-command-hero" aria-label="Kommandosenter">
      <div className="ds-admin-command-hero__glow" aria-hidden="true" />
      <div className="ds-admin-command-hero__inner">
        <div className="ds-admin-command-hero__meta">
          <span className="ds-admin-command-hero__eyebrow">Firmaadministrator · Lunchportalen</span>
          <div className="ds-admin-command-hero__pills">
            <span className="ds-admin-command-hero__pill is-agreement">{agreementLabel}</span>
            <span className="ds-admin-command-hero__pill is-provider">{providerLabel}</span>
          </div>
        </div>

        <h1 className="ds-admin-command-hero__title">{heading}</h1>
        <p className="ds-admin-command-hero__sub">{subtext}</p>
        <p className="ds-admin-command-hero__tertiary">{tertiary}</p>

        <div className="ds-admin-command-hero__actions">
          {onboarding ? (
            <>
              <Link href={INVITE_EMPLOYEES_HREF} className="ds-btn ds-admin-command-hero__cta">
                Inviter ansatte
              </Link>
              <Link href={AGREEMENT_HREF} className="ds-btn ds-btn--ghost ds-admin-command-hero__cta-secondary">
                Se avtale
              </Link>
            </>
          ) : (
            <>
              <Link href="/admin/dagens-brukere" className="ds-btn ds-admin-command-hero__cta">
                Se dagens drift
              </Link>
              <Link href={INVITE_EMPLOYEES_HREF} className="ds-btn ds-btn--ghost ds-admin-command-hero__cta-secondary">
                Inviter ansatte
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
