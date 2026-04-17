// STATUS: ARCHIVE

// components/marketing/Sustainability.tsx
import Image from "next/image";
import { Container } from "@/components/ui/container";

export default function Sustainability() {
  return (
    <section>
      <Container className="max-w-6xl py-10 md:py-16">
      <div className="grid gap-6 md:grid-cols-2 md:items-center">
        {/* Left: Copy */}
        <div className="lp-card lp-motion-card p-8">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Bærekraft som kan dokumenteres
          </h2>

          <p className="mt-3 text-[rgb(var(--lp-muted))]">
            Mindre matsvinn handler om system. Forhåndsbestilling, cut-off og
            tydelige rammer gjør at produksjon og levering treffer bedre.
          </p>

          <ul className="mt-5 space-y-3 text-sm text-[rgb(var(--lp-muted))]">
            <li>
              <span className="font-semibold text-[rgb(var(--lp-text))]">
                Cut-off kl. 08:00
              </span>{" "}
              gir presisjon samme dag
            </li>
            <li>
              <span className="font-semibold text-[rgb(var(--lp-text))]">
                Selvbetjening
              </span>{" "}
              reduserer feil og misforståelser
            </li>
            <li>
              <span className="font-semibold text-[rgb(var(--lp-text))]">
                Én sannhetskilde
              </span>{" "}
              gir sporbarhet
            </li>
            <li>
              <span className="font-semibold text-[rgb(var(--lp-text))]">
                Data
              </span>{" "}
              kan brukes til ESG-rapportering senere
            </li>
          </ul>
        </div>

        {/* Right: Sustainability / system image */}
        <div className="lp-card lp-motion-card">
          <div className="aspect-[4/3] w-full">
            <Image
              src="/forsidebilder/lunchportalen-mobil-bestilling.png"
              alt="Mobil bestilling i Lunchportalen gir sporbarhet, kontroll og mindre matsvinn"
              width={1200}
              height={900}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
      </Container>
    </section>
  );
}



