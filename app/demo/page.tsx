import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

import DemoLeadCaptureForm from "@/components/demo/DemoLeadCaptureForm";
import {
  buildStartRedirectPath,
  hasGeographyParams,
  normalizeCity,
  normalizePostalCode,
  resolveSource,
} from "@/lib/public/geographyParams";

export const metadata: Metadata = {
  title: "Book demo",
  description: "Be om en uforpliktende demo av Lunchportalen for bedriften din.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function paramValue(v: string | string[] | undefined): string {
  return String(Array.isArray(v) ? v[0] : v ?? "").trim();
}

export default async function DemoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const postalCode = normalizePostalCode(paramValue(params.postal_code));
  const city = normalizeCity(paramValue(params.city));
  const source = resolveSource(paramValue(params.source) || paramValue(params.src), "demo-direct");

  if (!hasGeographyParams(postalCode, city)) {
    redirect(buildStartRedirectPath("demo", { source, postalCode, city }));
  }

  return (
    <section className="lp-demo-capture-card">
      <div className="lp-demo-capture-card__brand">
        <Image
          src="/brand/LP-logo-uten-bakgrunn.png"
          alt="Lunchportalen"
          width={120}
          height={64}
          className="lp-demo-capture-card__logo"
          priority
        />
      </div>
      <h1>Book en demo</h1>
      <p>
        Fyll ut skjemaet, så tar vi kontakt for en kort gjennomgang av hvordan Lunchportalen fungerer for bedriften din
        i {postalCode} {city}.
      </p>
      <Suspense fallback={<p className="lp-demo-form__status">Laster skjema …</p>}>
        <DemoLeadCaptureForm />
      </Suspense>
    </section>
  );
}
