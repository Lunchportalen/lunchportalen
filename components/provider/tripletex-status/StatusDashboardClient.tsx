"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getDashboardDataAction,
  type DashboardData,
} from "@/app/leverandor/innstillinger/tripletex/status/actions";

import ActivityFeed from "./ActivityFeed";
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
      <ResourceSummary counts={data.resourceCounts} />
      <WebhookHealth webhook={data.webhook} />
      <ActivityFeed events={data.recentEvents} stats30d={data.stats30d} />
      {isAdmin ? (
        <StatusActions providerId={providerId} connectionState={data.state} onChanged={() => void refresh()} />
      ) : null}
    </div>
  );
}
