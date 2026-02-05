"use client";

import { useState } from "react";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseBrowser } from "@/lib/supabase/client";

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
      const sb = supabaseBrowser();
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (error) {
        setStatus("error");
        setMessage("Kunne ikke sende reset-lenke.");
        return;
      }

      setStatus("sent");
    } catch {
      setStatus("error");
      setMessage("Kunne ikke sende reset-lenke.");
    }
  }

  return (
    <AuthShell title="Glemt passord" subtitle="Vi sender en sikker reset-lenke til e-postadressen din.">
      {status === "sent" ? (
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
          Reset-lenke sendt. Sjekk innboksen din.
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

          <Button type="submit" disabled={status === "loading"} className="w-full lp-btn--stable lp-neon-focus lp-neon-glow-hover">
            {status === "loading" ? "Sender…" : "Send reset-lenke"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
