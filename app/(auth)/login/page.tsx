export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "./LoginForm";
import { getLocalRuntimeLoginCredentials } from "@/lib/auth/localRuntimeAuth";
import { getSupabasePublicConfigStatus } from "@/lib/config/env-public";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { homeForRole, type Role } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Logg inn - Lunchportalen",
  description: "Sikker innlogging for ansatte og administratorer i Lunchportalen.",
  robots: { index: false, follow: false },
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const code = safeStr(Array.isArray(params.code) ? params.code[0] : params.code);

  // If the visitor was just kicked back here from a protected page (code set),
  // don't auto-redirect — render the form so they can recover instead of
  // bouncing between /login and the failing destination.
  if (!code) {
    try {
      const auth = await getAuthContext();
      if (auth.ok && auth.role) {
        redirect(homeForRole(auth.role as Role));
      }
    } catch (err) {
      // next/navigation's redirect throws — must rethrow to actually redirect.
      if ((err as { digest?: string } | null)?.digest?.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
    }
  }

  const authRuntime = getSupabasePublicConfigStatus();
  const localRuntimeCredentials = getLocalRuntimeLoginCredentials();

  return (
    <AuthShell
      variant="loginPremium"
      brandSubtitle="Arbeidsflate for bedrift og leverandør"
      title="Logg inn"
      subtitle="Bruk e-post og passord for å åpne riktig arbeidsflate i Lunchportalen."
      footer={
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-sm">
          <Link href="/start?intent=register&source=login-register" className="lp-login-link">
            Registrer firma
          </Link>
          <span className="lp-login-link-sep" aria-hidden>
            ·
          </span>
          <Link href="/forgot-password" className="lp-login-link">
            Glemt passord?
          </Link>
        </div>
      }
    >
      <Suspense fallback={null}>
        <LoginForm
          authRuntime={authRuntime}
          localRuntimeCredentials={localRuntimeCredentials}
        />
      </Suspense>
    </AuthShell>
  );
}
