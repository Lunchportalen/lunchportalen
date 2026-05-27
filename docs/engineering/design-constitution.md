Lunchportalen — Design Constitution (Enterprise v1.1)
1. Produktets natur

Lunchportalen er et driftssystem.
Ikke en markedsplass. Ikke et inspirasjonsunivers.

Designet skal uttrykke:

Kontroll

Stabilitet

Forutsigbarhet

Autoritet

Lav risiko

Enterprise-klarhet

Hvis UI føles “smart”, “lekent”, “inspirerende” eller “kampanje”, er det feil retning.

2. Grunnprinsipper (låst)
2.1 No-Exception Rule

Designet skal aldri antyde fleksibilitet som ikke finnes i systemet.
Ingen skjulte valg. Ingen unntak. Ingen “ta kontakt så fikser vi”.

2.2 Én sannhetskilde

Alle tall, status og rammer skal være entydige.
UI skal aldri “gjette” eller presentere estimater som fakta.

2.3 Fail-Closed

Hvis data er uklare → vis blokkert/avklart state.
Ikke vis “delvis fungerende” UI.

2.4 Determinisme

Handling → eksplisitt respons → kvittering.
Alle viktige handlinger må kunne spores med:

rid

timestamp

status

Ingen stille feil. Ingen “kanskje lagret”.

3. Brukerroller og designprioritet
3.1 Company Admin (Primær rolle)

UI prioriteres for Company Admin.

Skal:

Umiddelbart se status

Forstå neste levering

Se avtalerammer

Ha kontroll og trygghet

Skal aldri:

Tolke data

Gjette systemstatus

Lete etter “hva må jeg gjøre nå?”

Prinsipp: Admin-sider følger “Command Center”-oppskrift.

3.2 Superadmin (Operativ kontroll)

Mer kontrollpanel enn admin.

Skal:

Se firmaer, binding og kontrakt

Se avvik

Se driftstatus og systemhelse

Ha tydelig handlingsflyt (pause/activate/close)

3.3 Ansatt (Minimal)

Kun:

Uke (bestill/avbestill)

Status

Historikk (enkel)

Ingen dashboards. Ingen “innstillinger”. Ingen admin-følelse.

4. Informasjonsarkitektur (låst)
4.1 Admin (maks 6 hovedfaner)

Dashboard

Avtale

Ordre

Ansatte

Lokasjoner

Historikk
(+ Fakturagrunnlag kan ligge under Ordre eller Historikk, ikke som egen hovedfane hvis det gir >6)

4.2 Superadmin

Firma

Avtaler

Drift

Logs

System Health

5. State-matrise (må designes eksplisitt)

UI skal ha egne, tydelige varianter for:

Ingen avtale

Pending avtale

Aktiv avtale

Pauset firma

Stengt firma

Ingen ansatte

Ingen bestillinger

Før cut-off

Etter cut-off

Scope mismatch / feil tenant

System error / databrudd

Ingen state skal falle tilbake til “default UI”.

6. Designsystem (konkret)
6.1 Typografi

Inter / system-ui (konsistent)

1 H1 per side

KPI-tall 1.3–1.5× brødtekst

Hierarki: H1 → KPI → H2 → Body → Meta

6.2 Farger (signalbasert)

Base: nøytral, lys, rolig.

Statusfarger (kun som signal):

ACTIVE: dempet grønn

PENDING: varm amber

PAUSED/CLOSED: dempet rød

Neon (hot pink) — oppdatert regel (v1.1):
Neon er ikke dekor. Neon er et operativt signal og brukes kun til:

Aktivt valg (active nav/tab/selected state)

Primær handling (én CTA per skjerm)

Kritisk oppmerksomhet der systemet krever handling (sjeldent)

Ingen neon på tilfeldige elementer. Ingen “pynt”.

6.3 Spacing-system

8px baseline grid

Card padding: 18–26px (responsive)

Seksjonsmargin: 24–48px

Maks bredde: 1200px

Ingen horisontal scroll

6.4 Kort (Cards)

Radius: 16–18px (rolig premium)

Diskret skygge

Lett border

Ingen tung glass-effekt

Ingen fargede borders med mindre det er status-komponent

6.5 KPI-kort

Maks 3 per rad (admin)

Hvert KPI-kort må ha:

Tittel

Verdi

Undertekst (forklarer hva tallet betyr)

KPI-kort har ikke egne CTA-knapper (klikkbar helflate kun ved behov)

6.6 Tabeller

Sticky header

Søk øverst

Sortering eksplisitt

Ingen inline-redigering uten confirm

Null “mystery columns”

6.7 Dialoger

Alltid eksplisitt bekreftelse

Irreversible handlinger → ekstra confirm

Kvittering etter handling (rid, timestamp)

7. Mobilstrategi

Admin = desktop-first

Mobil skal være lesbar, men ikke fullverdig operativ

Regler:

Ingen horisontal scroll

Ingen kollaps som skjuler kritisk informasjon

Kritisk status skal være synlig uten å lete

8. Motion-regler

Maks 150ms transitions

Ingen animasjoner som påvirker tall

Ingen mikro-interaksjoner som forstyrrer kontroll

Motion brukes kun for respons/forutsigbarhet

9. Datavisualisering

Tall > grafer

Grafer kun når nødvendig

Historikk som liste først, graf sekundært

10. UI Done-kriterier

En side er ikke “done” før:

Alle relevante states finnes

Ingen usikkerhet i status

Ingen overlapp mellom roller

Ingen brudd på No-Exception Rule

Alle handlinger gir kvittering og tydelig resultat

Feil viser fail-closed state (ikke “half UI”)

11. Ikke tillatt

Feature-bloat

UI som antyder fleksibilitet uten systemstøtte

“Soft warnings” uten tydelig konsekvens

Implicit behavior

Uforklarte tall

Flere primære CTA-er på samme skjerm

12. Designmål (langsiktig)

Lunchportalen skal oppleves:

Roligere enn Tripletex

Mer kontrollert enn Foodora for Business

Mer enterprise enn typiske lunsj-apper

Som et “command center”, ikke en app