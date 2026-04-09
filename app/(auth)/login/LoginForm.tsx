"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import type { SupabasePublicConfigStatus } from "@/lib/config/env-public";

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

function buildPostLoginUrl(nextPath: string | null) {
  const next = safeStr(nextPath);
  if (!next) return "/api/auth/post-login";
  return `/api/auth/post-login?next=${encodeURIComponent(next)}`;
}

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

      const nextPath = safeStr(loginJson.next ?? nextRaw) || null;
      window.location.assign(buildPostLoginUrl(nextPath));
    } catch {
      setErr("Innloggingstjenesten svarte ikke. Kontroller lokal runtime og prøv igjen.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onLoginSubmit} noValidate>
      <div>
        <label className="block text-sm font-medium" htmlFor="login-email">
          E-post
        </label>
        <input
          id="login-email"
          className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          autoComplete="email"
          inputMode="email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="login-password">
          Passord
        </label>
        <input
          id="login-password"
          className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
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
        className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
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
