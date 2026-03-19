import { Container } from "@/components/ui/container";

export default function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Bedriften setter rammene",
      desc: "Antall dager, nivå (Basis/Luxus) og leveringssted fastsettes ved avtale.",
    },
    {
      n: "02",
      title: "Meny publiseres",
      desc: "Tydelig og forutsigbart for hele uken (Man–Fre).",
    },
    {
      n: "03",
      title: "Ansatte bestiller selv",
      desc: "Innen kl. 08:00. Samme-dag avbestilling før cut-off – uten admin-involvering.",
    },
    {
      n: "04",
      title: "Levering & oversikt",
      desc: "Riktig mengde, bekreftet lagring og full oversikt for bedriften.",
    },
  ];

  return (
    <section id="how">
      <Container className="max-w-6xl py-10">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Slik fungerer det
      </h2>
      <p className="mt-3 max-w-2xl text-[rgb(var(--lp-muted))]">
        En enkel flyt som gir kontroll og forutsigbarhet – uten å gjøre lunsj til et prosjekt.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {steps.map((s) => (
          <div
            key={s.n}
            className="lp-card lp-motion-card p-6"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[rgb(var(--lp-cta))] px-3 py-1 text-xs font-semibold text-white">
                {s.n}
              </div>
              <div className="text-sm font-semibold">{s.title}</div>
            </div>
            <div className="mt-3 text-sm text-[rgb(var(--lp-muted))]">
              {s.desc}
            </div>
          </div>
        ))}
      </div>
      </Container>
    </section>
  );
}

