// app/hvordan-det-fungerer/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Slik fungerer Lunchportalen",
  description:
    "Se nøyaktig hvordan Lunchportalen fungerer – fra avtale og onboarding til bestilling, cut-off og kjøkkenflyt.",
};

export default function HvordanDetFungererPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          Slik fungerer Lunchportalen
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Én sannhetskilde. Cut-off kl. 08:00. Ingen manuelle unntak.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold">1) Avtale først</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Firma registrerer interesse. Superadmin aktiverer avtale (nivå, dager,
            binding, pris). Ingen bestilling før avtalen er aktiv.
          </p>
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold">2) FirmaAdmin legger til ansatte</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            FirmaAdmin oppretter brukere internt. Ansatte har selvbetjening innenfor
            avtalte rammer – ikke supportflyt via admin.
          </p>
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold">
            3) Bestill / avbestill (cut-off 08:00)
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ansatte kan bestille og avbestille samme dag frem til kl. 08:00
            (Europe/Oslo). Etter cut-off er bestillingen låst for produksjon og
            levering.
          </p>
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold">4) Kvittering + verifisert lagring</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            UI bekrefter kun når lagring er verifisert. Handlinger er idempotente og
            logges med orderId, status og timestamp.
          </p>
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold">5) Kjøkkenflyt</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Bestillinger grupperes per leveringsvindu → firma → lokasjon → ansatt,
            klart for produksjon og utskrift/eksport.
          </p>
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold">6) Driftssikkerhet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Automatisk e-post-backup/outbox + retry sikrer at ingen tror noe er
            registrert uten at systemet har det som sannhet.
          </p>
        </div>
      </section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/registrering"
          className="inline-flex items-center justify-center rounded-xl bg-black px-5 py-3 text-sm font-medium text-white"
        >
          Registrer firma
        </Link>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-medium"
        >
          Tilbake til forsiden
        </Link>
      </div>
    </main>
  );
}
