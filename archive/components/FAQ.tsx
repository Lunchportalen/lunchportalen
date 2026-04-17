// STATUS: ARCHIVE

import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";

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
    <section>
      <Container className="max-w-6xl py-10">
      <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">Spørsmål og svar</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {faqs.map((f) => (
          <Card key={f.q} variant="soft" className="p-6">
            <div className="font-heading text-sm font-semibold">{f.q}</div>
            <div className="font-body mt-2 text-sm text-[rgb(var(--lp-muted))]">{f.a}</div>
          </Card>
        ))}
      </div>
      </Container>
    </section>
  );
}
