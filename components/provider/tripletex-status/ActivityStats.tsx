"use client";

import { useTranslations } from "next-intl";

type Props = {
  stats30d: {
    invoices_sent: number;
    invoices_paid: number;
    worker_failures: number;
    webhook_events: number;
  };
};

const STAT_KEYS = [
  { key: "invoices_sent" as const, labelKey: "invoicesSent" },
  { key: "invoices_paid" as const, labelKey: "invoicesPaid" },
  { key: "worker_failures" as const, labelKey: "workerFailures" },
  { key: "webhook_events" as const, labelKey: "webhookEvents" },
];

export default function ActivityStats({ stats30d }: Props) {
  const t = useTranslations("provider.tripletex.status.activityStats");

  return (
    <div className="ds-tripletex-status__activity-stats">
      {STAT_KEYS.map((stat) => (
        <div key={stat.key} className="ds-tripletex-status__activity-stat">
          <p className="ds-tripletex-status__stat-number">{stats30d[stat.key]}</p>
          <p className="ds-body-sm ds-tripletex-status__text-soft">{t(stat.labelKey)}</p>
        </div>
      ))}
    </div>
  );
}
