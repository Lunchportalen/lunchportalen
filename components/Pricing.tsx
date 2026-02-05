import Link from "next/link";

function Plan({
  title,
  price,
  bullets,
  badge,
}: {
  title: string;
  price: string;
  bullets: string[];
  badge?: string;
}) {
  const isHighlight = Boolean(badge);

  return (
    <div
      className={[
        "rounded-3xl p-7 ring-1",
        isHighlight
          ? "bg-white shadow-sm ring-[rgb(var(--lp-cta))]"
          : "bg-white/70 ring-[rgb(var(--lp-border))]",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-lg font-semibold">{title}</div>
        {badge ? (
          <div className="rounded-full bg-[rgb(var(--lp-cta))] px-3 py-1 text-xs font-semibold text-white">
            {badge}
          </div>
        ) : null}
      </div>

      <div className="mt-2 text-2xl font-semibold">{price}</div>

      <ul className="mt-5 space-y-2 text-sm text-[rgb(var(--lp-muted))]">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[rgb(var(--lp-cta))]" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Pricing() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
        To nivåer. Enkelt å forstå.
      </h2>
      <p className="mt-3 max-w-2xl text-[rgb(var(--lp-muted))]">
        Bedriften velger rammer ved avtaleinngåelse. Ansatte bestiller innenfor avtalte dager og nivå.
      </p>

      {/* CRO: fjern tvil / tydelig kontroll */}
      <div className="mt-4 rounded-2xl bg-white/60 p-4 text-sm ring-1 ring-[rgb(var(--lp-border))]">
        <span className="font-semibold">Viktig:</span> Fordelingen (f.eks. 4 dager Basis + 1 dag Luxus) settes av firma/admin ved avtale
        – ikke av ansatte.
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Plan
          title="Basis"
          price="90 kr pr. kuvert"
          bullets={["Salatbar", "Påsmurt", "Varmmat", "Forutsigbar drift"]}
        />
        <Plan
          title="Luxus"
          price="130 kr pr. kuvert"
          bullets={["Salatbar", "Påsmurt", "Varmmat", "Sushi", "Pokébowl", "Thaimat"]}
          badge="Mest valgt"
        />
      </div>

      <div className="mt-6 rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Fordeling settes ved avtale</div>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Eksempel: 4 dager Basis og 1 dag Luxus. Dette settes av firma/admin, og gjelder for alle – uten individuelle unntak.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-[rgb(var(--lp-muted))]">
            Neste steg: registrer firmaet – så tar vi dere i gang med rammer, lokasjon og brukere.
          </div>
          <Link
            href="/registrering"
            className="text-sm font-semibold text-[rgb(var(--lp-cta))] hover:underline"
          >
            Registrer firma →
          </Link>
        </div>
      </div>
    </section>
  );
}
