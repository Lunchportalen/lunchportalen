import Link from "next/link";

import {
  formatTripletexDateTime,
  formatTripletexRelative,
  tripletexConnectionStateLabel,
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

export default function StatusHero({ data }: Props) {
  const { state } = data;
  const companyLine =
    data.tripletexCompanyName && data.tripletexCompanyId
      ? `${data.tripletexCompanyName} (${data.tripletexCompanyId})`
      : data.tripletexCompanyName ?? null;

  const showWebhookCta = state === "CONFIGURING" && data.provisioningComplete;
  const showSetupCta = state === "CONFIGURING" && !data.provisioningComplete;
  const showReconnectCta = state === "DISCONNECTED";

  return (
    <section className="ds-surface ds-tripletex-status__hero" aria-labelledby="tpt-status-hero-title">
      <div className="ds-tripletex-status__hero-head">
        <h2 id="tpt-status-hero-title" className="ds-h3">
          Tilkobling
        </h2>
        <span className={`ds-status-badge ${badgeClass(state)}`}>
          {tripletexConnectionStateLabel(state)}
        </span>
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

      {companyLine ? <p className="ds-body">Selskap: {companyLine}</p> : null}

      {data.stateSince ? (
        <p className="ds-body-sm ds-tripletex-status__meta">
          Siden {formatTripletexDateTime(data.stateSince)}
        </p>
      ) : null}

      {data.lastHealthCheck && (state === "CONNECTED" || state === "DEGRADED") ? (
        <p className="ds-body-sm ds-tripletex-status__meta">
          Siste helse-sjekk: {formatTripletexRelative(data.lastHealthCheck)}
        </p>
      ) : null}

      {state === "DISCONNECTED" && data.vaultPurgeAt ? (
        <p className="ds-body-sm ds-tripletex-status__meta">
          Credentials slettes {formatTripletexDateTime(data.vaultPurgeAt)}
          {data.daysUntilPurge != null ? ` (om ${data.daysUntilPurge} dager)` : null}.
        </p>
      ) : null}

      {showWebhookCta ? (
        <div className="ds-tripletex-status__hero-cta">
          <Link className="ds-btn ds-btn--primary" href="/leverandor/innstillinger/tripletex/koble-til">
            Konfigurer webhook
          </Link>
        </div>
      ) : null}

      {showSetupCta ? (
        <div className="ds-tripletex-status__hero-cta">
          <Link className="ds-btn ds-btn--primary" href="/leverandor/innstillinger/tripletex/koble-til">
            Fortsett oppsett
          </Link>
        </div>
      ) : null}

      {showReconnectCta ? (
        <div className="ds-tripletex-status__hero-cta">
          <Link className="ds-btn ds-btn--primary" href="/leverandor/innstillinger/tripletex/koble-til">
            Koble til igjen
          </Link>
        </div>
      ) : null}

      {state === "DEGRADED" ? (
        <div className="ds-tripletex-status__hero-cta">
          <Link className="ds-btn ds-btn--secondary" href="/leverandor/innstillinger/tripletex/koble-til">
            Re-konfigurer
          </Link>
        </div>
      ) : null}
    </section>
  );
}
