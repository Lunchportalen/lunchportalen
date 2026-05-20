import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Takk for registreringen",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pick(sp: Record<string, string | string[] | undefined>, key: string) {
  const v = sp[key];
  return typeof v === "string" ? v : "";
}

export default async function RegistrerTakkPage({ searchParams }: Props) {
  const sp = await searchParams;
  const matched = pick(sp, "matched") === "1";
  const provider = pick(sp, "provider");
  const area = pick(sp, "area");

  return (
    <section className="lp-registrer-card lp-registrer-card--success">
      <div className="lp-registrer-card__brand">
        <Image
          src="/brand/LP-logo-uten-bakgrunn.png"
          alt="Lunchportalen"
          width={120}
          height={64}
          className="h-16 w-auto md:h-[120px]"
        />
      </div>
      <h1 className="lp-registrer-card__title">Takk!</h1>
      {matched ? (
        <p className="lp-registrer-card__lead">
          Velkommen! {provider || "Leverandøren"} kommer til å kontakte deg innen 24 timer.
        </p>
      ) : (
        <p className="lp-registrer-card__lead">
          Vi har notert din interesse for {area || "ditt område"}. Vi sender beskjed når vi lanserer der.
        </p>
      )}
      <p className="ds-body">Du trenger ikke gjøre mer nå.</p>
      <Link href="/" className="ds-btn ds-btn--secondary">
        Til forsiden
      </Link>
    </section>
  );
}
