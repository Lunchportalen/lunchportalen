// app/(auth)/registrering/page.tsx — app onboarding; form → POST /api/public/register-company (operational truth). No marketing CMS pipeline.
import type { Metadata } from "next";
import { Suspense } from "react";

import PageShell from "@/components/PageShell";
import PublicRegistrationFlow from "@/components/registration/PublicRegistrationFlow";

export const metadata: Metadata = {
  title: "Registrer firma | Lunchportalen",
  description:
    "Kom i gang med Lunchportalen. Som bedriftsadministrator setter du opp lunsjordning for selskapet på få minutter.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Registrer firma | Lunchportalen",
    description:
      "Kom i gang med Lunchportalen. Som bedriftsadministrator setter du opp lunsjordning for selskapet på få minutter.",
    type: "website",
    locale: "nb_NO",
  },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function LoadingShell() {
  return (
    <main className="min-h-[70vh] w-full">
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="rounded-2xl border bg-white/70 p-6 shadow-sm">
          <div className="h-6 w-48 animate-pulse rounded bg-black/10" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-black/10" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-black/10" />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="h-12 animate-pulse rounded-xl bg-black/10" />
            <div className="h-12 animate-pulse rounded-xl bg-black/10" />
            <div className="h-12 animate-pulse rounded-xl bg-black/10" />
            <div className="h-12 animate-pulse rounded-xl bg-black/10" />
          </div>
          <div className="mt-6 h-12 w-40 animate-pulse rounded-xl bg-black/10" />
        </div>
      </div>
    </main>
  );
}

export default function RegistreringPage() {
  return (
    <PageShell>
      <Suspense fallback={<LoadingShell />}>
        <PublicRegistrationFlow />
      </Suspense>
    </PageShell>
  );
}
