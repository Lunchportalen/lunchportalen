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

export default function RegisterProviderAdminClient({ token, email, initialName, companyName }: Props) {
  const supabase = useMemo(() => {
    return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }, []);

  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (password.length < 10) return setError("Passord må være minst 10 tegn.");
    if (password !== password2) return setError("Passordene er ikke like.");

    setBusy(true);
    try {
      const res = await fetch("/api/auth/register-provider-admin", {
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
      // E5: land via the ONE canonical post-login resolver (→ /leverandor).
      goToPostLogin();
    } catch {
      setError("Uventet feil. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    "w-full min-h-[44px] rounded-xl border border-border bg-white px-3 py-2 text-text outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Navn</label>
        <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Passord</label>
        <input className={fieldClass} name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} placeholder="Minst 10 tegn" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Bekreft passord</label>
        <input className={fieldClass} name="password2" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" required minLength={10} />
      </div>
      <button
        type="submit"
        name="activate-provider-admin"
        disabled={busy}
        className="min-h-14 w-full rounded-full border border-white/15 bg-[linear-gradient(135deg,rgb(17_17_17)_0%,rgb(36_28_40)_100%)] px-6 py-4 text-base font-extrabold tracking-tight text-white transition duration-200 hover:-translate-y-0.5 disabled:opacity-60"
      >
        {busy ? "Aktiverer …" : `Aktiver konto for ${companyName}`}
      </button>
    </form>
  );
}
