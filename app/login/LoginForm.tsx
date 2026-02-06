"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Status =
  | { type: "idle" }
  | { type: "loading"; rid: string }
  | { type: "error"; message: string; rid?: string };

const LOGIN_TIMEOUT_MS = 8000;

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
    next.startsWith("/forgot-password/") ||
    next === "/reset-password" ||
    next.startsWith("/reset-password/")
  ) {
    return FALLBACK;
  }

  return next;
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

function unwrapPayload(j: any) {
  if (j && typeof j === "object" && j.data && typeof j.data === "object") return j.data;
  return j;
}

export default function LoginForm() {
  const searchParams = useSearchParams();

  const safeNext = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);

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

  const isLoading = status.type === "loading";

  function clearNonSuccessStatus() {
    setStatus({ type: "idle" });
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

    const rid = `login_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    setStatus({ type: "loading", rid });

    // Abort previous attempt
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const t = setTimeout(() => {
      controller.abort();
      if (!mountedRef.current) return;
      setStatus({
        type: "error",
        message: `Innloggingen tok for lang tid. Prøv igjen. (rid: ${rid})`,
        rid,
      });
    }, LOGIN_TIMEOUT_MS);

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

      const target = safeNext;
      window.location.assign(target);
      return;
    } catch (err: any) {
      if (!mountedRef.current) return;

      const msg =
        err?.name === "AbortError"
          ? `Innloggingen tok for lang tid. Prøv igjen. (rid: ${rid})`
          : err?.message || "Kunne ikke logge inn. Prøv igjen.";

      setStatus({ type: "error", message: msg, rid });
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

      {status.type === "loading" && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Logger inn …
          <div className="mt-1 text-xs opacity-80">Dette tar vanligvis bare et øyeblikk.</div>
        </div>
      )}

      {/* CTA */}
      <Button type="submit" disabled={isLoading} className="w-full text-white hover:text-white disabled:text-white">
        {status.type === "loading" ? "Logger inn …" : "Logg inn"}
      </Button>

      <div className="text-sm text-[rgb(var(--lp-muted))]">
        <Link href="/forgot-password" className="underline underline-offset-4">
          Glemt passord?
        </Link>
      </div>

      {status.type === "error" ? (
        <button
          type="button"
          onClick={() => setStatus({ type: "idle" })}
          className="w-full min-h-[44px] rounded-2xl border border-[rgb(var(--lp-border))] text-sm"
        >
          Prøv igjen
        </button>
      ) : null}

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
