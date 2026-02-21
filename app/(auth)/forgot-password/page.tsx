"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <AuthShell title="Glemt passord" subtitle="Vi sender en sikker lenke til e-postadressen din.">
      <div className="space-y-4">
        {status === "sent" ? (
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
            Hvis e-postadressen er registrert, har vi sendt en lenke for å tilbakestille passordet.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === "loading"}
              />
            </div>

            {message ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{message}</div>
            ) : null}

            <Button
              type="submit"
              disabled={status === "loading"}
              className="w-full lp-btn--stable lp-neon-focus lp-neon-glow-hover"
            >
              {status === "loading" ? "Sender…" : "Send lenke"}
            </Button>
          </form>
        )}

        <div className="text-sm text-[rgb(var(--lp-muted))]">
          <Link href="/login" className="underline underline-offset-4">
            Tilbake til innlogging
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
