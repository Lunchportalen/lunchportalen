"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  formatTripletexDateTime,
  formatTripletexRelative,
} from "@/lib/integrations/tripletex/tripletexStatusPresentation";

import type { DashboardData } from "@/app/leverandor/innstillinger/tripletex/status/actions";

type Props = {
  webhook: DashboardData["webhook"];
};

export default function WebhookHealth({ webhook }: Props) {
  const locale = useLocale();
  const t = useTranslations("provider.tripletex.status.webhook");
  const tFormat = useTranslations("provider.tripletex.format");
  const emDash = tFormat("emDash");
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(webhook.url);
      setCopyMsg(t("copied"));
      window.setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setCopyMsg(t("copyFailed"));
    }
  }, [t, webhook.url]);

  return (
    <div className="ds-tripletex-status__webhook">
      <dl className="ds-tripletex-status__def-list">
        <div className="ds-tripletex-status__def-row">
          <dt className="ds-body-sm ds-tripletex-status__text-soft">{t("subscriptions")}</dt>
          <dd className="ds-body">
            {webhook.subscriptionCount > 0
              ? t("activeCount", { count: webhook.subscriptionCount })
              : t("noneRegistered")}
          </dd>
        </div>
        {webhook.eventTypes.length > 0 ? (
          <div className="ds-tripletex-status__def-row">
            <dt className="ds-body-sm ds-tripletex-status__text-soft">{t("eventTypes")}</dt>
            <dd className="ds-body">{webhook.eventTypes.join(", ")}</dd>
          </div>
        ) : null}
        <div className="ds-tripletex-status__def-row">
          <dt className="ds-body-sm ds-tripletex-status__text-soft">{t("lastReceived")}</dt>
          <dd className="ds-body">
            {webhook.lastReceivedAt
              ? `${formatTripletexRelative(webhook.lastReceivedAt, locale, emDash)} (${formatTripletexDateTime(webhook.lastReceivedAt, locale, emDash)})`
              : t("noEventsYet")}
          </dd>
        </div>
        <div className="ds-tripletex-status__def-row">
          <dt className="ds-body-sm ds-tripletex-status__text-soft">{t("last30Days")}</dt>
          <dd className="ds-body">{t("eventsCount", { count: webhook.events30d })}</dd>
        </div>
        <div className="ds-tripletex-status__def-row">
          <dt className="ds-body-sm ds-tripletex-status__text-soft">{t("secretRotated")}</dt>
          <dd className="ds-body">
            {webhook.lastRotatedAt ? formatTripletexDateTime(webhook.lastRotatedAt, locale, emDash) : t("notRotated")}
          </dd>
        </div>
      </dl>

      <div className="ds-tripletex-status__copy-field">
        <code className="ds-tripletex-status__copy-field-value">{webhook.url}</code>
        <button type="button" className="ds-tripletex-status__copy-field-btn" onClick={() => void copyUrl()}>
          {copyMsg ?? t("copy")}
        </button>
      </div>
    </div>
  );
}
