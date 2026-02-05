"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
    next === "/onboarding" ||
    next.startsWith("/onboarding/") ||
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

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}

function isProbablyEmail(v: string) {
  // simple + safe (avoid being too strict)
  return v.includes("@") && v.includes(".") && v.length >= 6;
}

/**
 * Small safety to avoid leaving a pending abort timer around
 */
function safeClearTimeout(t: any) {
  try {
    clearTimeout(t);
  } catch {
    // ignore
  }
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    // Prefill email from query param if present
    const qpEmail = searchParams.get("email");
    if (qpEmail) setEmail(qpEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const r = await fetch("/api/profile", {
          cache: "no-store",
          credentials: "same-origin",
        });

        // ✅ 202 = pending (trigger/profiles-latency) → vent med backoff
        if (r.status === 202) {
          await sleep(delay);
          delay = Math.min(PROFILE_POLL_MAX_DELAY_MS, Math.floor(delay * 1.4));
          continue;
        }

        // 401 = ikke innlogget (cookies/session mangler)
        if (r.status === 401) {
          setStatus({ type: "error", message: "Du er ikke innlogget. Prøv igjen." });
          return;
        }

        const j = await r.json().catch(() => null);

        if (r.status === 403 && j?.ok && j?.profile) {
          const prof = j.profile;
          if (prof.disabled_at) {
            setStatus({
              type: "error",
              message: prof.disabled_reason || "Kontoen er deaktivert. Kontakt administrator.",
            });
            return;
          }
          if (prof.is_active === false) {
            setStatus({ type: "error", message: "Kontoen er ikke aktiv ennå. Kontakt administrator." });
            return;
          }
        }

        if (r.status === 200 && j?.ok && j?.pending === true && j?.company_status) {
          const st = String(j.company_status ?? "").toLowerCase();
          if (st === "pending") {
            router.replace("/pending");
            return;
          }
          if (st === "paused" || st === "closed") {
            router.replace(`/status?state=${encodeURIComponent(st)}&next=${encodeURIComponent(nextPath)}`);
            return;
          }
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
          router.replace(`/api/auth/post-login?next=${encodeURIComponent(nextPath)}&dbg=login`);
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

    const normalizedEmail = normEmail(email);
    const pwd = password;

    if (!normalizedEmail || !pwd) {
      setStatus({ type: "error", message: "Fyll inn e-post og passord." });
      return;
    }
    if (!isProbablyEmail(normalizedEmail)) {
      setStatus({ type: "error", message: "Skriv inn en gyldig e-postadresse." });
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
        // Prefer server message, but keep it safe/short
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
      safeClearTimeout(t);
    }
  }

  return (
    <form data-section="LoginForm" onSubmit={onSubmit} className="space-y-4">
      {/* E-post */}
      <div>
        <Label htmlFor="email">E-post</Label>
        <Input
          id="email"
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
        />
      </div>

      {/* Passord */}
      <div>
        <Label htmlFor="password">Passord</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearNonSuccessStatus();
            }}
            placeholder="••••••••••"
            disabled={isLoading}
            className="pr-12"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 min-h-[44px] -translate-y-1/2 rounded-lg px-3 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
          >
            {showPassword ? "Skjul" : "Vis"}
          </button>
        </div>
      </div>

      {/* Status */}
      {status.type === "error" && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {status.message}
        </div>
      )}

      {(status.type === "success" || status.type === "pending_profile") && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {status.type === "pending_profile" ? "Setter opp kontoen din…" : status.message}
          <div className="mt-1 text-xs opacity-80">Dette tar vanligvis bare et øyeblikk.</div>
        </div>
      )}

      {/* CTA */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full"
      >
        {status.type === "pending_profile" ? "Setter opp…" : status.type === "loading" ? "Logger inn…" : "Logg inn"}
      </Button>

      {/* Test-knapp (kun dev) */}
      {process.env.NODE_ENV !== "production" && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => alert("Dev: Opprett testbruker")}
          disabled={isLoading}
          className="w-full"
        >
          Opprett bruker (test)
        </Button>
      )}
    </form>
  );
}


