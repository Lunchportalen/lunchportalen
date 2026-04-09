"use client";

import { useEffect, useState } from "react";

const CACHE_KEY = "lp_system_settings_cache_v1";
const POLL_MS = 5000;

function extractSettingsPayload(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data ?? null;
  const maybeSettings = (data as { settings?: unknown }).settings;
  return maybeSettings ?? data;
}

/**
 * Loads global system settings from `GET /api/backoffice/settings` (superadmin-gated).
 * For non–superadmin sessions, expect `settings === null` after load.
 * Polls every 5s to reduce stale UI after server-side changes.
 */
export function useSettings() {
  const [settings, setSettings] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const applyJson = (json: { ok?: boolean; data?: unknown }) => {
      if (cancelled) return;
      if (!json || json.ok !== true) {
        console.warn("[SETTINGS_LOAD_FAILED]", json);
        setSettings(null);
      } else {
        const payload = extractSettingsPayload(json.data);
        setSettings(payload ?? null);
        if (typeof window !== "undefined" && payload != null) {
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
          } catch {
            /* quota / private mode */
          }
        }
      }
    };

    const loadOnce = () => {
      if (typeof window !== "undefined") {
        try {
          const cached = sessionStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as unknown;
            if (parsed && typeof parsed === "object") {
              setSettings(parsed);
            }
          }
        } catch {
          /* ignore bad cache */
        }
      }

      void fetch("/api/backoffice/settings", { credentials: "include", cache: "no-store" })
        .then((res) => res.json())
        .then((json: { ok?: boolean; data?: unknown }) => {
          applyJson(json);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            console.error("[SETTINGS_FETCH_ERROR]", err);
            setSettings(null);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    loadOnce();

    const interval = setInterval(() => {
      void fetch("/api/backoffice/settings", { credentials: "include", cache: "no-store" })
        .then((res) => res.json())
        .then((json: { ok?: boolean; data?: unknown }) => {
          if (json?.ok) {
            applyJson(json);
          }
        })
        .catch((pollErr: unknown) => {
          console.warn("[SETTINGS_POLL_FAILED]", pollErr);
        });
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { settings, loading };
}
