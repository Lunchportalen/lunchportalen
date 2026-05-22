import {
  formatTripletexDateTime,
  tripletexActivityLabel,
} from "@/lib/integrations/tripletex/tripletexStatusPresentation";

import type { DashboardActivityEvent } from "@/app/leverandor/innstillinger/tripletex/status/actions";

type Props = {
  events: DashboardActivityEvent[];
  stats30d: {
    invoices_sent: number;
    invoices_paid: number;
    worker_failures: number;
    webhook_events: number;
  };
};

export default function ActivityFeed({ events, stats30d }: Props) {
  return (
    <section className="ds-section" aria-labelledby="tpt-activity-title">
      <h2 id="tpt-activity-title" className="ds-h3">
        Aktivitet siste 30 dager
      </h2>

      <div className="ds-tripletex-status__stats-grid">
        <p className="ds-body-sm">
          Fakturaer sendt: <strong>{stats30d.invoices_sent}</strong>
        </p>
        <p className="ds-body-sm">
          Fakturaer betalt: <strong>{stats30d.invoices_paid}</strong>
        </p>
        <p className="ds-body-sm">
          Feilede pushes: <strong>{stats30d.worker_failures}</strong>
        </p>
        <p className="ds-body-sm">
          Webhook-hendelser: <strong>{stats30d.webhook_events}</strong>
        </p>
      </div>

      <h3 className="ds-body-sm ds-tripletex-status__subheading">Siste hendelser</h3>

      {events.length === 0 ? (
        <p className="ds-body-sm ds-tripletex-status__empty">Ingen hendelser registrert ennå.</p>
      ) : (
        <ul className="ds-tripletex-status__activity-list">
          {events.map((ev) => (
            <li key={`${ev.action}-${ev.created_at}`} className="ds-tripletex-status__activity-item">
              <time className="ds-body-sm" dateTime={ev.created_at}>
                {formatTripletexDateTime(ev.created_at)}
              </time>
              <span className="ds-body">{tripletexActivityLabel(ev.action, ev.metadata)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
