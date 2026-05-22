"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getDashboardDataAction,
  type DashboardData,
} from "@/app/leverandor/innstillinger/tripletex/status/actions";

import ActivityFeed from "./ActivityFeed";
import ActivityStats from "./ActivityStats";
import ResourceSummary from "./ResourceSummary";
import StatusActions from "./StatusActions";
import StatusHero from "./StatusHero";
import WebhookHealth from "./WebhookHealth";

type Props = {
  providerId: string;
  isAdmin: boolean;
  initialData: DashboardData;
};

/**
 * Polling interval for live dashboard refresh.
 * 15s balances freshness with RPC + admin count load; Page Visibility API pauses
 * the interval when the tab is hidden to avoid background churn.
 */
const POLL_INTERVAL_MS = 15_000;

export default function StatusDashboardClient({ providerId, isAdmin, initialData }: Props) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await getDashboardDataAction({ providerId });
    setLoading(false);
    if (res.ok === false) {
      setFetchError(res.error);
      return;
    }
    setFetchError(null);
    setData(res.data);
  }, [providerId]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        void refresh();
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === "visible") {
      startPolling();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  return (
    <div className="ds-tripletex-status" aria-busy={loading}>
      {fetchError ? (
        <p className="ds-body-sm ds-tripletex-status__error" role="status">
          {fetchError}
        </p>
      ) : null}

      <StatusHero data={data} />

      <section className="ds-tripletex-status__section" aria-labelledby="tpt-resource-title">
        <h2 id="tpt-resource-title" className="ds-h3">
          Ressurser i Tripletex
        </h2>
        <ResourceSummary counts={data.resourceCounts} />
      </section>

      <section className="ds-tripletex-status__section" aria-labelledby="tpt-webhook-title">
        <h2 id="tpt-webhook-title" className="ds-h3">
          Webhook
        </h2>
        <WebhookHealth webhook={data.webhook} />
      </section>

      <section className="ds-tripletex-status__section" aria-labelledby="tpt-activity-title">
        <h2 id="tpt-activity-title" className="ds-h3">
          Aktivitet siste 30 dager
        </h2>
        <ActivityStats stats30d={data.stats30d} />
        <ActivityFeed events={data.recentEvents} />
      </section>

      {isAdmin ? (
        <section className="ds-tripletex-status__section" aria-labelledby="tpt-actions-title">
          <h2 id="tpt-actions-title" className="ds-h3">
            Handlinger
          </h2>
          <StatusActions providerId={providerId} connectionState={data.state} onChanged={() => void refresh()} />
        </section>
      ) : null}
    </div>
  );
}
