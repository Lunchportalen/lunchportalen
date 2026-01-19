// app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type MeOk = {
  ok: true;
  user: { id: string; email: string | null; role: Role; companyId: string | null };
};

const CHECK_TIMEOUT_MS = 1500;

function safeNextPath(next: string | null) {
  const FALLBACK = "/week";
  if (!next) return FALLBACK;
  if (!next.startsWith("/")) return FALLBACK;
  if (next.startsWith("//")) return FALLBACK;

  // unngå loops til public routes
  if (
    next === "/login" ||
    next.startsWith("/login/") ||
    next === "/register" ||
    next.startsWith("/register/") ||
    next === "/forgot-password" ||
    next.startsWith("/forgot-password/") ||
    next === "/auth/callback" ||
    next.startsWith("/auth/callback")
  ) {
    return FALLBACK;
  }

  return next;
}

function homeForRole(role: Role) {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  return "/week";
}

function resolveNextForRole(role: Role, next: string) {
  // superadmin skal aldri inn i operativ flyt
  if (role === "superadmin") return "/superadmin";

  // kitchen/driver skal heller ikke havne på week/min-side
  if (role === "kitchen" && (next.startsWith("/week") || next.startsWith("/min-side"))) return "/kitchen";
  if (role === "driver" && (next.startsWith("/week") || next.startsWith("/min-side"))) return "/driver";

  // company_admin: hvis next peker på week/min-side, send til admin
  if (role === "company_admin" && (next.startsWith("/week") || next.startsWith("/min-side"))) return "/admin";

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

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = useMemo(() => safeNextPath(sp.get("next")), [sp]);

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const me = await checkMe();
      if (!alive) return;

      if (!me?.ok) {
        // ikke innlogget (eller /api/me feilet) -> tilbake til login
        router.replace(`/login?next=${encodeURIComponent(nextRaw)}`);
        return;
      }

      const role = me.user.role;
      const target = resolveNextForRole(role, nextRaw) || homeForRole(role);

      router.replace(target);
    })().catch((e: any) => {
      if (!alive) return;
      setErr(e?.message || "Kunne ikke fullføre innlogging. Prøv igjen.");
      // fallback
      router.replace(`/login?next=${encodeURIComponent(nextRaw)}`);
    });

    return () => {
      alive = false;
    };
  }, [router, nextRaw]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm text-[rgb(var(--lp-muted))]">
          Sender deg videre…
          <div className="mt-2 text-xs">Next: {nextRaw}</div>
        </div>

        {err && (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
