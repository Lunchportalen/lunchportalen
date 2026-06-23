"use client";

import { AlertTriangle, Check, Circle, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  formatTripletexDateTime,
  resolveTripletexActivityLabel,
} from "@/lib/integrations/tripletex/tripletexStatusPresentation";

import type { DashboardActivityEvent } from "@/app/leverandor/innstillinger/tripletex/status/actions";

import { activityIconKind, type ActivityIconKind } from "./activityIconKind";

type Props = {
  events: DashboardActivityEvent[];
};

function ActivityIcon({ kind }: { kind: ActivityIconKind }) {
  const props = { size: 18, strokeWidth: 2, "aria-hidden": true as const };

  if (kind === "success") return <Check {...props} className="ds-tripletex-status__activity-icon ds-tripletex-status__activity-icon--success" />;
  if (kind === "warn") return <AlertTriangle {...props} className="ds-tripletex-status__activity-icon ds-tripletex-status__activity-icon--warn" />;
  if (kind === "error") return <XCircle {...props} className="ds-tripletex-status__activity-icon ds-tripletex-status__activity-icon--error" />;
  return <Circle {...props} className="ds-tripletex-status__activity-icon" />;
}

export default function ActivityFeed({ events }: Props) {
  const locale = useLocale();
  const t = useTranslations("provider.tripletex.status.activityStats");
  const tActivity = useTranslations("provider.tripletex.activity");
  const tFormat = useTranslations("provider.tripletex.format");
  const emDash = tFormat("emDash");

  if (events.length === 0) {
    return <p className="ds-body-sm ds-tripletex-status__text-soft">{t("empty")}</p>;
  }

  return (
    <>
      <h3 className="ds-body-sm ds-tripletex-status__feed-heading">{t("recentHeading")}</h3>
      <ol className="ds-tripletex-status__activity-list">
        {events.map((ev) => {
          const kind = activityIconKind(ev.action, ev.metadata);
          const label = resolveTripletexActivityLabel((key) => tActivity(key), ev.action, ev.metadata);
          return (
            <li key={`${ev.action}-${ev.created_at}`} className="ds-tripletex-status__activity-row">
              <ActivityIcon kind={kind} />
              <span className="ds-body">{label}</span>
              <time className="ds-tripletex-status__activity-time" dateTime={ev.created_at}>
                {formatTripletexDateTime(ev.created_at, locale, emDash)}
              </time>
            </li>
          );
        })}
      </ol>
    </>
  );
}
