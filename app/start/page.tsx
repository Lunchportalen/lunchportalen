import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";

import StartRoleChooser from "@/components/start/StartRoleChooser";
import { shouldSkipStartRoleGate } from "@/lib/public/geographyParams";

export const metadata: Metadata = {
  title: "Kom i gang",
  description:
    "Velg om du er bedrift som ønsker firmalunsj, eller caterer som vil bli leverandør i Lunchportalen.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function paramValue(v: string | string[] | undefined): string {
  return String(Array.isArray(v) ? v[0] : v ?? "").trim();
}

export default async function StartPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const skipRoleGate = shouldSkipStartRoleGate(
    paramValue(params.intent),
    paramValue(params.postal_code),
    paramValue(params.city),
  );

  return (
    <div className="lp-start-shell">
      <header className="lp-start-topbar">
        <Image
          src="/brand/LP-logo-uten-bakgrunn.png"
          alt="Lunchportalen"
          width={120}
          height={64}
          className="lp-start-topbar__logo"
          priority
        />
      </header>

      <Suspense fallback={<p className="lp-start-form__reassurance">Laster …</p>}>
        <StartRoleChooser skipRoleGate={skipRoleGate} />
      </Suspense>
    </div>
  );
}
