// components/auth/LoginForm.tsx
"use client";

import React from "react";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeNextPath(raw: string | null | undefined) {
  const n = safeStr(raw);
  if (!n) return "/week";
  if (!n.startsWith("/")) return "/week";
  if (n.startsWith("//")) return "/week";
  if (n.startsWith("/api/")) return "/week";
  if (n === "/login" || n.startsWith("/login/") || n === "/status" || n.startsWith("/status/")) return "/week";
  return n;
}

export default function LoginForm() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [showPw, setShowPw] = React.useState(false);

  const next = React.useMemo(() => {
    try {
      const u = new URL(window.location.href);
      return safeNextPath(u.searchParams.get("next"));
    } catch {
      return "/week";
    }
  }, []);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      if (pending) setPending(false);
    }, 20000);
    return () => window.clearTimeout(t);
  }, [pending]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    const em = safeStr(email).toLowerCase();
    const pw = String(password ?? "");

    if (!em || !pw) {
      setError("Feil e-post eller passord.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      const res = await fetch(`/api/auth/login?next=${encodeURIComponent(next)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: em, password: pw, next }),
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.ok !== true) {
        setError("Feil e-post eller passord.");
        setPending(false);
        return;
      }

      const target = safeNextPath(data?.next) || next;
      window.location.assign(target);
    } catch {
      setError("Feil e-post eller passord.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" aria-busy={pending ? "true" : "false"}>
      <div>
        <label className="block text-sm font-medium" htmlFor="lp-email">
          E-post
        </label>
        <input
          id="lp-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-70"
          autoComplete="email"
          inputMode="email"
          disabled={pending}
          aria-invalid={error ? "true" : "false"}
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="lp-password">
          Passord
        </label>

        <div className="mt-1 flex w-full items-center gap-2 rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-black/10 disabled:opacity-70">
          <input
            id="lp-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPw ? "text" : "password"}
            className="w-full bg-transparent px-1 text-sm outline-none"
            autoComplete="current-password"
            disabled={pending}
            aria-invalid={error ? "true" : "false"}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            disabled={pending}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[rgb(var(--lp-surface-2))] px-3 text-xs font-semibold text-[rgb(var(--lp-text))] ring-1 ring-[rgb(var(--lp-border))] hover:opacity-90 disabled:opacity-60"
            aria-label={showPw ? "Skjul passord" : "Vis passord"}
          >
            {showPw ? "Skjul" : "Vis"}
          </button>
        </div>
      </div>

      {pending ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="font-medium">Logger inn …</div>
          <div className="text-xs opacity-80">Dette tar vanligvis bare et øyeblikk.</div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full min-h-12 items-center justify-center rounded-2xl bg-[rgb(var(--lp-text))] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Logger inn …" : "Logg inn"}
      </button>
    </form>
  );
}
