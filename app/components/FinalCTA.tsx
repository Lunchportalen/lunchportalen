import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-6">
      <div className="rounded-[2rem] bg-white p-10 shadow-sm ring-1 ring-[rgb(var(--lp-border))]">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Klar for en mer bærekraftig og forutsigbar lunsj?
        </h2>

        <p className="mt-3 max-w-2xl text-[rgb(var(--lp-muted))]">
          Registrer firmaet deres, så tar vi en kort gjennomgang og setter opp
          rammer, lokasjon og brukere. Dere får en løsning som gir kontroll – uten
          ekstra administrasjon.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/registrering"
            className="rounded-2xl bg-[rgb(var(--lp-cta))] px-6 py-3 text-center text-sm font-semibold text-white shadow-sm hover:opacity-95 active:opacity-90"
          >
            Registrer firma
          </Link>
          <Link
            href="/kontakt"
            className="rounded-2xl bg-white/70 px-6 py-3 text-center text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))] hover:bg-white"
          >
            Be om gjennomgang
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs text-[rgb(var(--lp-muted))]">
          <span className="rounded-full bg-white/60 px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
            Bedriften er admin
          </span>
          <span className="rounded-full bg-white/60 px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
            Ingen unntak
          </span>
          <span className="rounded-full bg-white/60 px-3 py-1 ring-1 ring-[rgb(var(--lp-border))]">
            Tåler drift over tid
          </span>
        </div>
      </div>
    </section>
  );
}
