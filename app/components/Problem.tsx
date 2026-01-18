export default function Problem() {
  const items = [
    {
      title: "Uforutsigbar mengde",
      desc: "For mye én dag, for lite neste – uten en pålitelig måte å vite hva som faktisk er bestilt.",
    },
    {
      title: "Unødvendig administrasjon",
      desc: "Spørsmål, endringer og avklaringer havner hos admin – og stjeler tid fra viktigere arbeid.",
    },
    {
      title: "Matsvinn",
      desc: "Når bestillinger ikke stemmer med faktisk behov, blir svinn en naturlig konsekvens.",
    },
    {
      title: "Manglende kontroll",
      desc: "Uklare rammer gir uforutsigbare kostnader og dårlig oversikt over lunsjordningen.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Lunsj på jobb har blitt unødvendig komplisert
      </h2>
      <p className="mt-3 max-w-2xl text-[rgb(var(--lp-muted))]">
        De fleste bedrifter ønsker egentlig det samme: riktig mengde mat, færre avklaringer
        og en lunsjløsning som er enkel å administrere over tid.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {items.map((x) => (
          <div
            key={x.title}
            className="rounded-3xl bg-white/60 p-6 ring-1 ring-[rgb(var(--lp-border))]"
          >
            <div className="text-sm font-semibold">{x.title}</div>
            <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
              {x.desc}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
