"use client";

// components/superadmin/TranslationReviewClient.tsx — FASE 11.
// Handlinger for norsk oversettelsesflate: manuell oversettelse, godkjenning
// og nytt maskinutkast. Maskinoversettelse er alltid kun utkast.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

async function callApi(body: Record<string, unknown>) {
  const res = await fetch("/api/superadmin/translations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(String(json?.message ?? `Feil (${res.status})`));
  return json;
}

export default function TranslationReviewClient({
  translationId,
  reviewState,
  hasTranslation,
}: {
  translationId: string;
  reviewState: string;
  hasTranslation: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setManualOpen(false);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const btn = "inline-flex min-h-[44px] items-center rounded-full border border-neutral-200 bg-white px-3 text-xs font-semibold disabled:opacity-50";

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {reviewState === "pending" ? (
          <button type="button" className={btn} disabled={pending} onClick={() => run(() => callApi({ action: "retry_machine", translationId }))}>
            Lag maskinutkast
          </button>
        ) : null}
        <button type="button" className={btn} disabled={pending} onClick={() => setManualOpen((v) => !v)}>
          Oversett manuelt
        </button>
        {hasTranslation && reviewState !== "approved" ? (
          <button type="button" className={btn} disabled={pending} onClick={() => run(() => callApi({ action: "approve", translationId }))}>
            Godkjenn oversettelse
          </button>
        ) : null}
      </div>

      {manualOpen ? (
        <div className="mt-2 grid gap-2">
          <textarea
            aria-label="Norsk oversettelse"
            className="min-h-[80px] rounded-xl border border-neutral-200 bg-white p-2 text-sm"
            placeholder="Skriv norsk oversettelse …"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
          />
          <button
            type="button"
            className={btn}
            disabled={pending || !manualText.trim()}
            onClick={() => run(() => callApi({ action: "manual", translationId, translatedText: manualText.trim() }))}
          >
            Lagre norsk oversettelse
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
