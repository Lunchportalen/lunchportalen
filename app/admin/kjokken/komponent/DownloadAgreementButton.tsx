// app/admin/kjokken/komponent/DownloadAgreementButton.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ApiResp = {
  ok: boolean;
  error?: string;
  message?: string;
  url?: string; // signed URL
  expiresInSeconds?: number;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function DownloadAgreementButton() {
  const [loading, setLoading] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canOpen = useMemo(() => !!lastUrl && !loading, [lastUrl, loading]);

  // Rydd url når komponent remountes (valgfritt)
  useEffect(() => {
    return () => {
      setLastUrl(null);
      setExpiresIn(null);
      setErr(null);
      setLoading(false);
    };
  }, []);

  const fetchSignedUrl = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      // Endepunktet forventes å returnere en tidsbegrenset URL
      // Du kan endre path hvis dere har en annen route.
      const res = await fetch("/api/agreements/latest-signed-url", {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store",
      });

      const json = (await res.json().catch(() => null)) as ApiResp | null;

      if (!res.ok || !json?.ok || !json.url) {
        const msg =
          json?.message ||
          json?.error ||
          `Kunne ikke hente nedlastingslenke (HTTP ${res.status}).`;
        setErr(msg);
        setLastUrl(null);
        setExpiresIn(null);
        return;
      }

      setLastUrl(json.url);
      setExpiresIn(typeof json.expiresInSeconds === "number" ? json.expiresInSeconds : null);

      // Åpne umiddelbart i ny fane
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(String(e?.message ?? e ?? "Uventet feil"));
      setLastUrl(null);
      setExpiresIn(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClick = useCallback(async () => {
    // Hvis vi allerede har en url kan vi åpne den igjen
    if (lastUrl && !loading) {
      window.open(lastUrl, "_blank", "noopener,noreferrer");
      return;
    }
    await fetchSignedUrl();
  }, [lastUrl, loading, fetchSignedUrl]);

  const buttonLabel = useMemo(() => {
    if (loading) return "Henter lenke…";
    if (lastUrl) return "Åpne avtale-PDF";
    return "Last ned avtale-PDF";
  }, [loading, lastUrl]);

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={classNames(
          "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold",
          "border shadow-sm transition",
          loading
            ? "opacity-60 cursor-not-allowed"
            : "hover:shadow-md active:scale-[0.99]"
        )}
      >
        {buttonLabel}
      </button>

      {expiresIn !== null && lastUrl && (
        <p className="mt-2 text-xs opacity-70">
          Lenken er tidsbegrenset ({Math.max(0, expiresIn)} sek).
        </p>
      )}

      {err && (
        <p className="mt-2 text-xs text-red-600 whitespace-pre-wrap">
          {err}
        </p>
      )}

      {!err && canOpen && (
        <p className="mt-2 text-xs opacity-70">
          Hvis nedlastingen ikke åpner automatisk, trykk på knappen igjen.
        </p>
      )}
    </div>
  );
}
