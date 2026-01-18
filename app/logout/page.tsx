"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LogoutPage() {
  useEffect(() => {
    (async () => {
      try {
        const sb = supabaseBrowser();
        await sb.auth.signOut();
      } finally {
        // Hard refresh så SSR/cookies og UI er 100% sync
        window.location.href = "/";
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm text-[rgb(var(--lp-muted))]">Logger ut…</div>
      </div>
    </div>
  );
}
