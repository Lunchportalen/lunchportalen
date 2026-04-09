# Umbraco parity — build sequence (lav risiko først)

**Prinsipp:** Paritet løftes med **IA, dokumentasjon, eksisterende flater** og **små trygge** kodeendringer — ingen parallelle systemer.

## Fase A — Kart og sannhet (ferdig som denne leveransen)

1. Baseline + gap map + runtime-grenser (denne mappen).
2. Avstemming mot `docs/cms-control-plane/CP6–CP7`.

## Fase B — Navigasjon og fortelling (lav risiko)

1. Sikre at **domain surfaces** og **control**-sider er **første** stopp for «hvor er X?».
2. Jevn **terminologi** (publish, preview, runtime, editorial) på tvers av backoffice headers.

## Fase C — Meny/uke (medium risiko — allerede delvis gjort)

1. CP7 broker + Studio-handoff — **beholdt**.
2. Eventuelt: forbedret **ukevisning** i CMS (lesing + status) uten ny sannhet.

## Fase D — Media og content workspace (lav–medium)

1. Små UX-forbedringer i **media** (søk/filter) der allerede mønstre finnes.
2. **Ikke** ny DAM.

## Fase E — Growth (ærlighet først)

1. Badge og copy — **LIMITED** der backend ikke er bred-live.
2. Kobling til content/media der allerede støttet.

## Fase F — Hardening

1. Fail-closed routes (kun der hull er dokumentert).
2. Runbooks for publish-token og visibility.

## Det som ikke skal gjøres uten replatformingsvedtak

- Erstatte Sanity eller Postgres CMS med én Umbraco-instans.
- Flytte ordre/avtale til CMS-lag.
