// components/marketing/Hero.tsx
import Link from "next/link";

export default function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-12 md:pt-16">
      <div className="grid items-start gap-10 md:grid-cols-2">
        {/* Left: Copy */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))]">
            Cut-off kl. 08:00 • Mindre matsvinn • Mindre admin
          </div>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            Firmalunsj som gir{" "}
            <span className="text-[rgb(var(--lp-cta))]">kontroll</span> – hver dag
          </h1>

          <p className="mt-4 text-base leading-relaxed text-[rgb(var(--lp-muted))] md:text-lg">
            Bedriften setter rammene. Ansatte bestiller selv innenfor avtalen. Du
            får forutsigbar kostnad, mindre mas og en løsning som faktisk tåler
            drift.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/registrering"
              className="rounded-2xl bg-[rgb(var(--lp-cta))] px-5 py-3 text-center text-sm font-semibold text-white shadow-sm hover:opacity-95 active:opacity-90"
            >
              Registrer firma
            </Link>

            <Link
              href="#how"
              className="rounded-2xl bg-white/70 px-5 py-3 text-center text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
            >
              Se hvordan det fungerer
            </Link>
          </div>

          {/* Risk reversal + trust */}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[rgb(var(--lp-muted))]">
            <span className="rounded-full bg-white/60 px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
              Bedriften er admin (ikke ansatte)
            </span>
            <span className="rounded-full bg-white/60 px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
              Ingen unntakskaos
            </span>
            <span className="rounded-full bg-white/60 px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
              Bekreftelse kun ved lagret data
            </span>
          </div>

          {/* Mini-benefits */}
          <div className="mt-6 grid gap-3 text-sm text-[rgb(var(--lp-muted))] sm:grid-cols-2">
            <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="font-semibold text-[rgb(var(--lp-text))]">
                Mindre administrasjon
              </div>
              <div className="mt-1">
                Ansatte bestiller/avbestiller selv – innenfor rammer.
              </div>
            </div>

            <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="font-semibold text-[rgb(var(--lp-text))]">
                Mindre matsvinn
              </div>
              <div className="mt-1">
                Cut-off kl. 08:00 gir presisjon i produksjon og levering.
              </div>
            </div>
          </div>
        </div>

        {/* Right: Image */}
        <div className="md:pt-1">
          <div className="lp-heroImage h-[360px] w-full rounded-[28px] ring-1 ring-[rgba(226,232,240,.85)] md:h-[430px]" />

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[rgb(var(--lp-muted))]">
            <span className="rounded-full bg-white/60 px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
              Deling • Varmmat • Salatbar
            </span>
            <span className="rounded-full bg-white/60 px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
              Levering til kontor
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
