// app/personvern/page.tsx
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/system/emails";

export default function PersonvernPage() {
  return (
    <main className="relative min-h-[calc(100vh-64px)] bg-white">
      {/* Subtle tech glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 420px at 18% 10%, rgba(255,0,127,.08), transparent 60%), radial-gradient(820px 380px at 86% 0%, rgba(99,102,241,.08), transparent 60%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-7 sm:py-9 min-h-[70vh]">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Personvern</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Slik behandler Lunchportalen AS personopplysninger. Kort, tydelig og praktisk.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* LEFT: Quick facts */}
          <aside className="space-y-5 lg:col-span-1">
            <div className="lp-glass-card rounded-card p-4">
              <h2 className="text-sm font-semibold">Ansvarlig</h2>

              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Selskap</div>
                  <div className="font-medium">LUNCHPORTALEN AS</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Org.nr</div>
                  <div className="font-medium">937 155 239</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Adresse</div>
                  <div className="font-medium">Lykkmarka 27</div>
                  <div className="text-muted-foreground">7081 SJETNEMARKA</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Kontakt</div>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="lp-motion-btn font-medium hover:text-[#ff007f]">
                    {SUPPORT_EMAIL}
                  </a>
                  <div className="mt-1">
                    <a href="tel:+4748155481" className="lp-motion-btn font-medium hover:text-[#ff007f]">
                      481 55 481
                    </a>
                  </div>
                </div>

                <div className="pt-1">
                  <div className="text-xs text-muted-foreground">Snarveier</div>
                  <div className="mt-2 flex flex-col gap-2">
                    <Link href="/kontakt" className="lp-motion-btn text-sm font-medium hover:text-[#ff007f]">
                      Kontakt oss
                    </Link>
                    <Link href="/vilkar" className="lp-motion-btn text-sm font-medium hover:text-[#ff007f]">
                      Vilkår
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-glass-card rounded-card p-4">
              <div className="text-xs font-semibold text-muted-foreground">Kortversjon</div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Vi samler inn det som trengs for å levere tjenesten.</li>
                <li>• Firma-admin styrer brukere og rammer.</li>
                <li>• Vi deler ikke data til uvedkommende.</li>
                <li>• Du kan be om innsyn eller sletting der det er mulig.</li>
              </ul>
            </div>
          </aside>

          {/* RIGHT: Policy */}
          <section className="lg:col-span-2">
            <div className="lp-glass-card rounded-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Personvernerklæring</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sist oppdatert: <span className="font-medium text-foreground">14.02.2026</span>
                  </p>
                </div>

                <span
                  className="mt-1 inline-flex h-3 w-3 rounded-full"
                  style={{ background: "#ff007f", boxShadow: "0 0 16px rgba(255,0,127,.45)" }}
                  aria-hidden="true"
                />
              </div>

              <div className="mt-5 space-y-6 text-sm leading-relaxed text-foreground">
                <div>
                  <h3 className="text-sm font-semibold">1. Hvem gjelder dette?</h3>
                  <p className="mt-2 text-muted-foreground">
                    Denne erklæringen gjelder for bruk av Lunchportalen (tjenesten) og nettstedet, inkludert
                    registrering, innlogging og bruk av bestillingsflyt. Tjenesten er laget for bedrifter, der firma-admin
                    håndterer oppsett og brukere.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">2. Hvilke opplysninger vi behandler</h3>
                  <p className="mt-2 text-muted-foreground">
                    Vi behandler kun opplysninger som er nødvendige for å levere avtalt funksjonalitet, typisk:
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>Kontaktinfo (navn, e-post, evt. telefon)</li>
                    <li>Firmatilknytning (firma, lokasjon/leveringssted, rolle)</li>
                    <li>Bestillinger/avbestillinger og relevante notater</li>
                    <li>Tekniske hendelser (RID, tidsstempel, feilkoder)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">3. Formål</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>Levere og drifte tjenesten</li>
                    <li>Autentisering og tilgangsstyring</li>
                    <li>Produksjon/levering og kvalitetssikring</li>
                    <li>Support og feilsøking (inkludert RID-sporbarhet)</li>
                    <li>Etterlevelse av krav til sikkerhet og drift</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">4. Behandlingsgrunnlag</h3>
                  <p className="mt-2 text-muted-foreground">
                    Vi behandler personopplysninger basert på avtale (for å levere tjenesten), berettiget interesse
                    (drift, sikkerhet, kvalitet), og der det er relevant, rettslige forpliktelser.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">5. Tilgang og deling</h3>
                  <p className="mt-2 text-muted-foreground">
                    Tilgang styres med rollebasert tilgang. Firma-admin ser kun sitt firma. Ansatte ser egne bestillinger.
                    Superadmin har nødvendig tilgang for drift og support. Vi deler ikke personopplysninger med uvedkommende.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">6. Lagringstid</h3>
                  <p className="mt-2 text-muted-foreground">
                    Opplysninger lagres så lenge det er nødvendig for formålet og avtalen, og i tråd med lovpålagte krav.
                    Vi sletter eller anonymiserer når det ikke lenger er behov.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">7. Informasjonskapsler (cookies)</h3>
                  <p className="mt-2 text-muted-foreground">
                    Vi bruker nødvendige cookies for innlogging og sikker drift. Eventuelle analyse-/markedsføringscookies
                    brukes kun hvis det er aktivert med gyldig grunnlag.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">8. Dine rettigheter</h3>
                  <p className="mt-2 text-muted-foreground">
                    Du kan be om innsyn, retting, begrensning og sletting der det er mulig. For henvendelser:{" "}
                    <a className="lp-motion-btn font-medium hover:text-[#ff007f]" href={`mailto:${SUPPORT_EMAIL}`}>
                      {SUPPORT_EMAIL}
                    </a>
                    .
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">9. Sikkerhet</h3>
                  <p className="mt-2 text-muted-foreground">
                    Vi jobber systematisk med sikkerhet: tilgangsstyring, logging/sporbarhet, og tiltak for å unngå stille
                    feil. Kontakt oss ved mistanke om sikkerhetshendelser.
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/30 p-4">
                  <div className="text-xs font-semibold text-muted-foreground">Kontakt om personvern</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Send gjerne en melding via{" "}
                    <Link className="lp-motion-btn font-medium hover:text-[#ff007f]" href="/kontakt">
                      kontaktsiden
                    </Link>{" "}
                    eller e-post til{" "}
                    <a className="lp-motion-btn font-medium hover:text-[#ff007f]" href={`mailto:${SUPPORT_EMAIL}`}>
                      {SUPPORT_EMAIL}
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
