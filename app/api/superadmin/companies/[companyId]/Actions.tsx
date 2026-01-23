// app/superadmin/companies/[companyId]/Actions.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type CompanyStatus = "pending" | "active" | "paused" | "closed";

export default function Actions({
  companyId,
  status,
  onStatusChange,
}: {
  companyId: string;
  status: CompanyStatus;
  onStatusChange: (next: CompanyStatus) => void;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<{ type: "ok" | "error"; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function postJson(url: string, body: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json().catch(() => null);
    return { res, json };
  }

  function failMsg(res: Response, json: any, fallback: string) {
    // Vis message + detail hvis det finnes (mer presist enn generisk)
    const msg = json?.message || json?.error || fallback;
    const detail =
      json?.detail !== undefined
        ? ` • ${typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail)}`
        : "";
    return `${msg} (HTTP ${res.status})${detail}`;
  }

  function ok(msg: string) {
    setToast({ type: "ok", msg });
    setTimeout(() => setToast(null), 2500);
  }

  function err(msg: string) {
    setToast({ type: "error", msg });
    setTimeout(() => setToast(null), 6000);
  }

  const canDecide = status === "pending";

  function actActivate() {
    if (!canDecide) return;

    startTransition(async () => {
      setToast(null);

      const { res, json } = await postJson(
        `/api/superadmin/companies/${encodeURIComponent(companyId)}/activate`,
        { note: "Aktivert av superadmin" }
      );

      if (!res.ok || !json?.ok) {
        err(failMsg(res, json, "Kunne ikke aktivere firma"));
        return;
      }

      // ✅ Oppdater UI umiddelbart (ingen reload nødvendig)
      onStatusChange("active");

      ok("Firmaet er aktivert.");
      router.refresh(); // behold for konsistens (server render / stats)
      setTimeout(() => router.push("/superadmin"), 400);
    });
  }

  function actReject() {
    if (!canDecide) return;

    const typed = window.prompt('Skriv AVSLÅ for å avslå registreringen.');
    if (typed !== "AVSLÅ") return;

    startTransition(async () => {
      setToast(null);

      const { res, json } = await postJson(`/api/superadmin/companies/${encodeURIComponent(companyId)}/reject`, {});

      if (!res.ok || !json?.ok) {
        err(failMsg(res, json, "Kunne ikke avslå registrering"));
        return;
      }

      // ✅ Oppdater UI umiddelbart
      onStatusChange("closed");

      ok("Registreringen er avslått.");
      router.refresh();
      setTimeout(() => router.push("/superadmin"), 400);
    });
  }

  return (
    <div className="mt-4">
      {toast && (
        <div
          className={[
            "mb-4 rounded-2xl px-4 py-3 text-sm ring-1",
            toast.type === "ok"
              ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
              : "bg-red-50 text-red-900 ring-red-200",
          ].join(" ")}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href="/superadmin"
          className="rounded-2xl bg-white px-4 py-2 text-sm font-medium ring-1 ring-[rgb(var(--lp-border))] hover:bg-black/5"
        >
          Tilbake til oversikt
        </Link>

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
    </div>
  );
}
