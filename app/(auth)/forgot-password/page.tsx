"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ email }),
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setStatus("error");
        setMessage("Noe gikk galt. Prøv igjen om litt.");
        return;
      }

      setStatus("sent");
    } catch {
      setStatus("error");
      setMessage("Noe gikk galt. Prøv igjen om litt.");
    }
  }

  return (
    <AuthShell
      variant="loginPremium"
      brandSubtitle="Kundeinnlogging"
      title="Glemt passord"
      subtitle="Vi sender en sikker lenke til e-postadressen din."
      footer={
        <Link
          href="/login"
          className="font-semibold underline decoration-[rgb(var(--lp-gold)/0.45)] underline-offset-4 transition hover:decoration-[rgb(var(--lp-gold))]"
        >
          Tilbake til innlogging
        </Link>
      }
    >
      <div className="space-y-5">
        {status === "sent" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" role="status">
            Hvis e-postadressen er registrert, har vi sendt en lenke for å tilbakestille passordet.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-[rgb(var(--lp-text))]" htmlFor="email">
                E-post
              </label>
              <input
                id="email"
                className="mt-2 h-14 w-full rounded-2xl border border-white/70 bg-white/85 px-4 text-base text-[rgb(var(--lp-text))] shadow-[var(--lp-shadow-inset)] transition duration-200 placeholder:text-[rgb(var(--lp-muted))] focus:border-[rgb(var(--lp-gold))] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgb(var(--lp-gold)/0.20)] disabled:bg-white/55 disabled:text-[rgb(var(--lp-muted))]"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === "loading"}
              />
            </div>

            {message ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={status === "loading"}
              className="min-h-14 w-full rounded-full border border-white/15 bg-[linear-gradient(135deg,rgb(17_17_17)_0%,rgb(36_28_40)_100%)] px-6 py-4 text-base font-extrabold tracking-tight text-white shadow-[0_18px_44px_rgb(17_17_17/0.24),inset_0_1px_0_rgb(255_255_255/0.14)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_58px_rgb(17_17_17/0.30),inset_0_1px_0_rgb(255_255_255/0.18)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--lp-gold)/0.65)] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
            >
              {status === "loading" ? "Sender…" : "Send lenke"}
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
