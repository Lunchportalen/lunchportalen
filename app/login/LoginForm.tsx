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

type ApiProfile = {
  id: string;
  role: string;
  company_id: string | null;
  location_id: string | null;
  is_active: boolean | null;
  disabled_at: string | null;
  disabled_reason: string | null;
};

type ApiProfileOk = {
  ok: true;
  rid: string;
  pending?: boolean;
  reason?: string;
  company_status?: string;
  profileExists?: boolean;
  userId?: string;
  profile?: ApiProfile;
};

type ApiProfileErr = {
  ok: false;
  rid?: string;
  error: string;
  message?: string;
};

type ApiProfileRes = ApiProfileOk | ApiProfileErr;

type ApiLoginOk = {
  ok: true;
  rid?: string;
};

type ApiLoginErr = {
  ok: false;
  rid?: string;
  error?: string;
  message?: string;
};

type ApiLoginRes = ApiLoginOk | ApiLoginErr;

const LOGIN_TIMEOUT_MS = 8000;
const PROFILE_TIMEOUT_MS = 8000;

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

function resolveNext(rawNext: string | null | undefined) {
  const n = safeStr(rawNext);

  // ✅ default always /week
  if (!n || n === "/" || n === "/login") return "/week";

  // ✅ basic open-redirect hardening
  if (!n.startsWith("/")) return "/week";
  if (n.startsWith("//")) return "/week";
  if (n.startsWith("/api/")) return "/week";

  // ✅ never bounce back into onboarding/auth flows
  if (
    n === "/register" ||
    n.startsWith("/register/") ||
    n === "/registrering" ||
    n.startsWith("/registrering/") ||
    n === "/forgot-password" ||
    n.startsWith("/forgot-password/") ||
    n === "/reset-password" ||
    n.startsWith("/reset-password/") ||
    n === "/orders"
  ) {
    return "/week";
  }

  // ✅ allowlist only
  const allowed = new Set([
    "/week",
    "/bestillinger",
    "/min-side",
    "/admin",
    "/superadmin",
    "/kitchen",
    "/driver",
  ]);

  return allowed.has(n) ? n : "/week";
}

function safeClearTimeout(t: any) {
  try {
    clearTimeout(t);
  } catch {
    // ignore
  }
}

function errorMessageForCode(code: string): string | null {
  const c = safeStr(code).toUpperCase();

  // profile/system
  if (c === "PROFILE_MISSING" || c === "PROFILE_NOT_FOUND")
    return "Brukerprofil mangler. Kontakt firma-admin.";
  if (c === "NO_COMPANY" || c === "COMPANY_MISSING")
    return "Kontoen mangler firmatilknytning. Kontakt firma-admin.";
  if (c === "NO_AGREEMENT") return "Firma mangler aktiv avtale. Kontakt firma-admin.";

  // access
  if (c === "INACTIVE" || c === "ACCOUNT_DISABLED" || c === "ACCOUNT_INACTIVE")
    return "Kontoen er ikke aktivert ennå. Du får tilgang når firmaet er aktivert.";
  if (c === "UNAUTHORIZED" || c === "NO_SESSION" || c === "UNAUTHENTICATED")
    return "Økten din er utløpt. Logg inn på nytt.";
  if (c === "ROLE_FORBIDDEN" || c === "FORBIDDEN_ROLE")
    return "Ingen tilgang for denne rollen.";

  // pending/company
  if (c === "PROFILE_NOT_READY")
    return "Kontoen er ikke klar. Kontakt firma-admin.";
  if (c === "COMPANY_PENDING")
    return "Firmaet er under opprettelse. Du får tilgang så snart det er klart.";
  if (c === "COMPANY_NOT_ACTIVE")
    return "Firmaet er ikke aktivert ennå. Du får tilgang når alt er klart.";

  // misc
  if (c === "PROFILE_INCOMPLETE")
    return "Kunne ikke fullføre innlogging. Prøv igjen.";

  return null;
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
    } catch {
      // ignore
    }
    return `Innlogging feilet (HTTP ${res.status})`;
  }
}

/**
 * Decide post-login destination based on profile result.
 * IMPORTANT: This must NEVER block a successful auth login for system roles.
 */
function destinationForProfile(nextParam: string | null, prof?: ApiProfile) {
  // Default safe
  const nextSafe = resolveNext(nextParam);

  const role = safeStr(prof?.role).toLowerCase();
  if (role === "superadmin") return "/superadmin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  if (role === "company_admin") return "/admin";
  if (role === "employee") return nextSafe;

  // Unknown role: safest is /week (will be gated server-side if not allowed)
  return nextSafe;
}

export default function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [errorText, setErrorText] = useState("");
  const [loadingLabel, setLoadingLabel] = useState("Logger inn…");

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const didRedirectRef = useRef(false);
  const profileFetchedRef = useRef(false);

  useEffect(() => {
    const qpEmail = searchParams.get("email");
    if (qpEmail) setEmail(qpEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const errParam = searchParams.get("error") || searchParams.get("e");
    if (!errParam) return;
    if (errorText) return;

    const msg = errorMessageForCode(errParam) || "Kunne ikke fullføre innlogging. Prøv igjen.";
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
    if (status.type !== "idle") setStatus({ type: "idle" });
    if (errorText) setErrorText("");
  }

  /**
   * ✅ Post-login step:
   * We fetch /api/auth/profile to route correctly.
   *
   * CRITICAL enterprise safety:
   * - Never "fail login" just because profile is pending/inactive.
   * - Instead: redirect to /status with correct state.
   * - Superadmin must ALWAYS be able to route to /superadmin.
   */
  async function checkProfileAndRedirect(nextParam: string | null) {
    if (profileFetchedRef.current || didRedirectRef.current) return;
    profileFetchedRef.current = true;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), PROFILE_TIMEOUT_MS);

    try {
      const res = await fetch("/api/auth/profile", {
        cache: "no-store",
        credentials: "same-origin",
        signal: ctrl.signal,
      });

      const data = (await res.json().catch(() => null)) as ApiProfileRes | null;
      if (!mountedRef.current) return;

      // If profile endpoint is down, still don't "break login". Route to a safe place.
      if (!data) {
        if (!didRedirectRef.current) {
          didRedirectRef.current = true;
          window.location.assign("/status?state=paused&next=" + encodeURIComponent(resolveNext(nextParam)));
        }
        return;
      }

      if ((data as any).ok === false) {
        const err = data as ApiProfileErr;
        const code = safeStr(err.error);

        // Route to status for known gating reasons, instead of showing "login failed"
        const mapped = errorMessageForCode(code);
        if (!didRedirectRef.current) {
          didRedirectRef.current = true;

          const state =
            code.toUpperCase() === "ACCOUNT_INACTIVE" || code.toUpperCase() === "COMPANY_NOT_ACTIVE"
              ? "pending"
              : "paused";

          window.location.assign(
            "/status?state=" +
              encodeURIComponent(state) +
              "&next=" +
              encodeURIComponent(resolveNext(nextParam)) +
              (err.rid ? "&rid=" + encodeURIComponent(err.rid) : "") +
              "&code=" +
              encodeURIComponent(code || "PROFILE_ERROR")
          );
        }

        // Also surface a readable message briefly (in case redirect blocked)
        const msg =
          (typeof err.message === "string" && err.message.trim() && err.message) ||
          mapped ||
          "Kunne ikke fullføre innlogging.";
        setStatus({ type: "error", message: msg, rid: err.rid });
        setErrorText(msg);
        return;
      }

      const ok = data as ApiProfileOk;

      // pending gate: do NOT treat as login failure -> go to status
      if (ok.pending === true) {
        if (!didRedirectRef.current) {
          didRedirectRef.current = true;

          const st = safeStr(ok.company_status).toLowerCase();
          const state = st === "closed" || st === "paused" ? st : "pending";

          window.location.assign(
            "/status?state=" +
              encodeURIComponent(state) +
              "&next=" +
              encodeURIComponent(resolveNext(nextParam)) +
              "&rid=" +
              encodeURIComponent(ok.rid) +
              (ok.reason ? "&code=" + encodeURIComponent(ok.reason) : "")
          );
        }
        return;
      }

      const prof = ok.profile;

      // Profile missing -> status (not login failure)
      if (!prof?.id || !prof?.role) {
        if (!didRedirectRef.current) {
          didRedirectRef.current = true;
          window.location.assign(
            "/status?state=pending&next=" +
              encodeURIComponent(resolveNext(nextParam)) +
              "&rid=" +
              encodeURIComponent(ok.rid) +
              "&code=PROFILE_MISSING"
          );
        }
        return;
      }

      // disabled/inactive -> status
      if (prof.disabled_at || prof.is_active === false) {
        if (!didRedirectRef.current) {
          didRedirectRef.current = true;
          window.location.assign(
            "/status?state=pending&next=" +
              encodeURIComponent(resolveNext(nextParam)) +
              "&rid=" +
              encodeURIComponent(ok.rid) +
              "&code=ACCOUNT_INACTIVE"
          );
        }
        return;
      }

      // ✅ success: route by role + allowlisted next
      const destination = destinationForProfile(nextParam, prof);

      if (!didRedirectRef.current) {
        didRedirectRef.current = true;
        // keep your existing post-login endpoint (sets cookies/redirect server-side)
        window.location.assign("/api/auth/post-login?next=" + encodeURIComponent(destination));
      }
    } catch (err: any) {
      if (!mountedRef.current) return;

      // Timeout/profile issues: do NOT break login; route to status
      if (!didRedirectRef.current) {
        didRedirectRef.current = true;
        const nextSafe = resolveNext(nextParam);
        window.location.assign("/status?state=paused&next=" + encodeURIComponent(nextSafe) + "&code=PROFILE_TIMEOUT");
      }

      const msg =
        err?.name === "AbortError"
          ? "Setter opp kontoen tok for lang tid. Prøv igjen."
          : err?.message || "Kunne ikke fullføre innlogging.";

      setStatus({ type: "error", message: msg, rid: "profile_failed" });
      setErrorText(msg);
    } finally {
      safeClearTimeout(timeout);
      try {
        ctrl.abort();
      } catch {
        // ignore
      }
    }
  }

  async function handleLogin() {
    if (isLoading) return;

    const normalizedEmail = normEmail(email);
    const pwd = password;

    if (!normalizedEmail || !pwd) {
      const msg = "Fyll inn e-post og passord.";
      setErrorText(msg);
      setStatus({ type: "error", message: msg });
      return;
    }
    if (!isProbablyEmail(normalizedEmail)) {
      const msg = "Skriv inn en gyldig e-postadresse.";
      setErrorText(msg);
      setStatus({ type: "error", message: msg });
      return;
    }

    const rid = `login_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    setErrorText("");
    setStatus({ type: "loading", rid });
    setLoadingLabel("Logger inn…");
    didRedirectRef.current = false;
    profileFetchedRef.current = false;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const t = setTimeout(() => {
      controller.abort();
      if (!mountedRef.current) return;
      const msg = `Innloggingen tok for lang tid. Prøv igjen. (rid: ${rid})`;
      setStatus({ type: "error", message: msg, rid });
      setErrorText(msg);
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

      if (!mountedRef.current) return;

      if (!res.ok) {
        const msg = await readApiError(res);
        setStatus({ type: "error", message: msg, rid });
        setErrorText(msg);
        return;
      }

      const payload = (await res.json().catch(() => null)) as ApiLoginRes | null;

      // If API returns structured error
      if (payload && (payload as any).ok === false) {
        const p = payload as ApiLoginErr;
        const msg =
          (typeof p.message === "string" && p.message.trim() && p.message) ||
          (typeof p.error === "string" && p.error.trim() && p.error) ||
          "Kunne ikke logge inn. Prøv igjen.";
        setStatus({ type: "error", message: msg, rid: p.rid || rid });
        setErrorText(msg);
        return;
      }

      // ✅ important: ensure login always lands on /week (unless allowlisted)
      const next = searchParams.get("next");
      setLoadingLabel("Setter opp kontoen din…");

      // Critical: do not throw; this function handles safe routing even if profile is pending.
      await checkProfileAndRedirect(next);
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

  const showTestSignup =
    process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SHOW_TEST_SIGNUP === "true";

  return (
    <div data-section="LoginForm" className="space-y-4">
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleLogin();
              }
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
          {loadingLabel}
          <div className="mt-1 text-xs opacity-80">Dette tar vanligvis bare et øyeblikk.</div>
        </div>
      )}

      {/* ✅ Native button (event-safe) */}
      <button
        type="button"
        disabled={isLoading}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleLogin();
        }}
        className="w-full min-h-[44px] rounded-2xl bg-zinc-900 text-white hover:bg-zinc-900 disabled:opacity-60"
      >
        {isLoading ? "Logger inn…" : "Logg inn"}
      </button>

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

      {showTestSignup ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => alert("Dev: Opprett testbruker")}
          disabled={isLoading}
          className="w-full"
        >
          Opprett bruker (test)
        </Button>
      ) : null}
    </div>
  );
}
