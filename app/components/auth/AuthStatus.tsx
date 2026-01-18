"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type State =
  | { type: "loading" }
  | { type: "anon" }
  | { type: "authed"; email: string | null; role?: Role };

function roleLabel(role?: Role) {
  if (!role) return "";
  if (role === "superadmin") return "Superadmin";
  if (role === "company_admin") return "Admin";
  if (role === "kitchen") return "Kjøkken";
  if (role === "driver") return "Sjåfør";
  return "Ansatt";
}

export default function AuthStatus() {
  const [state, setState] = useState<State>({ type: "loading" });

  useEffect(() => {
    const sb = supabaseBrowser();

    // 1) initial session
    sb.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session?.user) {
        setState({ type: "authed", email: session.user.email ?? null });
      } else {
        setState({ type: "anon" });
      }
    });

    // 2) realtime updates (login/logout)
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setState({ type: "authed", email: session.user.email ?? null });
      } else {
        setState({ type: "anon" });
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    try {
      const sb = supabaseBrowser();
      await sb.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

  if (state.type === "loading") {
    return <div className="text-sm text-[rgb(var(--lp-muted))]">Sjekker…</div>;
  }

  if (state.type === "anon") {
    return (
      <div className="flex items-center gap-3">
        <Link className="text-sm hover:underline" href="/login?next=%2Fweek">
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

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-[rgb(var(--lp-muted))] md:inline">
        {roleLabel(state.role)}
      </span>

      <button
        type="button"
        onClick={logout}
        className="text-sm font-medium hover:underline"
      >
        Logg ut
      </button>
    </div>
  );
}
