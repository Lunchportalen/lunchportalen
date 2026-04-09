# Company admin — Binding, oppsigelse og påminnelse (2C1)

## Datamodell (finnes)

- `agreements.binding_months` og `agreements.notice_months` finnes i databasen (migrasjoner / onboarding).

## Hva 2C1 gjør

- **Viser** binding-/oppsigelsesmåneder på avtale-siden når rad finnes (lesing).
- **Ingen** automatisk e-post/påminnelse (3 mnd) — **ikke** implementert som cron eller jobb i 2C1.
- Tydelig **UI-tekst** om at automatisk påminnelse ikke er aktiv.

## Hva som mangler for «ekte» påminnelses-runtime

- Planlagt jobb (cron / kø) som leser `end_date` / binding og `notice_months`, pluss outbound e-post.
- Produkt/regel for når varselet sendes (kun enterprise-avklaring).

## Oppsigelse/fornyelse som mutasjon

- **Ikke** lagt til som self-service-knapp — krever prosess/superadmin; støttetekst peker til support/kundeteam.
