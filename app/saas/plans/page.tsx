import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import SaasPlansClient from "./SaasPlansClient";

export const metadata: Metadata = {
  title: "Velg plan - Lunchportalen",
  description: "Velg abonnement for ditt firma.",
  robots: { index: false, follow: false },
};

export default function SaasPlansPage() {
  return (
    <AuthShell
      title="Velg plan"
      subtitle="Betaling skjer trygt via Stripe. Du kan endre plan senere."
      footer={
        <Link href="/saas/billing" className="underline underline-offset-4">
          Til fakturering
        </Link>
      }
    >
      <SaasPlansClient />
    </AuthShell>
  );
}
