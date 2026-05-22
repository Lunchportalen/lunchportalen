"use client";

import { useCallback, useState } from "react";

import {
  formatTripletexDateTime,
  formatTripletexRelative,
} from "@/lib/integrations/tripletex/tripletexStatusPresentation";

import type { DashboardData } from "@/app/leverandor/innstillinger/tripletex/status/actions";

type Props = {
  webhook: DashboardData["webhook"];
};

export default function WebhookHealth({ webhook }: Props) {
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(webhook.url);
      setCopyMsg("Kopiert");
      window.setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setCopyMsg("Kunne ikke kopiere");
    }
  }, [webhook.url]);

  return (
    <section className="ds-surface ds-tripletex-status__webhook" aria-labelledby="tpt-webhook-title">
      <h2 id="tpt-webhook-title" className="ds-h3">
        Webhook
      </h2>

      <dl className="ds-tripletex-status__dl">
        <div>
          <dt className="ds-body-sm">Siste mottatt</dt>
          <dd className="ds-body">
            {webhook.lastReceivedAt
              ? `${formatTripletexRelative(webhook.lastReceivedAt)} (${formatTripletexDateTime(webhook.lastReceivedAt)})`
              : "Ingen hendelser ennå"}
          </dd>
        </div>
        <div>
          <dt className="ds-body-sm">Siste 30 dager</dt>
          <dd className="ds-body">{webhook.events30d} hendelser</dd>
        </div>
        <div>
          <dt className="ds-body-sm">Secret rotert</dt>
          <dd className="ds-body">
            {webhook.lastRotatedAt ? formatTripletexDateTime(webhook.lastRotatedAt) : "Ikke rotert"}
          </dd>
        </div>
      </dl>

      <div className="ds-secret-display">
        <code className="ds-body-sm">{webhook.url}</code>
        <button type="button" className="ds-btn ds-btn--secondary" onClick={() => void copyUrl()}>
          {copyMsg ?? "Kopier URL"}
        </button>
      </div>
    </section>
  );
}
