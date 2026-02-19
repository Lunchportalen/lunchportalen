// app/login/LoginForm.tsx
"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

/**
 * ✅ Enterprise login (deterministisk)
 * 1) Browser signInWithPassword (SSR-kompatibel klient)
 * 2) POST /api/auth/post-login med access/refresh tokens (server setter httpOnly cookies via setSession)
 * 3) Hard redirect til GET /api/auth/post-login (DB-truth routing)
 *
 * Resultat:
 * - Ingen NO_SESSION loop
 * - /api/debug/whoami blir ok:true etter login
 */

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}

function mustEnv(name: string) {
  const v = safeStr((process as any)?.env?.[name] ?? (globalThis as any)?.process?.env?.[name] ?? "");
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function resolveNext(raw: string | null) {
  const n = safeStr(raw);

  // default
  if (!n || n === "/" || n === "/login") return "/week";

  // open redirect hardening
  if (!n.startsWith("/")) return "/week";
  if (n.startsWith("//")) return "/week";
  if (n.startsWith("/api/")) return "/week";
  if (/[\r\n\t]/.test(n)) return "/week";

  // no auth loops
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
    n.startsWith("/reset-password/") ||
    n === "/onboarding" ||
    n.startsWith("/onboarding/")
  ) {
    return "/week";
  }

  // conservative allow-list
  const allowed = new Set([
    "/week",
    "/admin",
    "/superadmin",
    "/kitchen",
    "/driver",
    "/hvordan",
    "/lunsjordning",
    "/alternativ-til-kantine",
    "/",
  ]);

  return allowed.has(n) ? n : "/week";
}

function makeSupabase() {
  // createBrowserClient er SSR-kompatibel (matcher server cookie-format)
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createBrowserClient(url, anon);
}

export default function LoginForm() {
  const sp = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string>("");

  const supabaseRef = React.useRef<ReturnType<typeof makeSupabase> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = makeSupabase();

  async function onLogin() {
    if (busy) return;

    setErr("");
    setBusy(true);

    try {
      const em = normEmail(email);
      const pw = String(password ?? "");

      if (!em || !pw) {
        setErr("Fyll inn e-post og passord.");
        return;
      }

      const sb = supabaseRef.current!;

      // 1) Client sign-in => får tokens deterministisk
      const { data, error } = await sb.auth.signInWithPassword({ email: em, password: pw });

      if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
        setErr(safeStr(error?.message) || "Kunne ikke logge inn.");
        return;
      }

      // 2) Token bridge => server setter httpOnly cookies
      const nextRaw = sp.get("next");
      const next = resolveNext(nextRaw);

      const resp = await fetch("/api/auth/post-login", {
        method: "POST",
        headers: { "content-type": "application/json", "cache-control": "no-store" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          next,
        }),
      });

      // Hvis server svarer 4xx/5xx, vis tekst (ikke loop)
      if (!resp.ok && resp.status !== 303) {
        const text = await resp.text().catch(() => "");
        setErr(text.trim() || `Innlogging feilet (HTTP ${resp.status}).`);
        return;
      }

      // 3) Hard redirect (DB-truth routing på server)
      const url = next ? `/api/auth/post-login?next=${encodeURIComponent(next)}` : `/api/auth/post-login`;
      window.location.assign(url);
    } catch (e: any) {
      setErr("Uventet feil ved innlogging.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium">E-post</label>
        <input
          className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          autoComplete="email"
          inputMode="email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Passord</label>
        <input
          className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          autoComplete="current-password"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void onLogin();
            }
          }}
        />
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      ) : null}

      <button
        type="button"
        className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
        disabled={busy}
        onClick={() => void onLogin()}
      >
        {busy ? "Logger inn…" : "Logg inn"}
      </button>
    </div>
  );
}
