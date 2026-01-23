// app/login/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function safeNextPath(next: string | null) {
  const FALLBACK = "/week";
  if (!next) return FALLBACK;
  if (!next.startsWith("/")) return FALLBACK;
  if (next.startsWith("//")) return FALLBACK;
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

function normalizeRole(v: unknown): Role {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "superadmin") return "superadmin";
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  return "employee";
}

function homeForRole(role: Role) {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  return "/week";
}

export default function LoginPage() {
  const sp = useSearchParams();
  const nextRaw = useMemo(() => safeNextPath(sp.get("next")), [sp]);

  const [phase, setPhase] = useState<"form" | "loading">("form");
  const [err, setErr] = useState<string>("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ Hvis allerede innlogget: send videre umiddelbart
  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getSession();
      if (!alive) return;

      const session = data?.session ?? null;
      if (session?.user) {
        const role = normalizeRole((session.user.user_metadata as any)?.role);
        const target = nextRaw || homeForRole(role);
        window.location.replace(target);
      }
    })();

    return () => {
      alive = false;
    };
  }, [nextRaw]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "loading") return;

    setErr("");
    setPhase("loading");

    try {
      const sb = supabaseBrowser();

      const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data?.user) {
        setErr("Feil e-post eller passord.");
        setPhase("form");
        return;
      }

      const access_token = data.session?.access_token ?? null;
      const refresh_token = data.session?.refresh_token ?? null;

      if (!access_token || !refresh_token) {
        setErr("Innlogging feilet (mangler session). Prøv igjen.");
        setPhase("form");
        return;
      }

      // ✅ Sync til server-cookies
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ access_token, refresh_token }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setErr(j?.message || "Kunne ikke etablere serversession. Prøv igjen.");
        setPhase("form");
        return;
      }

      // ✅ Videre
      window.location.assign(nextRaw);
    } catch {
      setErr("Kunne ikke logge inn. Prøv igjen.");
      setPhase("form");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-10 md:grid-cols-2 md:items-start">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Logg inn</h1>
          <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">
            Tilgang for ansatte og administrator. Bestilling og avbestilling lagres umiddelbart og bekreftes i systemet.
          </p>

          <div className="mt-6 text-sm text-[rgb(var(--lp-muted))]">
            Har du ikke bruker?{" "}
            <Link className="font-medium text-black hover:underline" href="/register">
              Opprett firma
            </Link>
          </div>
        </div>

        <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[rgb(var(--lp-muted))]">E-post</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none focus:ring-2 focus:ring-black/10"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[rgb(var(--lp-muted))]">Passord</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none focus:ring-2 focus:ring-black/10"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {err && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={phase === "loading"}
              className="w-full rounded-2xl bg-[rgb(var(--lp-accent))] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {phase === "loading" ? "Logger inn…" : "Logg inn"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <Link className="text-[rgb(var(--lp-muted))] hover:underline" href="/forgot-password">
                Glemt passord?
              </Link>

              <span className="text-xs text-[rgb(var(--lp-muted))]">Next: {nextRaw}</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
