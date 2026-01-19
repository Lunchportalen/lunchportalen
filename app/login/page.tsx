// app/login/page.tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type MeOk = {
  ok: true;
  user: { id: string; email: string | null; role: Role; companyId: string | null };
};

const CHECK_TIMEOUT_MS = 1200;

function safeNextPath(next: string | null) {
  const FALLBACK = "/week";
  if (!next) return FALLBACK;
  if (!next.startsWith("/")) return FALLBACK;
  if (next.startsWith("//")) return FALLBACK;

  // Unngå redirect-loop til public routes
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

// ✅ FASIT: superadmin skal til /superadmin (ikke /today og ikke /admin hvis dere bruker /superadmin)
function homeForRole(role: Role) {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  return "/week"; // employee
}

function resolveNextForRole(role: Role, next: string) {
  // ✅ Superadmin skal aldri inn på operativ /week eller /min-side
  if (role === "superadmin") {
    if (next.startsWith("/week") || next.startsWith("/min-side")) return "/superadmin";
    if (next.startsWith("/admin")) return "/superadmin"; // unngå gammel path
  }

  // ✅ Kjøkken/driver bør heller ikke havne på week/min-side
  if (role === "kitchen") {
    if (next.startsWith("/week") || next.startsWith("/min-side")) return "/kitchen";
  }
  if (role === "driver") {
    if (next.startsWith("/week") || next.startsWith("/min-side")) return "/driver";
  }

  // ✅ Company admin kan fint lande på /admin hvis next er week/min-side
  if (role === "company_admin") {
    if (next.startsWith("/week") || next.startsWith("/min-side")) return "/admin";
  }

  return next;
}

async function checkMe(): Promise<MeOk | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);

  try {
    const res = await fetch("/api/me", { cache: "no-store", signal: ctrl.signal });
    if (res.status === 401) return null;
    if (!res.ok) return null;

    const json = (await res.json().catch(() => null)) as MeOk | null;
    if (!json || !json.ok) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = useMemo(() => safeNextPath(sp.get("next")), [sp]);

  const [phase, setPhase] = useState<"checking" | "form" | "loading">("checking");
  const [err, setErr] = useState<string>("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ Hvis allerede innlogget: send videre (skal aldri henge)
  useEffect(() => {
    let alive = true;

    (async () => {
      const me = await checkMe();
      if (!alive) return;

      if (me?.ok) {
        const role = me.user.role;
        const resolved = resolveNextForRole(role, nextRaw) || homeForRole(role);
        router.replace(resolved);
        return;
      }

      setPhase("form");
    })();

    return () => {
      alive = false;
    };
  }, [router, nextRaw]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "loading") return;

    setErr("");
    setPhase("loading");

    try {
      const sb = supabaseBrowser();

      // ✅ signInWithPassword støtter ikke redirectTo/options
      const { error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErr("Feil e-post eller passord.");
        setPhase("form");
        return;
      }

      // ✅ La session oppdatere seg
      await sb.auth.getSession().catch(() => null);

      // ✅ All routing etter login går via callback (rollebasert)
      router.replace(`/auth/callback?next=${encodeURIComponent(nextRaw)}`);
    } catch {
      setErr("Kunne ikke logge inn. Prøv igjen.");
      setPhase("form");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-10 md:grid-cols-2 md:items-start">
        {/* Venstre */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Logg inn</h1>
          <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">
            Tilgang for ansatte og administrator. Bestilling og avbestilling lagres
            umiddelbart og bekreftes i systemet.
          </p>

          <div className="mt-6 text-sm text-[rgb(var(--lp-muted))]">
            Har du ikke bruker?{" "}
            <Link className="font-medium text-black hover:underline" href="/register">
              Opprett firma
            </Link>
          </div>
        </div>

        {/* Høyre */}
        <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
          {phase === "checking" ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">
              Sjekker innlogging…
              <div className="mt-2 text-xs">
                Hvis du allerede er innlogget, sendes du videre automatisk.
              </div>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
