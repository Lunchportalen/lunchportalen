// components/DownloadAgreementButton.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type ApiOk = {
  ok: true;
  url: string;
  rid?: string;
};

type ApiErr = {
  ok: false;
  error: string;
  message?: string;
  rid?: string;
};

type ApiRes = ApiOk | ApiErr;

/* =========================
   Type guards (FASIT)
========================= */
function isApiErr(v: any): v is ApiErr {
  return !!v && v.ok === false;
}

function isApiOk(v: any): v is ApiOk {
  return !!v && v.ok === true && typeof v.url === "string";
}

export default function DownloadAgreementButton() {
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function onClick() {
    setLoading(true);
    setErrMsg(null);
    setRid(null);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const resp = await fetch("/api/agreements/my-latest", {
        method: "GET",
        cache: "no-store",
        signal: ac.signal,
      });

      const json = (await resp.json().catch(() => null)) as ApiRes | null;

      // ❌ HTTP-feil uten gyldig body
      if (!resp.ok && !json) {
        throw new Error(`HTTP ${resp.status}`);
      }

      // ❌ API-feil (nå trygt)
      if (isApiErr(json)) {
        setRid(json.rid ?? null);
        throw new Error(json.message || json.error || "Kunne ikke hente avtalen.");
      }

      // ❌ Feil format
      if (!isApiOk(json)) {
        throw new Error("Ugyldig svar fra server (mangler url).");
      }

      // ✅ OK
      setRid(json.rid ?? null);
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErrMsg(e?.message || "Noe gikk galt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
        className="rounded-xl border px-4 py-2 text-sm disabled:opacity-60"
      >
        {loading ? "Henter avtale…" : "Last ned avtale (PDF)"}
      </button>

      {errMsg ? (
        <p className="text-sm text-red-700">
          {errMsg}
          {rid ? (
            <span className="opacity-70">
              {" "}
              (RID: <span className="font-mono">{rid}</span>)
            </span>
          ) : null}
        </p>
      ) : null}

      <p className="text-xs opacity-70">
        Lenken er tidsbegrenset og åpnes i ny fane.
      </p>
    </div>
  );
}
