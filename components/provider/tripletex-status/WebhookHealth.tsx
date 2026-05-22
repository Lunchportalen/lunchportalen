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
    <div className="ds-tripletex-status__webhook">
      <dl className="ds-tripletex-status__def-list">
        <div className="ds-tripletex-status__def-row">
          <dt className="ds-body-sm ds-tripletex-status__text-soft">Registrerte abonnement</dt>
          <dd className="ds-body">
            {webhook.subscriptionCount > 0
              ? `${webhook.subscriptionCount} aktive i Tripletex`
              : "Ingen registrert ennå"}
          </dd>
        </div>
        {webhook.eventTypes.length > 0 ? (
          <div className="ds-tripletex-status__def-row">
            <dt className="ds-body-sm ds-tripletex-status__text-soft">Event-typer</dt>
            <dd className="ds-body">{webhook.eventTypes.join(", ")}</dd>
          </div>
        ) : null}
        <div className="ds-tripletex-status__def-row">
          <dt className="ds-body-sm ds-tripletex-status__text-soft">Siste mottatt</dt>
          <dd className="ds-body">
            {webhook.lastReceivedAt
              ? `${formatTripletexRelative(webhook.lastReceivedAt)} (${formatTripletexDateTime(webhook.lastReceivedAt)})`
              : "Ingen hendelser ennå"}
          </dd>
        </div>
        <div className="ds-tripletex-status__def-row">
          <dt className="ds-body-sm ds-tripletex-status__text-soft">Siste 30 dager</dt>
          <dd className="ds-body">{webhook.events30d} hendelser</dd>
        </div>
        <div className="ds-tripletex-status__def-row">
          <dt className="ds-body-sm ds-tripletex-status__text-soft">Secret rotert</dt>
          <dd className="ds-body">
            {webhook.lastRotatedAt ? formatTripletexDateTime(webhook.lastRotatedAt) : "Ikke rotert"}
          </dd>
        </div>
      </dl>

      <div className="ds-tripletex-status__copy-field">
        <code className="ds-tripletex-status__copy-field-value">{webhook.url}</code>
        <button type="button" className="ds-tripletex-status__copy-field-btn" onClick={() => void copyUrl()}>
          {copyMsg ?? "Kopier"}
        </button>
      </div>
    </div>
  );
}
