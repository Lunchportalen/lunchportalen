// app/accept-invite/AcceptInviteClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

type Props = {
  token: string;
};

type ApiOk = {
  ok: true;
  rid?: string;
  userId?: string;
  email?: string;
  needsLogin?: boolean;
  pendingProfile?: boolean;
  message?: string;
  warning?: any;
};

type ApiErr = {
  ok: false;
  rid?: string;
  error: string;
  message?: string;
  detail?: any;
};

type ApiRes = ApiOk | ApiErr;

function mapUiError(raw: string | null) {
  if (!raw) return null;
  const msg = raw.toLowerCase();

  if (msg.includes("utløpt") || msg.includes("ugyldig") || msg.includes("invalid") || msg.includes("expired")) {
    return "Invitasjonen er ugyldig eller utløpt. Be administrator sende en ny invitasjon.";
  }
  if (msg.includes("passord")) return raw;
  if (msg.includes("annet firma") || msg.includes("mismatch") || msg.includes("company")) {
    return "Kontoen er allerede knyttet til et annet firma. Kontakt superadmin.";
  }
  if (msg.includes("vent") || msg.includes("try again") || msg.includes("prøv igjen")) {
    return "Kontoen opprettes. Vent et øyeblikk og prøv igjen.";
  }
  return raw;
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export default function AcceptInviteClient({ token }: Props) {
  const router = useRouter();

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)");
    return createBrowserClient<Database>(url, anon);
  }, []);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ Viktig: Hvis du tester mens du er innlogget som admin/superadmin i samme browser,
  // kan middleware sende deg “feil vei”. Vi logger derfor ut ved mount.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) await supabase.auth.signOut();
      } catch {
        // ignore
      }
    })();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); // ✅ stopper POST /accept-invite?... 303
    if (submitting) return;

    setErr(null);

    if (!token) {
      setErr("Mangler token i lenken.");
      return;
    }
    if (!password || password.length < 10) {
      setErr("Passord må være minst 10 tegn.");
      return;
    }
    if (!password2 || password2.length < 10) {
      setErr("Bekreft passord (minst 10 tegn).");
      return;
    }
    if (password !== password2) {
      setErr("Passordene er ikke like.");
      return;
    }

    setSubmitting(true);

    try {
      // 1) Fullfør invite (auth opprettes/oppdateres)
      const r = await fetch("/api/accept-invite/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({
          token,
          password,
          password2,
          name: safeText(fullName),
        }),
      });

      const data = (await r.json().catch(() => null)) as ApiRes | null;

      if (!r.ok || !data || !data.ok) {
        const msg = mapUiError(String((data as ApiErr | null)?.message ?? "Kunne ikke aktivere konto."));
        setErr(msg ?? "Kunne ikke aktivere konto.");
        setSubmitting(false);
        return;
      }

      const ok = data as ApiOk;
      const email = ok.email;

      if (!email) {
        setErr("Konto opprettet, men mangler e-post for innlogging. Kontakt support.");
        setSubmitting(false);
        return;
      }

      // 2) Logg inn (opprett session)
      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) {
        setErr("Konto opprettet, men innlogging feilet. Prøv å logge inn manuelt.");
        setSubmitting(false);
        return;
      }

      // 3) Redirect til /week (week-siden håndterer pendingProfile)
      router.replace("/week");
      router.refresh();
    } catch (e: any) {
      setErr("Uventet feil. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-text">Navn (valgfritt)</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          name="full_name"
          type="text"
          autoComplete="name"
          className="w-full min-h-[44px] rounded-xl border border-border bg-white px-3 py-2 text-text outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
          placeholder="Ola Nordmann"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">Passord</label>
        <div className="relative">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className="w-full min-h-[44px] rounded-xl border border-border bg-white px-3 py-2 pr-12 text-text outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
            placeholder="Minst 10 tegn"
            required
            minLength={10}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 min-h-[44px] -translate-y-1/2 rounded-lg px-3 text-xs font-semibold text-text hover:bg-slate-50"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
          >
            {showPassword ? "Skjul" : "Vis"}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">Bruk minst 10 tegn. Gjerne en setning du husker.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">Bekreft passord</label>
        <div className="relative">
          <input
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            name="password2"
            type={showPassword2 ? "text" : "password"}
            autoComplete="new-password"
            className="w-full min-h-[44px] rounded-xl border border-border bg-white px-3 py-2 pr-12 text-text outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
            placeholder="Skriv passordet på nytt"
            required
            minLength={10}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 min-h-[44px] -translate-y-1/2 rounded-lg px-3 text-xs font-semibold text-text hover:bg-slate-50"
            onClick={() => setShowPassword2((v) => !v)}
            aria-pressed={showPassword2}
          >
            {showPassword2 ? "Skjul" : "Vis"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-[48px] rounded-2xl bg-[rgb(var(--lp-cta))] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Aktiverer…" : "Aktiver konto"}
      </button>

      <p className="text-center text-xs text-muted">
        Har du allerede konto?{" "}
        <Link className="inline-flex min-h-[44px] items-center underline" href="/login">
          Logg inn
        </Link>
      </p>
    </form>
  );
}



