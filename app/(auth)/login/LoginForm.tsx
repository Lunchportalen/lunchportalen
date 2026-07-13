"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import type { SupabasePublicConfigStatus } from "@/lib/config/env-public";
import { buildPostLoginUrl } from "@/lib/auth/postLoginNav";

type LoginFormProps = {
  authRuntime: SupabasePublicConfigStatus;
  localRuntimeCredentials?: {
    email: string;
    password: string;
  } | null;
};

type ApiLoginOk = {
  ok: true;
  rid: string;
  next?: string | null;
  role?: string | null;
  data?: unknown;
};

type ApiLoginErr = {
  ok: false;
  rid: string;
  error: string;
  message: string;
  status: number;
};

type ApiLoginRes = ApiLoginOk | ApiLoginErr | null;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}

// All post-login routing is server-side via /api/auth/post-login (canonical
// helper: lib/auth/postLoginNav.ts). The client never maps role → destination
// locally so the redirect is deterministic and observable in the server log.

function mapLoginError(result: ApiLoginRes): string {
  if (!result || result.ok !== false) {
    return "Kunne ikke logge inn.";
  }

  if (result.error === "invalid_login" || result.status === 401) {
    return "Feil e-post eller passord.";
  }

  return safeStr(result.message) || "Kunne ikke logge inn.";
}

export default function LoginForm({
  authRuntime,
  localRuntimeCredentials = null,
}: LoginFormProps) {
  const sp = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busyAction, setBusyAction] = React.useState<"login" | null>(null);
  const [err, setErr] = React.useState<string>("");
  const nextRaw = React.useMemo(() => {
    const next = safeStr(sp.get("next"));
    return next || null;
  }, [sp]);
  const busy = busyAction !== null;
  const loginDisabled = busy || !authRuntime.ok;

  async function onLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !authRuntime.ok) return;

    setErr("");
    setBusyAction("login");

    try {
      const em = normEmail(email);
      const pw = String(password ?? "");

      if (!em || !pw) {
        setErr("Fyll inn e-post og passord.");
        return;
      }

      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({
          email: em,
          password: pw,
          next: nextRaw,
        }),
      });

      const loginJson = (await resp.json().catch(() => null)) as ApiLoginRes;
      if (!resp.ok || !loginJson || loginJson.ok !== true) {
        setErr(mapLoginError(loginJson));
        return;
      }

      const nextHint = safeStr(loginJson.next) || nextRaw;
      window.location.assign(buildPostLoginUrl(nextHint));
    } catch {
      setErr("Innloggingstjenesten svarte ikke. Kontroller lokal runtime og prøv igjen.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onLoginSubmit} noValidate>
      <div>
        <label className="block text-sm font-semibold text-[rgb(var(--lp-text))]" htmlFor="login-email">
          E-post
        </label>
        <input
          id="login-email"
          className="mt-1.5 h-12 w-full rounded-[14px] border border-[rgb(var(--lp-text)/0.16)] bg-white px-4 text-base text-[rgb(var(--lp-text))] transition duration-200 placeholder:text-[rgb(var(--lp-muted))] focus:border-[rgb(var(--lp-gold))] focus:outline-none focus:ring-[3px] focus:ring-[rgb(var(--lp-gold)/0.22)] disabled:bg-white/60 disabled:text-[rgb(var(--lp-muted))]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          autoComplete="email"
          inputMode="email"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[rgb(var(--lp-text))]" htmlFor="login-password">
          Passord
        </label>
        <input
          id="login-password"
          className="mt-1.5 h-12 w-full rounded-[14px] border border-[rgb(var(--lp-text)/0.16)] bg-white px-4 text-base text-[rgb(var(--lp-text))] transition duration-200 placeholder:text-[rgb(var(--lp-muted))] focus:border-[rgb(var(--lp-gold))] focus:outline-none focus:ring-[3px] focus:ring-[rgb(var(--lp-gold)/0.22)] disabled:bg-white/60 disabled:text-[rgb(var(--lp-muted))]"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          autoComplete="current-password"
        />
      </div>

      {!authRuntime.ok ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          {authRuntime.message}
        </div>
      ) : null}

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {err}
        </div>
      ) : null}

      <button
        type="submit"
        className="min-h-[52px] w-full rounded-full border border-[rgb(var(--lp-gold)/0.35)] bg-[linear-gradient(135deg,rgb(28_26_31)_0%,rgb(36_28_40)_55%,rgb(24_22_26)_100%)] px-6 text-base font-extrabold tracking-tight text-white shadow-[0_14px_36px_rgb(17_17_17/0.22),inset_0_1px_0_rgb(255_255_255/0.12)] transition duration-200 hover:-translate-y-0.5 hover:border-[rgb(var(--lp-gold)/0.6)] hover:shadow-[0_20px_48px_rgb(17_17_17/0.28),0_0_24px_rgb(var(--lp-gold-glow)/0.18),inset_0_1px_0_rgb(255_255_255/0.16)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--lp-gold))] active:translate-y-0 disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
        disabled={loginDisabled}
      >
        {busyAction === "login" ? "Logger inn…" : "Logg inn"}
      </button>

      {localRuntimeCredentials ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <p className="font-medium text-slate-900">Lokal runtime-konto</p>
          <p className="mt-1">
            Bruk normal innlogging med <code>{localRuntimeCredentials.email}</code> og{" "}
            <code>{localRuntimeCredentials.password}</code>.
          </p>
        </div>
      ) : null}
    </form>
  );
}
