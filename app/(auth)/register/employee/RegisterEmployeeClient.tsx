"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

import {
  EMPLOYEE_ACTIVATION_CTA_FORM,
  EMPLOYEE_ACTIVATION_FORM_BUSY,
  EMPLOYEE_ACTIVATION_FORM_LEAD,
  EMPLOYEE_ACTIVATION_FORM_TITLE,
} from "@/lib/onboarding/employeeActivationCopy";
import type { Database } from "@/lib/types/database";

type Props = {
  token: string;
  email: string;
};

type ApiOk = {
  ok: true;
  rid?: string;
  userId?: string;
  email?: string;
  data?: {
    ok?: true;
    rid?: string;
    email?: string;
    userId?: string;
  };
  needsLogin?: boolean;
  pendingProfile?: boolean;
  message?: string;
  warning?: unknown;
};

type ApiErr = {
  ok: false;
  rid?: string;
  error: string;
  message?: string;
  detail?: unknown;
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

function safeText(v: unknown) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export default function RegisterEmployeeClient({ token, email }: Props) {
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
    e.preventDefault();
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
      const r = await fetch("/api/auth/accept-invite", {
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
      const loginEmail = ok.data?.email ?? ok.email ?? email;

      if (!loginEmail) {
        setErr("Konto opprettet, men mangler e-post for innlogging. Kontakt support.");
        setSubmitting(false);
        return;
      }

      const signIn = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (signIn.error) {
        setErr("Konto opprettet, men innlogging feilet. Prøv å logge inn manuelt.");
        setSubmitting(false);
        return;
      }

      router.replace("/week");
      router.refresh();
    } catch {
      setErr("Uventet feil. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-[rgb(var(--lp-text))]">{EMPLOYEE_ACTIVATION_FORM_TITLE}</h2>
      <p className="mt-2 text-sm leading-6 text-[rgb(var(--lp-muted))]">{EMPLOYEE_ACTIVATION_FORM_LEAD}</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <input type="hidden" name="token" value={token} />

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {err}
          </div>
        ) : null}

        <div>
          <label htmlFor="employee-email" className="mb-1 block text-sm font-medium text-[rgb(var(--lp-text))]">
            E-post
          </label>
          <input
            id="employee-email"
            value={email}
            readOnly
            type="email"
            autoComplete="username"
            className="w-full min-h-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-neutral-50 px-3 py-2 text-[rgb(var(--lp-text))]"
          />
        </div>

        <div>
          <label htmlFor="employee-name" className="mb-1 block text-sm font-medium text-[rgb(var(--lp-text))]">
            Navn (valgfritt)
          </label>
          <input
            id="employee-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            name="full_name"
            type="text"
            autoComplete="name"
            className="w-full min-h-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-[rgb(var(--lp-text))] outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
            placeholder="Ola Nordmann"
          />
        </div>

        <div>
          <label htmlFor="employee-password" className="mb-1 block text-sm font-medium text-[rgb(var(--lp-text))]">
            Passord
          </label>
          <div className="relative">
            <input
              id="employee-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="w-full min-h-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 pr-12 text-[rgb(var(--lp-text))] outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
              placeholder="Minst 10 tegn"
              required
              minLength={10}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 min-h-[44px] -translate-y-1/2 rounded-lg px-3 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-slate-50"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
            >
              {showPassword ? "Skjul" : "Vis"}
            </button>
          </div>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Bruk minst 10 tegn. Gjerne en setning du husker.</p>
        </div>

        <div>
          <label htmlFor="employee-password2" className="mb-1 block text-sm font-medium text-[rgb(var(--lp-text))]">
            Bekreft passord
          </label>
          <div className="relative">
            <input
              id="employee-password2"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              name="password2"
              type={showPassword2 ? "text" : "password"}
              autoComplete="new-password"
              className="w-full min-h-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 pr-12 text-[rgb(var(--lp-text))] outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]"
              placeholder="Skriv passordet på nytt"
              required
              minLength={10}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 min-h-[44px] -translate-y-1/2 rounded-lg px-3 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-slate-50"
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
          className="min-h-[52px] w-full rounded-full bg-[#f5c842] px-6 py-3 text-base font-semibold text-[#1a1714] shadow-[0_12px_30px_rgba(245,200,66,0.28)] transition hover:opacity-95 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--lp-gold)/0.65)] disabled:opacity-60"
        >
          {submitting ? EMPLOYEE_ACTIVATION_FORM_BUSY : EMPLOYEE_ACTIVATION_CTA_FORM}
        </button>

        <p className="text-center text-xs text-[rgb(var(--lp-muted))]">
          Har du allerede konto?{" "}
          <Link className="inline-flex min-h-[44px] items-center underline" href="/login">
            Logg inn
          </Link>
        </p>
      </form>
    </div>
  );
}
