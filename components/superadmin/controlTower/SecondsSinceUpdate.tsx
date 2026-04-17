"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Viser «Oppdatert for X sek siden». Teksten re-rendres hvert 5. sekund (ingen API); sekundtall beregnes da på nytt fra `iso`.
 */
export function SecondsSinceUpdate({ iso }: { iso: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const seconds = useMemo(() => {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 1000));
  }, [iso, tick]);

  if (seconds === null) return null;

  return (
    <span className="text-xs text-[rgb(var(--lp-muted))]" title={iso}>
      Oppdatert for {seconds} sek siden
    </span>
  );
}
