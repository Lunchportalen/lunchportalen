// app/superadmin/companies/[companyId]/Actions.tsx
"use client";

import { useMemo, useState, useTransition } from "react";

export type CompanyStatus = "pending" | "active" | "paused" | "closed";

type Props = {
  companyId: string;
  status: CompanyStatus;
  onStatusChange?: (next: CompanyStatus) => void;
};

type ApiOk = { ok: true; company?: { id: string; status?: CompanyStatus } };
type ApiErr = { ok: false; error: string; message?: string; detail?: any };
type ApiRes = ApiOk | ApiErr;

function niceError(e: any) {
  return e?.message || "Noe gikk galt. Prøv igjen.";
}

async function post(url: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });

  const data = (await res.json().catch(() => null)) as ApiRes | null;

  if (!res.ok || !data || (data as ApiErr).ok === false) {
    const msg =
      (data as ApiErr | null)?.message ||
      (data as ApiErr | null)?.error ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data as ApiOk;
}

export default function Actions({ companyId, status, onStatusChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const canDecide = useMemo(() => status === "pending", [status]); // kun pending kan behandles

  function actActivate() {
    startTransition(async () => {
      try {
        setErr(null);
        await post(`/api/superadmin/companies/${companyId}/activate`);
        onStatusChange?.("active");
      } catch (e) {
        setErr(niceError(e));
      }
    });
  }

  function actReject() {
    startTransition(async () => {
      try {
        setErr(null);
        // bruk riktig endpoint dere faktisk har. Hvis dere ikke har /reject, bytt til /close eller /deny.
        await post(`/api/superadmin/companies/${companyId}/reject`);
        onStatusChange?.("closed");
      } catch (e) {
        setErr(niceError(e));
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          disabled={isPending || !canDecide}
          onClick={actActivate}
          className={[
            "rounded-2xl px-4 py-2 text-sm font-medium ring-1 transition",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "bg-black text-white ring-black hover:bg-black/90",
          ].join(" ")}
        >
          Aktiver
        </button>

        <button
          disabled={isPending || !canDecide}
          onClick={actReject}
          className={[
            "rounded-2xl px-4 py-2 text-sm font-medium ring-1 transition",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "bg-white text-red-700 ring-[rgb(var(--lp-border))] hover:bg-red-50",
          ].join(" ")}
        >
          Avslå
        </button>
      </div>

      {err ? <div className="text-sm text-red-700">{err}</div> : null}
    </div>
  );
}
