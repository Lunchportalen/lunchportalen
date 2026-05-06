import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "./LoginForm";
import { getLocalRuntimeLoginCredentials } from "@/lib/auth/localRuntimeAuth";
import { getSupabasePublicConfigStatus } from "@/lib/config/env-public";

export const metadata: Metadata = {
  title: "Logg inn - Lunchportalen",
  description: "Sikker innlogging for ansatte og administratorer i Lunchportalen.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const authRuntime = getSupabasePublicConfigStatus();
  const localRuntimeCredentials = getLocalRuntimeLoginCredentials();

  return (
    <AuthShell
      variant="loginPremium"
      brandSubtitle="Kundeinnlogging"
      title="Logg inn"
      subtitle="Bruk e-post og passord for å åpne riktig arbeidsflate i Lunchportalen."
      footer={
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-sm">
          <Link href="/registrering" className="font-semibold underline decoration-[rgb(var(--lp-gold)/0.45)] underline-offset-4 transition hover:decoration-[rgb(var(--lp-gold))]">
            Registrer firma
          </Link>
          <span className="text-neutral-400" aria-hidden>
            ·
          </span>
          <Link href="/forgot-password" className="font-semibold underline decoration-[rgb(var(--lp-gold)/0.45)] underline-offset-4 transition hover:decoration-[rgb(var(--lp-gold))]">
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
