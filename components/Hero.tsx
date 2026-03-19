// components/Hero.tsx
import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="w-full pb-7 pt-7 md:pb-9 md:pt-9">
      <div className="grid items-start gap-7 md:grid-cols-[1.15fr_0.85fr] md:gap-10">
        {/* Left */}
        <div className="relative z-10 min-w-0">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)] sm:text-4xl md:text-5xl md:leading-[1.05]">
            Firmalunsj med kontroll.
            <span className="block text-white/90">Ingen unntak.</span>
          </h1>

          <p className="font-body mt-3 text-base leading-relaxed text-white/85 drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)] md:mt-4 md:text-lg">
            Én sannhetskilde for lunsjlevering, avtaler og historikk.
            Cut-off kl. 08:00 gir forutsigbar drift – uten administrativ støy.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center">
            <Link href="/hvordan" className="lp-btn lp-btn-primary lp-neon">
              Se hvordan det fungerer
            </Link>

            <Link href="/registrering" className="lp-btn lp-btn-ghost">
                Registrer firma
              </Link>
          </div>

          <div className="font-body mt-2 text-xs text-white/80">
            Én sannhetskilde · Cut-off kl. 08:00 · Ingen manuelle unntak
          </div>
        </div>

        {/* Right */}
        <div className="w-full md:flex md:justify-end">
          <div className="relative w-full max-w-lg md:max-w-md">
            <div className="relative aspect-[16/11] w-full rounded-3xl ring-1 ring-white/20">
              <div className="absolute inset-0 rounded-3xl overflow-clip">
                <Image
                  src="/forsidebilder/lunchportalen-mobil-bestilling.png"
                  alt="Mobilbestilling av firmalunsj i Lunchportalen"
                  fill
                  sizes="(max-width: 768px) 100vw, 520px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            <div className="pointer-events-none absolute -inset-3 -z-10 rounded-3xl bg-black/10 blur-xl" />
          </div>
        </div>
      </div>
    </section>
  );
}









