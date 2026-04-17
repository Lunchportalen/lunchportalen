import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import SaasOnboardingClient from "./SaasOnboardingClient";

export const metadata: Metadata = {
  title: "Opprett firma (SaaS) - Lunchportalen",
  description: "Opprett firma og start som administrator.",
  robots: { index: false, follow: false },
};

export default function SaasOnboardingPage() {
  return (
    <AuthShell
      title="Opprett firma"
      subtitle="Du blir firmadministrator. Data isoleres til ditt firma."
      footer={
        <Link href="/saas/plans" className="underline underline-offset-4">
          Se planer
        </Link>
      }
    >
      <SaasOnboardingClient />
    </AuthShell>
  );
}
