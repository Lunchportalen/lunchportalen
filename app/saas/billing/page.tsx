import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import SaasBillingClient from "./SaasBillingClient";

export const metadata: Metadata = {
  title: "Fakturering - Lunchportalen",
  description: "Abonnement og faktura for ditt firma.",
  robots: { index: false, follow: false },
};

export default function SaasBillingPage() {
  return (
    <AuthShell
      title="Fakturering"
      subtitle="Status for abonnement og lenke til sikker betalingsportal."
      footer={
        <Link href="/saas/plans" className="underline underline-offset-4">
          Endre plan
        </Link>
      }
    >
      <SaasBillingClient />
    </AuthShell>
  );
}
