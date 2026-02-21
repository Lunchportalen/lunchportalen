// app/(auth)/registrering/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import PublicRegistrationFlow from "@/components/registration/PublicRegistrationFlow";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Registrer firma | Lunchportalen",
  description:
    "Registrer bedrift for lunsjordning. Firma-admin oppretter avtaleoppsett og sender til godkjenning. Minimum 20 ansatte.",
  alternates: { canonical: "/registrering" },
  robots: { index: true, follow: true },
};

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

export default function RegistrationPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <PublicRegistrationFlow />
    </Suspense>
  );
}
