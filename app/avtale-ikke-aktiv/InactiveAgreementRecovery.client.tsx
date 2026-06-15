"use client";

import Link from "next/link";
import { useTransition } from "react";

const POST_LOGIN_URL = "/api/auth/post-login";

async function logoutAndGoToLogin() {
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

type InactiveAgreementRecoveryProps = {
  showProviderRecovery?: boolean;
};

export default function InactiveAgreementRecovery({
  showProviderRecovery = false,
}: InactiveAgreementRecoveryProps) {
  const [isPending, startTransition] = useTransition();

  function onLogout() {
    if (isPending) return;
    startTransition(async () => {
      await logoutAndGoToLogin();
    });
  }

  function onRetry() {
    if (isPending) return;
    window.location.assign(POST_LOGIN_URL);
  }

  function onOpenProviderPortal() {
    if (isPending) return;
    window.location.assign(POST_LOGIN_URL);
  }

  return (
    <>
      {showProviderRecovery ? (
        <p className="ds-body mt-4 text-sm text-[rgb(var(--lp-muted))]">
          Denne siden gjelder bedriftsavtaler. Er du leverandør? Åpne leverandørportalen på nytt.
        </p>
      ) : null}

      <div className="ds-empty-state__actions">
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          disabled={isPending}
          aria-busy={isPending}
          onClick={onLogout}
        >
          {isPending ? "Logger ut …" : "Logg ut og gå til innlogging"}
        </button>

        <button type="button" className="ds-btn ds-btn--secondary" disabled={isPending} onClick={onRetry}>
          Prøv igjen
        </button>

        {showProviderRecovery ? (
          <button
            type="button"
            className="ds-btn ds-btn--secondary"
            disabled={isPending}
            onClick={onOpenProviderPortal}
          >
            Åpne leverandørportalen
          </button>
        ) : null}

        <Link href="/" className="ds-btn ds-btn--secondary">
          Til forsiden
        </Link>
      </div>
    </>
  );
}
