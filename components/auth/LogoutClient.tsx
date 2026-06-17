"use client";

import type { ButtonHTMLAttributes } from "react";
import { useEffect, useState, useTransition } from "react";

export const LOGOUT_ERROR_MESSAGE = "Kunne ikke logge ut. Prøv igjen.";

export type LogoutRedirectResult = { ok: true } | { ok: false };

export async function performLogoutRedirect(): Promise<LogoutRedirectResult> {
  try {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      redirect: "follow",
      cache: "no-store",
    });

    if (res.redirected && res.url) {
      window.location.href = res.url;
      return { ok: true };
    }

    if (!res.ok) {
      return { ok: false };
    }

    window.location.href = "/login";
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export type LogoutClientButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick"> & {
  className?: string;
};

export function LogoutClientButton({ className, ...rest }: LogoutClientButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onLogout() {
    if (isPending) return;

    startTransition(async () => {
      setError(null);
      const result = await performLogoutRedirect();
      if (!result.ok) {
        setError(LOGOUT_ERROR_MESSAGE);
      }
    });
  }

  return (
    <div className="w-full">
      <button
        type="button"
        className={className ?? "lp-btn lp-btn--ghost lp-btn--sm"}
        disabled={isPending}
        onClick={onLogout}
        aria-busy={isPending}
        title={isPending ? "Logger ut..." : "Logg ut"}
        {...rest}
      >
        {isPending ? "Logger ut..." : "Logg ut"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
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
