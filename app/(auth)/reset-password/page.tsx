"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearRecoveryHashFromUrl,
  isRecoveryHashExpired,
  isRecoveryHashValid,
  parseRecoveryHash,
  RECOVERY_CHECKING_MESSAGE,
  RECOVERY_EXPIRED_MESSAGE,
} from "@/lib/auth/recoveryHash";
import { supabaseBrowser } from "@/lib/supabase/client";

type Status = "idle" | "loading" | "success" | "error";

type Phase = "checking" | "form" | "expired";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const canSubmit = useMemo(() => status !== "loading" && phase === "form", [status, phase]);

  useEffect(() => {
    let mounted = true;

    async function establishRecoverySession() {
      try {
        const sb = supabaseBrowser();
        const parsed = parseRecoveryHash(window.location.hash);

        if (isRecoveryHashExpired(parsed)) {
          if (mounted) setPhase("expired");
          return;
        }

        if (isRecoveryHashValid(parsed)) {
          const { error } = await sb.auth.setSession({
            access_token: parsed.accessToken!,
            refresh_token: parsed.refreshToken!,
          });

          if (!mounted) return;

          if (error) {
            setPhase("expired");
            return;
          }

          clearRecoveryHashFromUrl();
          setPhase("form");
          return;
        }

        const code = safeStr(new URLSearchParams(window.location.search).get("code"));
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (!mounted) return;
          if (error) {
            setPhase("expired");
            return;
          }
          setPhase("form");
          return;
        }

        const { data } = await sb.auth.getSession();
        if (!mounted) return;

        if (data?.session) {
          setPhase("form");
          return;
        }

        setPhase("expired");
      } catch {
        if (mounted) setPhase("expired");
      }
    }

    void establishRecoverySession();
    return () => {
      mounted = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const p1 = safeStr(password);
    const p2 = safeStr(confirm);

    if (!p1 || !p2) {
      setStatus("error");
      setMessage("Skriv inn nytt passord og bekreft.");
      return;
    }
    if (p1.length < 8) {
      setStatus("error");
      setMessage("Passordet må være minst 8 tegn.");
      return;
    }
    if (p1 !== p2) {
      setStatus("error");
      setMessage("Passordene må være like.");
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const sb = supabaseBrowser();
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) {
        setStatus("error");
        setMessage("Noe gikk galt. Prøv igjen om litt.");
        return;
      }

      setStatus("success");
      setMessage("Passordet er oppdatert. Du kan nå logge inn.");

      setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 600);
    } catch {
      setStatus("error");
      setMessage("Noe gikk galt. Prøv igjen om litt.");
    }
  }

  if (phase === "checking") {
    return (
      <AuthShell title="Tilbakestill passord" subtitle={RECOVERY_CHECKING_MESSAGE}>
        <div className="lp-glass-card rounded-card px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
          {RECOVERY_CHECKING_MESSAGE}
        </div>
      </AuthShell>
    );
  }

  if (phase === "expired") {
    return (
      <AuthShell title="Tilbakestill passord" subtitle={RECOVERY_EXPIRED_MESSAGE}>
        <div className="space-y-4">
          <div className="lp-glass-card rounded-card px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
            {RECOVERY_EXPIRED_MESSAGE}
          </div>
          <Link href="/forgot-password" className="text-sm underline underline-offset-4 text-[rgb(var(--lp-text))]">
            Be om ny lenke
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Tilbakestill passord" subtitle="Velg et nytt passord.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="password">Nytt passord</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={status === "loading"}
            required
          />
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Minimum 8 tegn.</p>
        </div>

        <div>
          <Label htmlFor="confirm">Gjenta passord</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={status === "loading"}
            required
          />
        </div>

        {message ? (
          <div
            role={status === "success" ? "status" : "alert"}
            className={
              status === "success"
                ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            }
          >
            {message}
          </div>
        ) : null}

        <Button type="submit" disabled={!canSubmit} className="w-full lp-btn--stable lp-neon-focus lp-neon-glow-hover">
          {status === "loading" ? "Lagrer …" : "Lagre nytt passord"}
        </Button>

        <div className="text-sm text-[rgb(var(--lp-muted))]">
          <Link href="/login" className="underline underline-offset-4">
            Tilbake til innlogging
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
