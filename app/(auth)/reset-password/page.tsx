"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseBrowser } from "@/lib/supabase/client";

type Status = "idle" | "loading" | "success" | "error" | "expired";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const canSubmit = useMemo(() => status !== "loading" && hasSession === true, [status, hasSession]);

  useEffect(() => {
    let mounted = true;
    let settled = false;
    let unsub: (() => void) | null = null;
    async function load() {
      try {
        const sb = supabaseBrowser();
        const { data } = await sb.auth.getSession();
        if (!mounted) return;

        if (data?.session) {
          setHasSession(true);
          setReady(true);
          settled = true;
          return;
        }

        const sub = sb.auth.onAuthStateChange((_event, session) => {
          if (!mounted || settled) return;
          if (session) {
            settled = true;
            setHasSession(true);
            setReady(true);
          }
        });
        unsub = () => sub.data.subscription.unsubscribe();

        setTimeout(() => {
          if (!mounted || settled) return;
          settled = true;
          setHasSession(false);
          setReady(true);
          unsub?.();
        }, 800);
      } catch {
        if (!mounted || settled) return;
        settled = true;
        setHasSession(false);
        setReady(true);
      } finally {
        if (mounted && !settled) setReady(true);
      }
    }
    load();
    return () => {
      mounted = false;
      unsub?.();
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

  if (!ready) {
    return (
      <AuthShell title="Tilbakestill passord" subtitle="Venter på sikker sesjon …">
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
          Laster …
        </div>
      </AuthShell>
    );
  }

  if (hasSession === false) {
    return (
      <AuthShell title="Tilbakestill passord" subtitle="Lenken er utløpt. Be om ny.">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
            Lenken er utløpt. Be om ny.
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
