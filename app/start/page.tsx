import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";

import GeographyGateForm from "@/components/start/GeographyGateForm";

export const metadata: Metadata = {
  title: "Hvor er dere?",
  description: "Oppgi lokasjon før demo eller registrering — Lunchportalen sjekker dekning i ditt område.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function StartPage() {
  return (
    <section className="lp-demo-capture-card lp-start-card">
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
      <h1>Hvor er bedriften?</h1>
      <p className="lp-start-card__lead">
        Vi starter med lokasjonen deres — så finner vi riktig vei videre til demo eller registrering.
      </p>
      <Suspense fallback={<p className="lp-demo-form__status">Laster …</p>}>
        <GeographyGateForm />
      </Suspense>
    </section>
  );
}
