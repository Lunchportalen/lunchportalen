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
      role?: Role;
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

function roleHome(role?: Role): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  return "/week";
}

function displayLabel(email: string | null, role?: Role) {
  // Ønsket av deg: “innlogget bruker” skal være klikkbar og ta deg “hjem”.
  // Vi viser primært rollen (Superadmin/Admin/Kjøkken/Sjåfør/Ansatt) for rolig enterprise-header.
  // Hvis du heller vil vise e-post: bytt return til `email ?? roleLabel(role) ?? "Min side"`.
  const rl = roleLabel(role);
  return rl || email || "Min side";
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
      const role = (sessionUser?.user_metadata?.role as Role | undefined) ?? undefined;

      const label = displayLabel(email, role);
      const homeHref = roleHome(role);

      setState({ type: "authed", email, role, label, homeHref });
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
      {/* ✅ Klikkbart “navn/rolle” tilbake til riktig side */}
      <Link
        href={state.homeHref}
        className="text-sm text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))] hover:underline hover:decoration-[rgba(var(--lp-gold),.75)] hover:underline-offset-4"
        title="Gå til din side"
        aria-label="Gå til din side"
      >
        {state.label}
      </Link>

      <button type="button" onClick={logout} className="text-sm font-medium hover:underline">
        Logg ut
      </button>
    </div>
  );
}
