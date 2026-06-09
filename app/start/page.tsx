import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";

import StartRoleChooser from "@/components/start/StartRoleChooser";
import { DEFAULT_START_LOCALE, getStartCopy } from "@/lib/i18n/startCopy";
import { shouldSkipStartRoleGate } from "@/lib/public/geographyParams";

const copy = getStartCopy(DEFAULT_START_LOCALE);

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
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
      <header className="lp-start-brand lp-start-reveal lp-start-reveal--0">
        <Link href="/" className="lp-start-brand__link">
          <Image
            src="/brand/LP-logo-uten-bakgrunn.png"
            alt={copy.brand.name}
            width={180}
            height={96}
            className="lp-start-brand__logo"
            priority
          />
          <span className="lp-start-brand__name font-heading">{copy.brand.name}</span>
        </Link>
      </header>

      <Suspense fallback={<p className="lp-start-form__reassurance">{copy.loading}</p>}>
        <StartRoleChooser skipRoleGate={skipRoleGate} locale={DEFAULT_START_LOCALE} />
      </Suspense>
    </div>
  );
}
