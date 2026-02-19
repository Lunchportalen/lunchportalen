// app/vilkar/page.tsx
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/system/emails";

export default function VilkarPage() {
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
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Vilkår</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Vilkår for bruk av Lunchportalen. Kort og praktisk, med klare rammer for firmakunder.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* LEFT: Quick facts */}
          <aside className="space-y-5 lg:col-span-1">
            <div className="rounded-2xl border bg-white/90 p-4 shadow-sm backdrop-blur">
              <h2 className="text-sm font-semibold">Leverandør</h2>

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
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="font-medium transition hover:text-[#ff007f]"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  <div className="mt-1">
                    <a href="tel:+4748155481" className="font-medium transition hover:text-[#ff007f]" >
                      481 55 481
                    </a>
                  </div>
                </div>

                <div className="pt-1">
                  <div className="text-xs text-muted-foreground">Snarveier</div>
                  <div className="mt-2 flex flex-col gap-2">
                    <Link href="/personvern" className="text-sm font-medium transition hover:text-[#ff007f]">
                      Personvern
                    </Link>
                    <Link href="/kontakt" className="text-sm font-medium transition hover:text-[#ff007f]">
                      Kontakt oss
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white/90 p-4 shadow-sm backdrop-blur">
              <div className="text-xs font-semibold text-muted-foreground">Kortversjon</div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Tjenesten er for bedrifter (B2B).</li>
                <li>• Firma-admin setter rammer og oppretter brukere.</li>
                <li>• Cut-off for samme dag er kl. 08:00 (Europe/Oslo).</li>
                <li>• Ingen individuelle unntak utenfor avtaleramme.</li>
              </ul>
            </div>
          </aside>

          {/* RIGHT: Terms */}
          <section className="lg:col-span-2">
            <div className="rounded-2xl border bg-white/90 p-5 shadow-sm backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Bruksvilkår</h2>
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
                  <h3 className="text-sm font-semibold">1. Om tjenesten</h3>
                  <p className="mt-2 text-muted-foreground">
                    Lunchportalen er en bestillings- og administrasjonsplattform for firmalunsj. Plattformen er bygget
                    for faste rammer, forutsigbarhet og kontroll, der bedriften (firma-admin) er primærkontakt og
                    ansvarlig for interne brukere.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">2. Roller og ansvar</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>
                      <strong>Firma-admin</strong> oppretter og administrerer ansatte/brukere og avtalerammer.
                    </li>
                    <li>
                      <strong>Ansatt</strong> bestiller/avbestiller innenfor avtalte rammer og frister.
                    </li>
                    <li>
                      <strong>Leverandør</strong> drifter tjenesten og leverer i henhold til avtalt løsning og drift.
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">3. Bestilling, avbestilling og cut-off</h3>
                  <p className="mt-2 text-muted-foreground">
                    Samme-dag avbestilling er mulig frem til <strong>kl. 08:00</strong> (Europe/Oslo) der dette er
                    aktivert i avtalen. Etter cut-off er ordre låst for å sikre produksjon og leveringsstabilitet.
                  </p>
                  <div className="mt-3 rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                    Prinsipp: <strong>Én sannhetskilde</strong>. Det som står i portalen er fasit, og systemet er bygget
                    for å unngå “stille feil”.
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">4. Ingen unntak</h3>
                  <p className="mt-2 text-muted-foreground">
                    Tjenesten leveres etter faste rammer. Individuelle unntak utenfor avtale er normalt ikke mulig.
                    Eventuelle endringer må gjøres som del av avtaleramme av firma-admin og godkjennes i prosessen der
                    det er relevant.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">5. Betaling og stenging</h3>
                  <p className="mt-2 text-muted-foreground">
                    Ved manglende betaling eller kontraktsbrudd kan tilgang til tjenesten stenges på firmanivå (Active /
                    Paused / Closed). Dette gjøres kontrollert og kan ikke omgås av ansatte.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">6. Drift og tilgjengelighet</h3>
                  <p className="mt-2 text-muted-foreground">
                    Vi tilstreber høy oppetid og forutsigbar drift. Ved vedlikehold eller hendelser kan funksjonalitet
                    være midlertidig redusert. Kritiske problemer meldes inn via kontaktkanalen.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">7. Personvern</h3>
                  <p className="mt-2 text-muted-foreground">
                    Behandling av personopplysninger følger vår{" "}
                    <Link href="/personvern" className="font-medium transition hover:text-[#ff007f]">
                      personvernerklæring
                    </Link>
                    .
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">8. Endringer i vilkår</h3>
                  <p className="mt-2 text-muted-foreground">
                    Vi kan oppdatere vilkårene ved behov. Ved vesentlige endringer varsles firmakunden gjennom egnede
                    kanaler.
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/30 p-4">
                  <div className="text-xs font-semibold text-muted-foreground">Spørsmål om vilkår?</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Ta kontakt via{" "}
                    <Link href="/kontakt" className="font-medium transition hover:text-[#ff007f]">
                      kontaktsiden
                    </Link>{" "}
                    eller e-post til{" "}
                    <a className="font-medium transition hover:text-[#ff007f]" href={`mailto:${SUPPORT_EMAIL}`}>
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
