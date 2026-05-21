"use client";

import { useEffect, useRef, useState } from "react";

import { getHealthAction } from "@/app/leverandor/innstillinger/tripletex/koble-til/actions";

type Props = {
  providerId: string;
  onComplete: () => void;
};

const POLL_MS = 3000;
const MAX_MS = 5 * 60 * 1000;
const MAX_BACKOFF_MS = 30_000;

export default function Step2Provisioning({ providerId, onComplete }: Props) {
  const [statusText, setStatusText] = useState("Starter oppsett…");
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startedRef = useRef(Date.now());
  const backoffRef = useRef(POLL_MS);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    startedRef.current = Date.now();
    backoffRef.current = POLL_MS;

    const poll = async () => {
      if (!mountedRef.current) return;

      if (Date.now() - startedRef.current > MAX_MS) {
        setTimedOut(true);
        setStatusText("Noe tok lengre tid enn forventet.");
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        return;
      }

      const res = await getHealthAction({ providerId });

      if (!mountedRef.current) return;

      if (res.ok === false) {
        const is5xx = res.code === "HEALTH_FAILED";
        if (is5xx) {
          backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        }
        setError(res.error);
        setStatusText("Venter på Tripletex-oppsett…");
        return;
      }

      backoffRef.current = POLL_MS;
      setError(null);

      const provisioningEvent = res.data.recentEvents.find(
        (ev) => ev.action === "tripletex_onboarding_provisioning_completed",
      );

      if (provisioningEvent) {
        setStatusText("Oppsett fullført.");
      } else if (res.data.provisioningComplete) {
        setStatusText("Oppsett fullført.");
      } else {
        setStatusText("Synkroniserer MVA-koder, produkter og kunder…");
      }

      if (res.data.provisioningComplete) {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        onComplete();
      }
    };

    void poll();
    intervalRef.current = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [providerId, onComplete]);

  return (
    <section className="ds-surface" aria-labelledby="tpt-step2-title">
      <p className="ds-eyebrow">Steg 3 av 5</p>
      <h2 id="tpt-step2-title" className="ds-h3">
        Setter opp Tripletex
      </h2>
      <p className="ds-body ds-text-limit">Dette tar vanligvis 10–30 sekunder.</p>

      <div aria-live="polite" aria-atomic="true" className="ds-verify-list">
        <div className="ds-verify-item ds-verify-item--pending">
          <span className="ds-verify-item__icon" aria-hidden="true">
            …
          </span>
          <span className="ds-body-sm">{statusText}</span>
        </div>
        <div className="ds-verify-item ds-verify-item--success">
          <span className="ds-verify-item__icon" aria-hidden="true">
            ✓
          </span>
          <span className="ds-body-sm">MVA-koder synkroniseres</span>
        </div>
        <div className="ds-verify-item ds-verify-item--success">
          <span className="ds-verify-item__icon" aria-hidden="true">
            ✓
          </span>
          <span className="ds-body-sm">Produkter opprettes</span>
        </div>
        <div className="ds-verify-item ds-verify-item--pending">
          <span className="ds-verify-item__icon" aria-hidden="true">
            …
          </span>
          <span className="ds-body-sm">Kunder synkroniseres</span>
        </div>
      </div>

      {error ? (
        <p className="ds-body-sm" role="status">
          {error}
        </p>
      ) : null}

      {timedOut ? (
        <div className="ds-wizard__actions">
          <p className="ds-body-sm">
            Oppsettet fortsetter i bakgrunnen. Du kan lukke siden og komme tilbake senere.
          </p>
          <a className="ds-btn ds-btn--secondary" href="mailto:support@lunchportalen.no">
            Kontakt support
          </a>
        </div>
      ) : null}
    </section>
  );
}
