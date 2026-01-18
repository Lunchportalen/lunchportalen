"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const LOGIN_TIMEOUT_MS = 6000;

function safeNextPath(next: string | null) {
  if (!next) return "/today";
  if (!next.startsWith("/")) return "/today";
  if (next.startsWith("//")) return "/today";
  return next;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const isLoading = status.type === "loading";

  function clearNonSuccessStatus() {
    setStatus((s) => (s.type === "success" ? s : { type: "idle" }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    const normalizedEmail = email.trim().toLowerCase();
    const pwd = password;

    if (!normalizedEmail || !pwd) {
      setStatus({ type: "error", message: "Fyll inn e-post og passord." });
      return;
    }

    setStatus({ type: "loading" });

    // Abort previous attempt
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const t = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: pwd }),
        signal: controller.signal,
        credentials: "same-origin",
        cache: "no-store",
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ok
      }

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Ugyldig e-post eller passord.");
      }

      if (!mountedRef.current) return;

      setStatus({
        type: "success",
        message: "Innlogging bekreftet. Sender deg videre…",
      });

      // ✅ Vent litt for at cookies skal være “på plass” før navigation
      setTimeout(() => {
        router.replace(nextPath);
        router.refresh();
      }, 450);
    } catch (err: any) {
      if (!mountedRef.current) return;

      const msg =
        err?.name === "AbortError"
          ? "Innloggingen tok for lang tid. Prøv igjen."
          : err?.message || "Kunne ikke logge inn. Prøv igjen.";

      setStatus({ type: "error", message: msg });
    } finally {
      clearTimeout(t);
    }
  }

  return (
    <form seection-name="LoginForm" onSubmit={onSubmit} className="space-y-4">
      {/* E-post */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-text">
          E-post
        </label>
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearNonSuccessStatus();
          }}
          placeholder="navn@firma.no"
          disabled={isLoading}
          className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text shadow-sm outline-none placeholder:text-muted/70 focus:border-[rgb(var(--lp-cta)/0.55)] focus:ring-4 focus:ring-[rgb(var(--lp-cta)/0.15)] disabled:cursor-not-allowed disabled:opacity-70"
        />
      </div>

      {/* Passord */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-text">
          Passord
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearNonSuccessStatus();
          }}
          placeholder="••••••••••"
          disabled={isLoading}
          className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-text shadow-sm outline-none placeholder:text-muted/70 focus:border-[rgb(var(--lp-cta)/0.55)] focus:ring-4 focus:ring-[rgb(var(--lp-cta)/0.15)] disabled:cursor-not-allowed disabled:opacity-70"
        />
      </div>

      {/* Status */}
      {status.type === "error" && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {status.message}
        </div>
      )}

      {status.type === "success" && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {status.message}
        </div>
      )}

      {/* CTA */}
      <button
        type="submit"
        disabled={isLoading}
        className="h-12 w-full rounded-2xl bg-[rgb(var(--lp-cta)/1)] px-5 text-sm font-semibold text-white shadow-[0_14px_40px_-18px_rgba(0,0,0,0.45)] ring-1 ring-black/5 transition hover:brightness-[1.03] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? "Logger inn…" : "Logg inn"}
      </button>

      {/* Test-knapp (kun dev) */}
      {process.env.NODE_ENV !== "production" && (
        <button
          type="button"
          onClick={() => alert("Dev: Opprett testbruker")}
          className="h-11 w-full rounded-2xl border border-border bg-white text-sm font-medium text-text shadow-sm hover:bg-[rgb(var(--lp-bg)/1)]"
        >
          Opprett bruker (test)
        </button>
      )}
    </form>
  );
}
