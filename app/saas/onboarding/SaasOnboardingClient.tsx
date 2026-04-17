"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SaasOnboardingClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/saas/onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ name }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setErr(typeof j?.message === "string" ? j.message : "Kunne ikke fullføre registrering.");
        return;
      }
      const next = typeof j?.data?.redirectTo === "string" ? j.data.redirectTo : "/admin/dashboard";
      window.location.assign(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4 text-center">
      <label className="block text-left text-sm font-medium text-[rgb(var(--lp-text))]">
        Firmanavn
        <input
          name="companyName"
          autoComplete="organization"
          className="font-body mt-1 w-full min-h-[44px] rounded-2xl border border-[rgba(var(--lp-border),0.85)] bg-white px-3 py-2 text-base text-[rgb(var(--lp-text))]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
        />
      </label>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="lp-btn-primary min-h-[44px] w-full rounded-full px-4 py-2.5 text-base font-medium disabled:opacity-60"
      >
        {busy ? "Oppretter …" : "Opprett firma og fortsett"}
      </button>
      <button
        type="button"
        className="font-body min-h-[44px] w-full rounded-full border border-[rgba(var(--lp-border),0.85)] bg-white px-4 py-2.5 text-base text-[rgb(var(--lp-muted))]"
        onClick={() => router.push("/saas/billing")}
      >
        Har du allerede firma? Gå til fakturering
      </button>
    </form>
  );
}
