"use client";

import { useEffect, useState } from "react";

/**
 * U31 — Leser audit-route én gang når redigerer er aktiv. Superadmin får degraded-flagg;
 * 401/403 → null (ingen varsel).
 */
export function useContentAuditLogHealth(enabled: boolean): boolean | null {
  const [degraded, setDegraded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDegraded(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/backoffice/content/audit-log?limit=1", {
          credentials: "include",
          cache: "no-store",
        });
        if (res.status === 403 || res.status === 401) {
          if (!cancelled) setDegraded(null);
          return;
        }
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          data?: { degraded?: boolean };
        } | null;
        if (
          !cancelled &&
          res.ok &&
          json?.ok === true &&
          json?.data &&
          typeof json.data.degraded === "boolean"
        ) {
          setDegraded(json.data.degraded);
          return;
        }
        if (!cancelled) setDegraded(null);
      } catch {
        if (!cancelled) setDegraded(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return degraded;
}
