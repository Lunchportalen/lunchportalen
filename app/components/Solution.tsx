function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[rgb(var(--lp-border))]">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{desc}</div>
    </div>
  );
}

export default function Solution() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-8 ring-1 ring-[rgb(var(--lp-border))]">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          En firmastyrt lunsjløsning – ikke en markedsplass
        </h2>
        <p className="mt-3 max-w-3xl text-[rgb(var(--lp-muted))]">
          Bedriften setter rammene (dager, nivå og leveringssted). Ansatte bestiller selv innenfor avtalen. Systemet håndhever cut-off og
          gir sporbarhet – slik at lunsj blir forutsigbart, bærekraftig og administrasjonsfritt.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card title="Rammer først" desc="Bedriften bestemmer nivå og omfang. Ingen ad-hoc unntak." />
          <Card title="Selvbetjening" desc="Ansatte bestiller/avbestiller selv innen kl. 08:00." />
          <Card title="Kontroll & sporbarhet" desc="Én sannhetskilde og tydelig bekreftelse på handlinger." />
        </div>
      </div>
    </section>
  );
}
