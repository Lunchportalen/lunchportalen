import type { Metadata } from "next";
import Image from "next/image";

import PublicProviderRegistrationForm from "@/components/providers/PublicProviderRegistrationForm";

export const metadata: Metadata = {
  title: "Registrer bedrift",
  description: "Registrer bedriften for lunsjordning med lokal leverandør via Lunchportalen.",
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RegistrerPage() {
  return (
    <section className="lp-registrer-card">
      <div className="lp-registrer-card__brand">
        <Image
          src="/brand/LP-logo-uten-bakgrunn.png"
          alt="Lunchportalen"
          width={120}
          height={64}
          className="h-16 w-auto md:h-[120px]"
          priority
        />
      </div>
      <h1 className="lp-registrer-card__title">Registrer bedrift</h1>
      <p className="lp-registrer-card__lead">
        Fyll ut skjemaet. Vi matcher dere med leverandør i ditt område og tar kontakt når registreringen er
        godkjent.
      </p>
      <PublicProviderRegistrationForm />
    </section>
  );
}
