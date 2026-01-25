"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "pending_profile" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const LOGIN_TIMEOUT_MS = 8000;

// Ny fasit: rolig polling med backoff og maks forsøk
const PROFILE_POLL_MAX_TRIES = 10;
const PROFILE_POLL_START_DELAY_MS = 450;
const PROFILE_POLL_MAX_DELAY_MS = 1500;

function safeNextPath(next: string | null) {
  const FALLBACK = "/week"; // ✅ ansatt-default i denne fasen
  if (!next) return FALLBACK;
  if (!next.startsWith("/")) return FALLBACK;
  if (next.startsWith("//")) return FALLBACK;

  // unngå loop
  if (
    next === "/login" ||
    next.startsWith("/login/") ||
    next === "/register" ||
    next.startsWith("/register/") ||
    next === "/forgot-password" ||
    next.startsWith("/forgot-password/")
  ) {
    return FALLBACK;
  }

  return next;
}

function clearMessage(s: Status) {
  return s.type === "success" ? s : ({ type: "idle" } as const);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);

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

  const isLoading = status.type === "loading" || status.type === "pending_profile";

  function clearNonSuccessStatus() {
    setStatus((s) => clearMessage(s));
  }

  async function pollProfileThenRedirect() {
    if (!mountedRef.current) return;

    setStatus({ type: "pending_profile" });

    let delay = PROFILE_POLL_START_DELAY_MS;

    for (let i = 0; i < PROFILE_POLL_MAX_TRIES; i++) {
      if (!mountedRef.current) return;

      try {
        // ✅ FASIT: poll /api/profile (ikke /api/auth/profile)
        const r = await fetch("/api/profile", { cache: "no-store", credentials: "same-origin" });

        // ✅ 202 = pending (trigger/profiles-latency) → vent med backoff
        if (r.status === 202) {
          await sleep(delay);
          delay = Math.min(PROFILE_POLL_MAX_DELAY_MS, Math.floor(delay * 1.4));
          continue;
        }

        const j = await r.json().catch(() => null);

        // 401 = ikke innlogget (cookies/session mangler)
        if (r.status === 401) {
          setStatus({ type: "error", message: "Du er ikke innlogget. Prøv igjen." });
          return;
        }

        if (r.status === 200 && j?.ok && j?.pending === false && j?.profile) {
          const prof = j.profile;

          // Sperre: deaktivert
          if (prof.disabled_at) {
            setStatus({
              type: "error",
              message: prof.disabled_reason || "Kontoen er deaktivert. Kontakt administrator.",
            });
            return;
          }

          // Sperre: ikke aktiv
          if (prof.is_active === false) {
            setStatus({ type: "error", message: "Kontoen er ikke aktiv ennå. Kontakt administrator." });
            return;
          }

          // ✅ Cookies er på plass; la SSR/middleware oppdatere før navigasjon
          router.refresh();
          router.replace(nextPath);
          return;
        }
      } catch {
        // ignorer og prøv igjen
      }

      await sleep(delay);
      delay = Math.min(PROFILE_POLL_MAX_DELAY_MS, Math.floor(delay * 1.4));
    }

    setStatus({
      type: "error",
      message: "Vi setter opp kontoen din. Vent litt og prøv igjen hvis du ikke kommer videre.",
    });
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
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
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
        message: "Innlogging bekreftet. Setter opp kontoen din…",
      });

      // ✅ La cookies “lande” hos middleware/server først
      await sleep(200);

      // ✅ Vent til profilen er klar (202 pending håndteres)
      await pollProfileThenRedirect();
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
    <form data-section="LoginForm" onSubmit={onSubmit} className="space-y-4">
      {/* E-post */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-text">E-post</label>
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
        <label className="mb-1.5 block text-sm font-medium text-text">Passord</label>
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
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {status.message}
        </div>
      )}

      {(status.type === "success" || status.type === "pending_profile") && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {status.type === "pending_profile" ? "Setter opp kontoen din…" : status.message}
          <div className="mt-1 text-xs opacity-80">Dette tar vanligvis bare et øyeblikk.</div>
        </div>
      )}

      {/* CTA */}
      <button
        type="submit"
        disabled={isLoading}
        className="h-12 w-full rounded-2xl bg-[rgb(var(--lp-cta)/1)] px-5 text-sm font-semibold text-white shadow-[0_14px_40px_-18px_rgba(0,0,0,0.45)] ring-1 ring-black/5 transition hover:brightness-[1.03] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status.type === "pending_profile" ? "Setter opp…" : status.type === "loading" ? "Logger inn…" : "Logg inn"}
      </button>

      {/* Test-knapp (kun dev) */}
      {process.env.NODE_ENV !== "production" && (
        <button
          type="button"
          onClick={() => alert("Dev: Opprett testbruker")}
          disabled={isLoading}
          className="h-11 w-full rounded-2xl border border-border bg-white text-sm font-medium text-text shadow-sm hover:bg-[rgb(var(--lp-bg)/1)] disabled:opacity-70"
        >
          Opprett bruker (test)
        </button>
      )}
    </form>
  );
}
