"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Helpers (låst)
========================================================= */

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function isSystemAccountEmail(email: string | null | undefined) {
  const e = normEmail(email);
  return (
    e === "superadmin@lunchportalen.no" ||
    e === "kjokken@lunchportalen.no" ||
    e === "driver@lunchportalen.no" ||
    e === "ordre@lunchportalen.no"
  );
}

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
    next === "/registrering" ||
    next.startsWith("/registrering/") ||
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

// Server bestemmer endelig redirect
function toRedirectUrl(nextRaw: string) {
  return `/api/auth/redirect?next=${encodeURIComponent(nextRaw)}`;
}

type Phase = "form" | "loading" | "pending_profile";

/* =========================================================
   Page
========================================================= */

export default function LoginPage() {
  const sp = useSearchParams();
  const nextRaw = useMemo(() => safeNextPath(sp.get("next")), [sp]);

  const okParam = sp.get("ok");
  const emailParam = sp.get("email") ?? "";

  const [phase, setPhase] = useState<Phase>("form");
  const [err, setErr] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (okParam === "invite_accepted") {
      setNote("Kontoen er opprettet. Logg inn for å komme i gang.");
    }
  }, [okParam]);

  // Hvis allerede innlogget → la server bestemme
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const sb = supabaseBrowser();
        const { data } = await sb.auth.getSession();
        if (!alive) return;

        const session = data?.session ?? null;
        if (session?.user) {
          window.location.replace(toRedirectUrl(nextRaw));
        }
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, [nextRaw]);

  async function pollProfileThenRedirect(next: string) {
    setPhase("pending_profile");

    const maxTries = 24;
    for (let i = 0; i < maxTries; i++) {
      const r = await fetch("/api/auth/profile", { cache: "no-store" });
      const j = await r.json().catch(() => null);

      if (j?.ok && j?.profileExists && j?.profile) {
        if (j.profile.disabled_at) {
          setErr(j.profile.disabled_reason || "Kontoen er deaktivert.");
          setPhase("form");
          return;
        }
        if (j.profile.is_active === false) {
          setErr("Kontoen er ikke aktiv ennå.");
          setPhase("form");
          return;
        }

        window.location.replace(toRedirectUrl(next));
        return;
      }

      await new Promise((res) => setTimeout(res, 500));
    }

    setErr("Vi setter opp kontoen din. Vent litt og prøv igjen.");
    setPhase("form");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase !== "form") return;

    setErr("");
    setNote("");
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

      if (access_token && refresh_token) {
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ access_token, refresh_token }),
        });

        if (!res.ok) {
          setErr("Kunne ikke etablere serversession.");
          setPhase("form");
          return;
        }
      }

      const metaRole = normalizeRole((data.user as any)?.user_metadata?.role);
      const signedInEmail = normEmail(data.user.email);

      // ✅ ORDRE-KONTO: alltid direkte til /outbox
      if (signedInEmail === "ordre@lunchportalen.no") {
        window.location.replace(toRedirectUrl("/outbox"));
        return;
      }

      // ✅ Andre systemkontoer (uendret)
      if (metaRole === "superadmin" || metaRole === "kitchen" || metaRole === "driver" || isSystemAccountEmail(signedInEmail)) {
        window.location.replace(toRedirectUrl(homeForRole(metaRole)));
        return;
      }

      await pollProfileThenRedirect(nextRaw);
    } catch {
      setErr("Kunne ikke logge inn.");
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
          {note && (
            <div className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))]">
              {note}
            </div>
          )}

          {phase === "pending_profile" && (
            <div className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))]">
              <div className="font-semibold">Setter opp kontoen din…</div>
              <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Dette tar vanligvis bare et øyeblikk.</div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium">E-post</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
                type="email"
                required
                disabled={phase !== "form"}
              />
            </div>

            <div>
              <label className="text-xs font-medium">Passord</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
                type="password"
                required
                disabled={phase !== "form"}
              />
            </div>

            {err && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>}

            <button
              type="submit"
              disabled={phase !== "form"}
              className="w-full rounded-2xl bg-[rgb(var(--lp-accent))] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {phase === "loading" ? "Logger inn…" : phase === "pending_profile" ? "Setter opp…" : "Logg inn"}
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
