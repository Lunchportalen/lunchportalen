"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

import { goToPostLogin } from "@/lib/auth/postLoginNav";

import type { Database } from "@/lib/types/database";

type Props = {
  token: string;
  email: string;
  initialName: string;
  companyName: string;
};

function passwordScore(password: string) {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[A-ZÆØÅ]/.test(password) && /[a-zæøå]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-zÆØÅæøå0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

function strengthLabel(score: number) {
  if (score >= 4) return "Sterkt";
  if (score >= 3) return "Godt";
  if (score >= 2) return "Middels";
  return "For svakt";
}

export default function RegisterCompanyAdminClient({ token, email, initialName, companyName }: Props) {
  const supabase = useMemo(() => {
    return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }, []);

  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const score = passwordScore(password);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (password.length < 10) {
      setError("Passord må være minst 10 tegn.");
      return;
    }
    if (password !== password2) {
      setError("Passordene er ikke like.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/register-company-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({ token, password, password2, name }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) {
        setError(String(json?.message ?? "Kunne ikke opprette innlogging."));
        return;
      }

      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) {
        setError("Kontoen ble opprettet, men innlogging feilet. Prøv å logge inn manuelt.");
        return;
      }

      // E5: land via the ONE canonical post-login resolver (agreement gate
      // decides /admin vs /avtale-ikke-aktiv), never a hardcoded destination.
      goToPostLogin();
    } catch {
      setError("Uventet feil. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-text">E-post</label>
        <input
          value={email}
          readOnly
          className="min-h-[44px] w-full rounded-xl border border-border bg-neutral-50 px-3 py-2 text-text"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">Navn</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className="min-h-[44px] w-full rounded-xl border border-border bg-white px-3 py-2 text-text outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
          placeholder="Navn"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">Passord</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          className="min-h-[44px] w-full rounded-xl border border-border bg-white px-3 py-2 text-text outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
        />
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-[rgb(var(--lp-cta))]" style={{ width: `${Math.max(1, score) * 25}%` }} />
          </div>
          <span className="text-xs text-muted">{strengthLabel(score)}</span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">Bekreft passord</label>
        <input
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          className="min-h-[44px] w-full rounded-xl border border-border bg-white px-3 py-2 text-text outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="min-h-[48px] w-full rounded-2xl bg-[rgb(var(--lp-cta))] px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
      >
        {busy ? "Oppretter innlogging..." : `Fullfør for ${companyName}`}
      </button>
    </form>
  );
}
