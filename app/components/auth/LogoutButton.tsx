"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const LOGOUT_TIMEOUT_MS = 5000;

type Props = {
  variant?: "ghost" | "solid";
};

export default function LogoutButton({ variant = "ghost" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);

    try {
      /**
       * 1) SERVER logout
       * - tømmer Supabase cookies (SSR/session)
       */
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ignore
      }

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Kunne ikke logge ut. Prøv igjen.");
      }

      /**
       * 2) CLIENT logout
       * - tømmer localStorage / in-memory session
       * - KRITISK for å unngå auto-relogin
       */
      await supabaseBrowser().auth.signOut({ scope: "local" });

      /**
       * 3) Hard redirect + refresh
       * - sikrer at SSR + middleware starter helt clean
       */
      router.replace("/login");
      router.refresh();
    } catch (err: any) {
      // Enterprise: ikke spam alerts – men gi tydelig, rolig fallback
      console.error("[LogoutButton]", err?.message || err);

      // Best effort: prøv å tømme client-session selv om server-feiler/aborts
      try {
        await supabaseBrowser().auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }

      router.replace("/login");
      router.refresh();
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  /* =========================
     Styling
  ========================= */
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70";

  const ghost =
    "border border-border bg-white px-4 py-2 text-text shadow-sm hover:bg-[rgb(var(--lp-bg)/1)]";

  const solid =
    "bg-[rgb(var(--lp-cta)/1)] px-4 py-2 text-white shadow-[0_14px_40px_-18px_rgba(0,0,0,0.45)] ring-1 ring-black/5 hover:brightness-[1.03] active:brightness-95";

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className={`${base} ${variant === "solid" ? solid : ghost}`}
      aria-label="Logg ut"
    >
      {loading ? "Logger ut…" : "Logg ut"}
    </button>
  );
}
