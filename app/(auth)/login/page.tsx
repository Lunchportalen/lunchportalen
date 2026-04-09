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
      title="Logg inn"
      subtitle="Bruk e-post og passord for å åpne riktig arbeidsflate."
      footer={
        <Link href="/forgot-password" className="underline underline-offset-4">
          Glemt passord?
        </Link>
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
