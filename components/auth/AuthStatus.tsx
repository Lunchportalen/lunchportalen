// components/auth/AuthStatus.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type State =
  | { type: "loading" }
  | { type: "anon" }
  | {
      type: "authed";
      email: string | null;
      label: string; // det som vises i headeren (klikkbart)
      homeHref: string; // hvor man går når man klikker på label
    };

function roleLabel(role?: Role) {
  if (!role) return "";
  if (role === "superadmin") return "Superadmin";
  if (role === "company_admin") return "Admin";
  if (role === "kitchen") return "Kjøkken";
  if (role === "driver") return "Sjåfør";
  return "Ansatt";
}

function displayLabel(name: string | null, email: string | null, role?: Role) {
  const rl = roleLabel(role);
  return name || email || rl || "Min side";
}

/**
 * AuthStatus – PASSIV status-komponent
 * ---------------------------------------------------------
 * Viktige prinsipper (for å unngå canceled fetch / redirect-støy):
 * - Ingen router.push / replace
 * - Ingen fetch mot egne /api/* endepunkt
 * - Kun lesing av Supabase session
 * - Middleware er eneste autoritet for redirect
 */
export default function AuthStatus() {
  const [state, setState] = useState<State>({ type: "loading" });

  const loginNext = useMemo(() => encodeURIComponent("/week"), []);

  useEffect(() => {
    const sb = supabaseBrowser();
    let mounted = true;

    function setAuthed(sessionUser: any) {
      const email = (sessionUser?.email as string | null) ?? null;
      // D4: user_metadata is NEVER an authorization source. The header label is
      // display-only (name/email) and the home link routes through the ONE
      // canonical server-side resolver — role is resolved there, not here.
      const name =
        (sessionUser?.user_metadata?.full_name as string | null) ??
        (sessionUser?.user_metadata?.name as string | null) ??
        null;

      const label = displayLabel(name, email, undefined);
      const homeHref = "/api/auth/post-login";

      setState({ type: "authed", email, label, homeHref });
    }

    // 1) Initial session (én gang)
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const session = data.session;
        if (session?.user) setAuthed(session.user);
        else setState({ type: "anon" });
      })
      .catch(() => {
        if (mounted) setState({ type: "anon" });
      });

    // 2) Realtime auth-endringer (login / logout)
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) setAuthed(session.user);
      else setState({ type: "anon" });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    try {
      const sb = supabaseBrowser();
      await sb.auth.signOut();
    } finally {
      // Hard reload er korrekt her: middleware tar over
      window.location.href = "/";
    }
  }

  if (state.type === "loading") {
    return <div className="text-sm text-[rgb(var(--lp-muted))]">Sjekker…</div>;
  }

  if (state.type === "anon") {
    return (
      <div className="flex items-center gap-3">
        <Link className="text-sm hover:underline" href={`/login?next=${loginNext}`}>
          Logg inn
        </Link>

        <Link
          className="rounded-full bg-[rgb(var(--lp-accent))] px-4 py-2 text-sm font-semibold text-white"
          href="/register"
        >
          Registrer firma
        </Link>
      </div>
    );
  }

  // authed
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[rgb(var(--lp-text))]">{state.label}</span>
      <button type="button" onClick={logout} className="text-sm font-medium hover:underline">
        Logg ut
      </button>
    </div>
  );
}
