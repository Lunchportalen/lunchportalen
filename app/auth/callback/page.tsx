// app/auth/callback/page.tsx
"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function safeNextPath(next: string | null) {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (next.startsWith("/login")) return "/";
  if (next.startsWith("/auth/callback")) return "/";
  return next;
}

function AuthCallbackInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const next = safeNextPath(sp.get("next"));
    // 🚀 Ingen sjekk. Ingen venting. Middleware er fasit.
    router.replace(next);
  }, [router, sp]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm text-[rgb(var(--lp-muted))]">
          Fullfører innlogging…
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-600">Laster…</div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
