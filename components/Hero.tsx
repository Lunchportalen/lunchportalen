import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-10 md:pt-14">
      <div className="grid items-start gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-12">
        {/* Left: Copy */}
        <div className="min-w-0 lp-prose">
          <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--lp-text))] sm:text-4xl md:text-5xl">
            Firmalunsj med kontroll – uten støy
          </h1>

          <p className="mt-4 text-base leading-relaxed text-[rgb(var(--lp-muted))] md:text-lg">
            Lunchportalen gir bedrifter full oversikt over lunsjlevering, faste rammer og én sannhetskilde. Mindre
            administrasjon. Mer forutsigbarhet.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/registrering" className="lp-btn lp-btn--primary">
              Registrer firma
            </Link>
            <Link href="/hvordan-det-fungerer" className="lp-btn lp-btn--ghost">
              Se hvordan det fungerer
            </Link>
          </div>

          <div className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
            Én sannhetskilde · Cut-off kl. 08:00 · Ingen manuelle unntak
          </div>
        </div>

        {/* Right: Image */}
        <div className="w-full">
          <div className="relative aspect-[4/3] w-full overflow-clip rounded-[28px] ring-1 ring-[rgba(226,232,240,.85)] md:aspect-[5/4]">
            <Image
              src="/forsidebilder/lunchportalen-mobil-bestilling.png"
              alt="Mobilbestilling av firmalunsj i Lunchportalen"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </div>

      {/* Value Sections */}
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-5">
          <h2 className="text-base font-semibold text-[rgb(var(--lp-text))]">Dette løser Lunchportalen</h2>
          <ul className="mt-3 grid gap-2 text-sm text-[rgb(var(--lp-muted))]">
            <li>Uforutsigbar lunsjbestilling</li>
            <li>Manuell oppfølging og avvik</li>
            <li>Manglende oversikt for admin og drift</li>
          </ul>
        </section>

        <section id="how" className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-5">
          <h2 className="text-base font-semibold text-[rgb(var(--lp-text))]">Slik fungerer det</h2>
          <ul className="mt-3 grid gap-2 text-sm text-[rgb(var(--lp-muted))]">
            <li>Bedriften settes opp med faste rammer</li>
            <li>Ansatte bestiller selv innenfor avtalen</li>
            <li>Cut-off kl. 08:00 sikrer produksjon og levering</li>
            <li>Kjøkken, sjåfør og admin ser samme fasit</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-5">
          <h2 className="text-base font-semibold text-[rgb(var(--lp-text))]">Hva ledelsen får</h2>
          <ul className="mt-3 grid gap-2 text-sm text-[rgb(var(--lp-muted))]">
            <li>Mindre administrasjon</li>
            <li>Forutsigbar kost</li>
            <li>Dokumentert bruk og historikk</li>
            <li>Ingen individuelle unntak</li>
          </ul>
        </section>
      </div>

      {/* Trust Block */}
      <div className="mt-8 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-6">
        <h2 className="text-base font-semibold text-[rgb(var(--lp-text))]">Bygget for drift – ikke presentasjon</h2>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Lunchportalen er utviklet for daglig bruk i kjøkken, levering og administrasjon. Systemet viser alltid fasit
          og logger avvik automatisk. Det gir trygghet – både operativt og økonomisk.
        </p>
      </div>
    </section>
  );
}
