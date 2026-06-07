import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";

import GeographyGateForm from "@/components/start/GeographyGateForm";

export const metadata: Metadata = {
  title: "Hvor holder bedriften til?",
  description:
    "Fortell oss hvor dere er, så finner vi caterere som leverer lunsj til dere.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function StartPage() {
  return (
    <div className="lp-start-shell">
      <section className="lp-start-card" aria-labelledby="start-page-title">
        <div className="lp-start-card__brand">
          <Image
            src="/brand/LP-logo-uten-bakgrunn.png"
            alt="Lunchportalen"
            width={120}
            height={64}
            className="lp-start-card__logo"
            priority
          />
        </div>

        <header className="lp-start-card__header">
          <h1 id="start-page-title" className="lp-start-card__title">
            Hvor holder bedriften til?
          </h1>
          <p className="lp-start-card__lead">
            Fortell oss hvor dere er, så finner vi caterere som leverer lunsj til dere.
          </p>
        </header>

        <Suspense fallback={<p className="lp-start-form__reassurance">Laster …</p>}>
          <GeographyGateForm />
        </Suspense>
      </section>
    </div>
  );
}
