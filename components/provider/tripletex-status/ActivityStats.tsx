type Props = {
  stats30d: {
    invoices_sent: number;
    invoices_paid: number;
    worker_failures: number;
    webhook_events: number;
  };
};

const STATS = [
  { key: "invoices_sent" as const, label: "Fakturaer sendt" },
  { key: "invoices_paid" as const, label: "Fakturaer betalt" },
  { key: "worker_failures" as const, label: "Feilede pushes" },
  { key: "webhook_events" as const, label: "Webhooks" },
];

export default function ActivityStats({ stats30d }: Props) {
  return (
    <div className="ds-tripletex-status__activity-stats">
      {STATS.map((stat) => (
        <div key={stat.key} className="ds-tripletex-status__activity-stat">
          <p className="ds-tripletex-status__stat-number">{stats30d[stat.key]}</p>
          <p className="ds-body-sm ds-tripletex-status__text-soft">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
