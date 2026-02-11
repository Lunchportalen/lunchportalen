Lunchportalen — Design Constitution (Enterprise v1.0)
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

Hvis UI føles “smart”, “lekent” eller “inspirerende”, er det feil retning.

2. Grunnprinsipper (låst)
2.1 No-Exception Rule

Designet skal aldri gi inntrykk av fleksibilitet som ikke finnes i systemet.
Ingen skjulte valg. Ingen unntak.

2.2 Én sannhetskilde

Alle tall, status og rammer skal være entydige.
Ingen “syns vi burde”.

2.3 Fail-Closed

Hvis data er uklare → vis blokkert tilstand.
Ikke vis delvis fungerende UI.

2.4 Determinisme

Handling → eksplisitt respons → kvittering (rid, timestamp).
Ingen “stille” tilstander.

3. Brukerroller og designprioritet
3.1 Company Admin (Primær)

Design prioriteres for denne rollen.

Skal:

Umiddelbart se status

Forstå neste levering

Se rammer

Ha kontroll

Skal aldri:

Føle usikkerhet

Tolke data

Gjette systemstatus

3.2 Superadmin (Operativ kontroll)

Skal:

Se firmaer

Se binding

Se kontraktstatus

Se avvik

Design her er mer “kontrollpanel”.

3.3 Ansatt (Minimalistisk)

Kun:

Uke

Bestill / Avbestill

Historikk

Ingen avansert UI.

4. Informasjonsarkitektur
Admin

Dashboard

Avtale

Ansatte

Historikk

Lokasjoner

Fakturagrunnlag

Alltid maks 6 hovedfaner.

Superadmin

Firma

Avtaler

Drift

Logs

System Health

5. State-matrise (må designes eksplisitt)

UI må ha egne varianter for:

Ingen avtale

Pending avtale

Aktiv avtale

Pauset firma

Ingen ansatte

Ingen bestillinger

Før cut-off

Etter cut-off

Scope mismatch

System error

Ingen state skal “falle tilbake” til default UI.

6. Designsystem (konkret)
6.1 Typografi

Inter / system-ui

1 H1 per side

KPI-tall i 1.3–1.5× størrelse

Tydelig hierarki (H1 > H2 > Body)

6.2 Farger

Base: Nøytral, lys, rolig

ACTIVE: dempet grønn

PENDING: gul

PAUSED/CLOSED: rød

Ingen dekorativ neon

Ingen gradienter

6.3 Spacing-system

8px baseline grid

Card padding: 24px

Seksjonsmargin: 32–48px

Maks bredde: 1200px

6.4 Kort (Cards)

8–12px radius

Diskret skygge

Ingen tung glass-effekt

Ingen sterke border-farger

6.5 KPI-kort

Maks 3–5 per rad.

Skal alltid vise:

Tittel

Verdi

Undertekst (forklaring)

Ingen “uformelle labels”.

6.6 Tabeller

Sticky header

Søkeinput øverst

Sortering eksplisitt

Ingen inline redigering uten confirm

6.7 Dialoger

Alltid eksplisitt bekreftelse

Handlinger irreversible → sekundær confirm

Kvittering etter utført handling

7. Mobilstrategi

Admin = desktop-first
Mobil skal være lesbar, men ikke fullverdig operativ.

Ingen horisontal scroll.
Ingen kollaps som skjuler kritisk informasjon.

8. Motion-regler

Maks 150ms transitions

Ingen animasjoner som påvirker tall

Ingen mikro-interaksjoner som forstyrrer kontroll

9. Datavisualisering

Tall > grafer

Grafer kun når nødvendig

Historikk som liste først, graf sekundært

10. Kvalitetskriterier (UI Done)

En side er ikke “done” før:

Alle states finnes

Ingen usikkerhet i status

Ingen overlapp mellom roller

Ingen brudd på no-exception-rule

Alle handlinger gir kvittering

11. Ikke tillatt

Feature-bloat

UI som antyder fleksibilitet uten systemstøtte

Soft warnings

Implicit behavior

Uforklarte tall

12. Design-mål (langsiktig)

Lunchportalen skal visuelt oppleves:

Roligere enn Tripletex

Mer kontrollert enn Foodora for Business

Mer enterprise enn typiske lunsj-apper

Dette er nå en faktisk styringsfil.

Den kan:

Brukes av Codex

Låses i repo

Styre alle fremtidige UI-beslutninger

Brukes i investorpitch