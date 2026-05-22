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

function heroCta(state: string, provisioningComplete: boolean): { href: string; label: string; primary: boolean } | null {
  if (state === "CONFIGURING" && provisioningComplete) {
    return {
      href: "/leverandor/innstillinger/tripletex/koble-til",
      label: "Konfigurer webhook →",
      primary: true,
    };
  }
  if (state === "CONFIGURING") {
    return {
      href: "/leverandor/innstillinger/tripletex/koble-til",
      label: "Fortsett oppsett →",
      primary: true,
    };
  }
  if (state === "DISCONNECTED") {
    return {
      href: "/leverandor/innstillinger/tripletex/koble-til",
      label: "Koble til igjen →",
      primary: true,
    };
  }
  if (state === "DEGRADED") {
    return {
      href: "/leverandor/innstillinger/tripletex/koble-til",
      label: "Re-konfigurer →",
      primary: false,
    };
  }
  return null;
}

export default function StatusHero({ data }: Props) {
  const { state } = data;
  const companyLine =
    data.tripletexCompanyName && data.tripletexCompanyId
      ? `${data.tripletexCompanyName} (${data.tripletexCompanyId})`
      : data.tripletexCompanyName ?? null;

  const cta = heroCta(state, data.provisioningComplete);

  const metaParts: string[] = [];
  if (data.stateSince) metaParts.push(`Siden ${formatTripletexDateTime(data.stateSince)}`);
  if (companyLine) metaParts.push(companyLine);

  return (
    <div className="ds-tripletex-status__hero">
      <div className="ds-tripletex-status__hero-strip">
        <span className={`ds-status-badge ${badgeClass(state)}`}>
          {tripletexConnectionStateLabel(state)}
        </span>

        {metaParts.length > 0 ? (
          <p className="ds-body-sm ds-tripletex-status__hero-meta">{metaParts.join(" · ")}</p>
        ) : null}

        {cta ? (
          <Link
            className={`ds-btn ${cta.primary ? "ds-btn--primary" : "ds-btn--secondary"} ds-tripletex-status__hero-cta`}
            href={cta.href}
          >
            {cta.label}
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
          Siste helse-sjekk: {formatTripletexRelative(data.lastHealthCheck)}
        </p>
      ) : null}

      {state === "DISCONNECTED" && data.vaultPurgeAt ? (
        <p className="ds-body-sm ds-tripletex-status__text-soft">
          Credentials slettes {formatTripletexDateTime(data.vaultPurgeAt)}
          {data.daysUntilPurge != null ? ` (om ${data.daysUntilPurge} dager)` : null}.
        </p>
      ) : null}
    </div>
  );
}
