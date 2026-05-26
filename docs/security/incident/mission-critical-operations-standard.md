Dette er ikke et vanlig dokument.
Dette er plattformens grunnlov.

🎯 NULL TOLERANSE FOR FØLGENDE

Disse feilene er ikke akseptable:

❌ Kunde kan ikke registrere firma

❌ Firma admin får ikke satt avtale

❌ Ansatt får ikke logget inn

❌ Ansatt får feil avtaleramme

❌ Ansatt får ikke bestilt før cut-off

❌ Bestilling forsvinner

❌ Kitchen får feil volum

❌ Printer får ikke produksjonsliste

❌ Cross-tenant feil

❌ Race conditions ved cut-off

❌ Service-role bypass

❌ Datatap

Hvis noe av dette skjer → systemet er ikke godkjent.

1️⃣ REGISTRERING – 100% GARANTI
Risikoer

Webhook feiler

DB-write feiler

Partial write (company opprettes, men ikke location)

Invite-token genereres feil

Race conditions

Krav

All registrering må være transaksjonell

Enten full suksess → eller rollback

Ingen partial states

Teknisk standard

DB transaction

Unique constraints

Idempotency key per registrering

Retry logic

Confirmation event log

Kontinuerlig test

Automatisk test hver natt:

Opprett firma

Opprett location

Opprett admin

Opprett invite

Verifiser status

2️⃣ AVTALE – NULL AMBIGUITET
Risikoer

To ACTIVE agreements

Feil location binding

Mismatch mellom UI og DB

Admin setter noe som ikke lagres

Krav

Partial unique index på ACTIVE agreement

Statusmaskin (PENDING → ACTIVE → PAUSED → CLOSED)

Ingen implicit default

All endring logges

Kontinuerlig verifisering

Cron som sjekker:

0 konflikter

0 overlapping avtaler

0 company ACTIVE uten avtale

3️⃣ INNLOGGING – MÅ ALDRI FEILE
Risikoer

Session loop

Token expiry

Profile mismatch

RLS blokkering

Deadlock

Krav

Health check på auth

Graceful fallback

Session refresh mekanisme

Profil polling til aktiv

Automatisk test

Login employee

Login company_admin

Login superadmin

Verifiser role mapping

4️⃣ BESTILLING – 100% IDPOTENT

Dette er kjernen.

Risikoer

Double click

Race condition

Network retry

Partial DB write

Order mistes

Cut-off bypass

Kitchen mismatch

Krav

UNIQUE(user_id, date)

ON CONFLICT update

Idempotency key

Write confirmation med:

rid

timestamp

order_id

Server-side validering

Fail-closed

Absolutt regel

En bestilling kan aldri eksistere i UI uten å eksistere i DB.

5️⃣ KITCHEN & PRINTER – MISSION CRITICAL
Risikoer

Snapshot genereres feil

Printer mister jobb

Partial eksport

Stale data

Scope feil

Krav

Snapshot genereres atomisk

Stable hash på snapshot

Export ID

Printer kvitterer

Retry mekanisme

Outbox pattern

Kitchen logg

Absolutt regel

Kitchen data må være:

Deterministisk

Idempotent

Verifiserbar

Reproduserbar

6️⃣ SCALING – FRA 2 TIL 50 000 FIRMA

Systemet må være:

O(1) per tenant

Ikke lineær query-scan

Indeksbasert

Partisjonerbar

Monitorert

Triggerpunkter:

3M orders → Partisjonering

70% CPU → Scale

200ms RPC latency → Investigate

7️⃣ SELVOVERVÅKNING

Hver dag skal systemet sjekke:

Tenant isolation

Agreement conflicts

Orders integrity

Cut-off enforcement

Snapshot consistency

Service-role misuse

Hvis feil → alarm.

8️⃣ FAIL-SAFE DESIGN

Hvis noe er uklart:

Blokker

Ikke improviser

Ikke fallback til svakere regel

Ikke default til permissive state

9️⃣ 24/7 HEALTH GUARANTEES

Minimum:

Health endpoint

DB latency monitor

RPC timing monitor

Error rate alert

Cut-off peak monitor

Printer confirmation monitor

🔟 NULL-DATA-TAP POLICY

Ingen DELETE på orders

Alle mutations logges

PITR backup

Restore test kvartalsvis

Snapshot audit

1️⃣1️⃣ AUTOMATISKE TESTER (IKKE VALGFRITT)

CI må:

Simulere cut-off

Simulere 100 samtidige bestillinger

Simulere agreement change

Simulere kitchen export

Simulere login load

1️⃣2️⃣ INGEN UNNTAK

Dette er fundamentalt:

Ingen “bare denne ene kunden”

Ingen “midlertidig override”

Ingen “vi fikser senere”

Ingen fleksibilitet utenfor modell

🏁 KONKLUSJON

Lunchportalen skal drifte:

Like stabilt med 2 firma som med 50 000

Like deterministisk med 4 ansatte som 10 000 000

Uten manuelle unntak

Uten skjulte fallback

Uten data tap

Dette er ikke ønskelig drift.

Dette er kravet.