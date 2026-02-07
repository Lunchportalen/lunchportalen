"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Status =
  | { type: "idle" }
  | { type: "loading"; rid: string }
  | { type: "error"; message: string; rid?: string };

type Role = "employee" | "company_admin" | "superadmin" | "driver" | "kitchen";

type Profile = {
  id: string;
  role: string | null;
  company_id: string | null;
  location_id: string | null;
  is_active: boolean | null;
  disabled_at: string | null;
  disabled_reason: string | null;
};

type ApiProfileOk =
  | {
      ok: true;
      pending: true;
      reason?: string;
      company_status?: string;
      rid?: string;
    }
  | {
      ok: true;
      pending: false;
      profile: Profile;
      profileExists?: boolean;
      rid?: string;
    };

type ApiProfileErr = { ok: false; error?: string; message?: string; rid?: string };
type ApiProfileRes = ApiProfileOk | ApiProfileErr;

const LOGIN_TIMEOUT_MS = 8000;
const PROFILE_TIMEOUT_MS = 5000;

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

function normRole(v: unknown): Role | null {
  const r = safeStr(v).toLowerCase();
  if (r === "superadmin" || r === "company_admin" || r === "employee" || r === "driver" || r === "kitchen") return r;
  return null;
}

function safeNextPath(next: string | null | undefined) {
  if (!next) return null;
  const n = safeStr(next);
  if (!n.startsWith("/")) return null;
  if (n.startsWith("//")) return null;
  if (n.startsWith("/api/")) return null;
  if (
    n === "/login" ||
    n.startsWith("/login/") ||
    n === "/register" ||
    n.startsWith("/register/") ||
    n === "/registrering" ||
    n.startsWith("/registrering/") ||
    n === "/forgot-password" ||
    n.startsWith("/forgot-password/") ||
    n === "/reset-password" ||
    n.startsWith("/reset-password/")
  ) {
    return null;
  }
  return n;
}

function fallbackPathForRole(role: Role): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "driver") return "/driver";
  if (role === "kitchen") return "/kitchen";
  return "/week";
}

function allowNextForRole(role: Role, nextPath: string | null): string | null {
  if (!nextPath) return null;
  if (role === "superadmin") return nextPath.startsWith("/superadmin") ? nextPath : null;
  if (role === "company_admin") return nextPath.startsWith("/admin") ? nextPath : null;
  if (role === "driver") return nextPath.startsWith("/driver") ? nextPath : null;
  if (role === "kitchen") return nextPath.startsWith("/kitchen") ? nextPath : null;
  if (nextPath.startsWith("/orders") || nextPath.startsWith("/week") || nextPath.startsWith("/min-side")) return nextPath;
  return null;
}

/** Small safety to avoid leaving a pending abort timer around */
function safeClearTimeout(t: any) {
  try {
    clearTimeout(t);
  } catch {
    // ignore
  }
}

async function readApiError(res: Response): Promise<string> {
  const clone = res.clone();

  try {
    const data: any = await clone.json();

    if (typeof data?.message === "string" && data.message.trim()) return data.message;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;

    if (data?.error && typeof data.error === "object") {
      const msg =
        data.error.message ||
        data.error.error_description ||
        data.error.details ||
        data.error.hint;
      if (typeof msg === "string" && msg.trim()) return msg;
    }

    return `Innlogging feilet (HTTP ${res.status})`;
  } catch {
    try {
      const text = (await res.text()).trim();
      if (text) return text;
    } catch { }

    return `Innlogging feilet (HTTP ${res.status})`;
  }
}

export default function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [errorText, setErrorText] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    // Prefill email from query param if present
    const qpEmail = searchParams.get("email");
    if (qpEmail) setEmail(qpEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const errParam = searchParams.get("error") || searchParams.get("e");
    if (!errParam) return;
    if (errorText) return;

    const code = safeStr(errParam).toLowerCase();
    let msg = "Kunne ikke fullføre innlogging. Prøv igjen.";
    if (code === "profile_missing" || code === "profile_not_found") {
      msg = "Brukerprofil mangler. Kontakt firma-admin.";
    } else if (code === "profile_incomplete") {
      msg = "Kunne ikke fullføre innlogging. Prøv igjen.";
    } else if (code === "role_forbidden") {
      msg = "Ingen tilgang for denne rollen.";
    } else if (code === "no_session") {
      msg = "Økten din er utløpt. Logg inn på nytt.";
    }

    setStatus({ type: "error", message: msg });
    setErrorText(msg);
  }, [searchParams, errorText]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const isLoading = status.type === "loading" && !errorText;

  function clearNonSuccessStatus() {
    // Keep it simple: typing resets error state
    if (status.type !== "idle") setStatus({ type: "idle" });
    if (errorText) setErrorText("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    const normalizedEmail = normEmail(email);
    const pwd = password;

    if (!normalizedEmail || !pwd) {
      setErrorText("Fyll inn e-post og passord.");
      setStatus({ type: "error", message: "Fyll inn e-post og passord." });
      return;
    }
    if (!isProbablyEmail(normalizedEmail)) {
      setErrorText("Skriv inn en gyldig e-postadresse.");
      setStatus({ type: "error", message: "Skriv inn en gyldig e-postadresse." });
      return;
    }

    const rid = `login_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    setErrorText("");
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
      setErrorText(`Innloggingen tok for lang tid. Prøv igjen. (rid: ${rid})`);
    }, LOGIN_TIMEOUT_MS);

    function hardFailToLogin(reason: string) {
      const to = `/login?error=${encodeURIComponent(reason)}`;
      window.location.assign(to);
    }

    function redirectToOnboarding(reason: string) {
      const base = "/onboarding";
      const nextSafe = safeNextPath(searchParams.get("next"));
      const url = new URL(base, window.location.origin);
      url.searchParams.set("reason", reason);
      if (nextSafe) url.searchParams.set("next", nextSafe);
      window.location.assign(url.toString());
    }

    async function resolvePostLogin(nextParam: string | null) {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), PROFILE_TIMEOUT_MS);

      try {
        const res = await fetch("/api/profile", {
          cache: "no-store",
          credentials: "same-origin",
          signal: ctrl.signal,
        });
        const data = (await res.json().catch(() => null)) as ApiProfileRes | null;

        const authOk =
          res.status !== 401 &&
          !(data && data.ok === false && String(data.error || "").toUpperCase() === "AUTH_REQUIRED");

        if (!authOk || !data) {
          hardFailToLogin("profile_incomplete");
          return;
        }

        if (data.ok === false) {
          const code = safeStr(data.error).toUpperCase();
          if (code === "PROFILE_NOT_FOUND" || code === "PROFILE_NOT_READY") {
            redirectToOnboarding(code.toLowerCase());
            return;
          }
          if (code === "ROLE_FORBIDDEN") {
            const msg = data.message || "Ingen tilgang for denne rollen.";
            setStatus({ type: "error", message: msg, rid: data.rid });
            setErrorText(msg);
            return;
          }
          hardFailToLogin("profile_incomplete");
          return;
        }

        if (data.pending === true) {
          const st = safeStr((data as any).company_status).toLowerCase();
          if (st === "pending") {
            window.location.assign("/pending");
            return;
          }
          if (st === "paused" || st === "closed") {
            const nextSafe = safeNextPath(nextParam) || "/week";
            window.location.assign(`/status?state=${encodeURIComponent(st)}&next=${encodeURIComponent(nextSafe)}`);
            return;
          }
          hardFailToLogin("profile_incomplete");
          return;
        }

        const prof = (data as Extract<ApiProfileOk, { pending: false }>).profile;
        const role = normRole(prof?.role);

        const authState = true;
        const profileExists = Boolean(prof?.id);
        const profileReady =
          Boolean(prof?.id) &&
          Boolean(role) &&
          (role === "superadmin" || role === "driver" || role === "kitchen" || Boolean(prof?.company_id)) &&
          (role !== "employee" || Boolean(prof?.location_id));
        const roleAllowed = Boolean(role);

        if (!authState) {
          hardFailToLogin("profile_incomplete");
          return;
        }
        if (!profileExists || !profileReady || !roleAllowed) {
          redirectToOnboarding("profile_incomplete");
          return;
        }

        if (prof?.disabled_at) {
          const msg = prof.disabled_reason || "Kontoen er deaktivert. Kontakt administrator.";
          setStatus({ type: "error", message: msg, rid: (data as any).rid });
          setErrorText(msg);
          return;
        }
        if (prof?.is_active === false) {
          const msg = "Kontoen er ikke aktiv ennå. Kontakt administrator.";
          setStatus({ type: "error", message: msg, rid: (data as any).rid });
          setErrorText(msg);
          return;
        }

        const allowedNext = allowNextForRole(role as Role, safeNextPath(nextParam));
        const fallback = fallbackPathForRole(role as Role);
        const target = allowedNext ?? fallback;
        const postLoginUrl = `/api/auth/post-login?next=${encodeURIComponent(target)}`;
        window.location.assign(postLoginUrl);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          hardFailToLogin("profile_incomplete");
          return;
        }
        const msg = err?.message || "Kunne ikke fullføre innlogging.";
        setStatus({ type: "error", message: msg, rid: "profile_lookup_failed" });
        setErrorText(msg);
      } finally {
        safeClearTimeout(timeout);
      }
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ email: normalizedEmail, password: pwd }),
        signal: controller.signal,
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        const msg = await readApiError(res);
        setStatus({ type: "error", message: msg, rid });
        setErrorText(msg);
        return;
      }

      const payload: any = await res.json().catch(() => null);

      if (payload?.ok === false) {
        const msg =
          (typeof payload.message === "string" && payload.message.trim() && payload.message) ||
          (typeof payload.error === "string" && payload.error.trim() && payload.error) ||
          `Innlogging feilet (HTTP ${res.status})`;
        setStatus({ type: "error", message: msg, rid });
        setErrorText(msg);
        return;
      }

      if (!mountedRef.current) return;

      // ✅ Hard redirect: avoid App Router/session race and stop any post-success UI logic
      const next = safeNextPath(searchParams.get("next"));
      await resolvePostLogin(next);
      return;
    } catch (err: any) {
      if (!mountedRef.current) return;

      const msg =
        err?.name === "AbortError"
          ? `Innloggingen tok for lang tid. Prøv igjen. (rid: ${rid})`
          : err?.message || "Kunne ikke logge inn. Prøv igjen.";

      setErrorText(msg);
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
      {errorText && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {errorText}
        </div>
      )}

      {isLoading && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Logger inn…
          <div className="mt-1 text-xs opacity-80">Dette tar vanligvis bare et øyeblikk.</div>
        </div>
      )}

      {/* CTA */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-zinc-900 text-white hover:bg-zinc-900 hover:text-white disabled:bg-zinc-900 disabled:text-white disabled:opacity-60"
      >
        {isLoading ? "Logger inn…" : "Logg inn"}
      </Button>

      <div className="text-sm text-[rgb(var(--lp-muted))]">
        <Link href="/forgot-password" className="underline underline-offset-4">
          Glemt passord?
        </Link>
      </div>

      {errorText ? (
        <button
          type="button"
          onClick={() => {
            setStatus({ type: "idle" });
            setErrorText("");
          }}
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
