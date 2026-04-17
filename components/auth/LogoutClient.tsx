"use client";

import { useEffect, useTransition } from "react";

async function performLogoutRedirect() {
  try {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      redirect: "follow",
      cache: "no-store",
    });

    if (res.redirected && res.url) {
      window.location.href = res.url;
      return;
    }

    window.location.href = "/login";
  } catch {
    window.location.href = "/login";
  }
}

export function LogoutClientButton({ className }: { className?: string }) {
  const [isPending, startTransition] = useTransition();

  function onLogout() {
    if (isPending) return;

    startTransition(async () => {
      await performLogoutRedirect();
    });
  }

  return (
    <button
      type="button"
      className={className ?? "lp-btn lp-btn--ghost lp-btn--sm"}
      disabled={isPending}
      onClick={onLogout}
      aria-busy={isPending}
      title={isPending ? "Logger ut..." : "Logg ut"}
    >
      {isPending ? "Logger ut..." : "Logg ut"}
    </button>
  );
}

/** Dedicated `/logout` route only — runs POST logout once on mount. */
export function LogoutOnMountRedirect() {
  useEffect(() => {
    void performLogoutRedirect();
  }, []);

  return <div className="text-sm text-[rgb(var(--lp-muted))]">Logger ut…</div>;
}

/** Header / shell: logout only on explicit click — never on mount (access errors are not auth). */
export default function LogoutClient() {
  return <LogoutClientButton className="lp-btn lp-btn--ghost lp-btn--sm" />;
}
