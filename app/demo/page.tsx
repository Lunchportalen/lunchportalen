import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";

import DemoLeadCaptureForm from "@/components/demo/DemoLeadCaptureForm";

export const metadata: Metadata = {
  title: "Book demo",
  description: "Be om en uforpliktende demo av Lunchportalen for bedriften din.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DemoPage() {
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
        Fyll ut skjemaet, så tar vi kontakt for en kort gjennomgang av hvordan Lunchportalen fungerer for
        bedriften din.
      </p>
      <Suspense fallback={<p className="lp-demo-form__status">Laster skjema …</p>}>
        <DemoLeadCaptureForm />
      </Suspense>
    </section>
  );
}
