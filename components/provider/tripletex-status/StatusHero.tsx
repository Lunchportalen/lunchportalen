"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import {
  formatTripletexDateTime,
  formatTripletexRelative,
  resolveTripletexConnectionStateLabel,
} from "@/lib/integrations/tripletex/tripletexStatusPresentation";

import type { DashboardData } from "@/app/leverandor/innstillinger/tripletex/status/actions";

type Props = {
  data: DashboardData;
};

function badgeClass(state: string): string {
  if (state === "CONNECTED") return "ds-status-badge--connected";
  if (state === "CONFIGURING") return "ds-status-badge--configuring";
  if (state === "DEGRADED") return "ds-status-badge--degraded";
  return "ds-status-badge--disconnected";
}

type HeroCtaKey = "configureWebhook" | "continueSetup" | "reconnect" | "reconfigure";

function heroCtaKey(state: string, provisioningComplete: boolean): HeroCtaKey | null {
  if (state === "CONFIGURING" && provisioningComplete) return "configureWebhook";
  if (state === "CONFIGURING") return "continueSetup";
  if (state === "DISCONNECTED") return "reconnect";
  if (state === "DEGRADED") return "reconfigure";
  return null;
}

export default function StatusHero({ data }: Props) {
  const locale = useLocale();
  const tHero = useTranslations("provider.tripletex.status.hero");
  const tState = useTranslations("provider.tripletex.state");
  const tFormat = useTranslations("provider.tripletex.format");
  const emDash = tFormat("emDash");

  const { state } = data;
  const companyLine =
    data.tripletexCompanyName && data.tripletexCompanyId
      ? `${data.tripletexCompanyName} (${data.tripletexCompanyId})`
      : (data.tripletexCompanyName ?? null);

  const ctaKey = heroCtaKey(state, data.provisioningComplete);

  const metaParts: string[] = [];
  if (data.stateSince) {
    metaParts.push(
      tHero("since", { datetime: formatTripletexDateTime(data.stateSince, locale, emDash) }),
    );
  }
  if (companyLine) metaParts.push(companyLine);

  return (
    <div className="ds-tripletex-status__hero">
      <div className="ds-tripletex-status__hero-strip">
        <span className={`ds-status-badge ${badgeClass(state)}`}>
          {resolveTripletexConnectionStateLabel((key) => tState(key), state)}
        </span>

        {metaParts.length > 0 ? (
          <p className="ds-body-sm ds-tripletex-status__hero-meta">{metaParts.join(" · ")}</p>
        ) : null}

        {ctaKey ? (
          <Link
            className={`ds-btn ${ctaKey === "reconfigure" ? "ds-btn--secondary" : "ds-btn--primary"} ds-tripletex-status__hero-cta`}
            href="/leverandor/innstillinger/tripletex/koble-til"
          >
            {tHero(ctaKey)}
          </Link>
        ) : null}
      </div>

      {state === "DEGRADED" && data.warnings.length > 0 ? (
        <ul className="ds-tripletex-status__warnings">
          {data.warnings.map((w) => (
            <li key={w.code} className="ds-body-sm">
              {w.message}
            </li>
          ))}
        </ul>
      ) : null}

      {data.lastHealthCheck && (state === "CONNECTED" || state === "DEGRADED") ? (
        <p className="ds-body-sm ds-tripletex-status__text-soft">
          {tHero("lastHealthCheck", {
            relative: formatTripletexRelative(data.lastHealthCheck, locale, emDash),
          })}
        </p>
      ) : null}

      {state === "DISCONNECTED" && data.vaultPurgeAt ? (
        <p className="ds-body-sm ds-tripletex-status__text-soft">
          {tHero("credentialsPurge", {
            datetime: formatTripletexDateTime(data.vaultPurgeAt, locale, emDash),
          })}
          {data.daysUntilPurge != null ? ` (${tHero("daysUntilPurge", { days: data.daysUntilPurge })})` : null}.
        </p>
      ) : null}
    </div>
  );
}
