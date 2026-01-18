export default function FAQ() {
  const faqs = [
    {
      q: "Hvem administrerer brukere?",
      a: "Firma/admin oppretter og administrerer ansatte. Ansatte har ingen direkte relasjon til leverandør.",
    },
    {
      q: "Kan ansatte avbestille samme dag?",
      a: "Ja, innen kl. 08:00. Dette reduserer matsvinn og gir bedre kontroll på kostnad.",
    },
    {
      q: "Hva er standard uke?",
      a: "Ukemeny er Man–Fre. Helg bestilles utenfor portalen ved behov.",
    },
    {
      q: "Støtter dere flere lokasjoner?",
      a: "Ja. Løsningen er laget for flere lokasjoner og leveringsvinduer.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Spørsmål og svar</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {faqs.map((f) => (
          <div key={f.q} className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
            <div className="text-sm font-semibold">{f.q}</div>
            <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{f.a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
