# CURSOR MASTER PROMPT — LUNCHPORTALEN V4

Du er ikke her for å lage en prototype.
Du skal opptre som Principal Product Architect, Principal Engineer, CMS-arkitekt, UX/design-system lead og refaktoransvarlig for Lunchportalen.

Du skal bygge videre på eksisterende repo, ikke ved siden av det.
Du skal først forstå alt som finnes, så rydde, så forbedre, så ferdigstille.

Du skal ikke lage duplikater.
Du skal ikke lage døde filer.
Du skal ikke bygge nye spor dersom repoet allerede har en løsning som kan forbedres og fullføres.

Målet er et sammensatt, profesjonelt, sømløst og brukervennlig enterprise-system med CMS som hovedenhet, på nivå med Umbraco eller bedre, med AI som et integrert tillegg — ikke som støy.

--------------------------------------------------------------------------------
0. ABSOLUTTE REGLER
--------------------------------------------------------------------------------

1. Ikke ødelegg eksisterende login, registrering eller Supabase-auth.
2. Ikke bryt eksisterende Vercel deploy-modell.
3. Ikke hardkod secrets. Bruk eksisterende `.env.local`-kontrakter og eksisterende miljøvariabler.
4. Ikke skriv om store deler av systemet blindt. Scan repoet først.
5. Ikke lag nye filer dersom eksisterende filer/moduler kan forbedres eller deles opp ryddig.
6. Ikke lag parallelle sannheter for samme domene.
7. Ikke behold legacy/duplikater «for sikkerhets skyld». Enten behold, flytt, splitt eller slett på en kontrollert måte.
8. Alt som bygges skal være produksjonsrettet, testbart og dokumentert.
9. Fail-closed: ingen løse states, ingen skjult bypass, ingen «best effort auth».
10. Bevar eller forbedre alle eksisterende funksjoner i repoet som er relevante. Ikke regress.
11. Ikke lekk secrets fra `.env.local`, Supabase, Vercel, Google, Meta, OpenAI eller andre integrasjoner i logger, docs eller commits.
12. Alt som er AI-generert skal kunne redigeres, spores, kvalitetssikres og lagres uten skjult datatap.
13. Ikke innfør et tredje eller fjerde alternativ for samme problem. Konsolider.

--------------------------------------------------------------------------------
1. REPO-REALITET DU MÅ TA HENSYN TIL
--------------------------------------------------------------------------------

Denne kodebasen er allerede en stor Next.js 15 App Router-monolitt med Supabase/Postgres som driftsdatabase, Sanity som CMS-lag for deler av innholdet, stor backoffice/CMS-flate, mange API-ruter, AI-moduler, cron-ruter og eksisterende roller. Du må bruke dette som styrende realitet. Ikke late som repoet er grønt felt.

Du skal eksplisitt ta hensyn til at repoet allerede ser ut til å ha:
- pending onboarding
- superadmin-aktivering
- employee/week/order-kjerne
- 14-dagers fakturagrunnlag
- roller: superadmin, company_admin, employee, kitchen, driver
- stor AI-flate og backoffice/CMS-flate i samme app
- Week-regler som må harmoniseres
- flere potensielle sannheter rundt uke/meny
- designgjeld, komponentfragmentering og arbeidsflategjeld i CMS

--------------------------------------------------------------------------------
2. OVERORDNET MÅLBILDE
--------------------------------------------------------------------------------

Bygg Lunchportalen som en enterprise SaaS-plattform for lunsjstyring som:
- erstatter kantine
- fjerner administrasjon for bedrifter
- gir full kontroll til leverandør
- gir selvbetjening til ansatte innenfor stramme rammer
- er bygget for skala
- har CMS som hovedenhet for redaksjon, innhold, sidebygging og operasjonell oversikt
- har AI som assistent og optimalisering, ikke som uforutsigbar sannhetskilde
- har en tydelig bærekrafts- og ESG-dimensjon
- har en SEO- og innholdsmotor som gjør Lunchportalen synlig og dominerende i sin kategori

Kvalitetsnivå:
- minst Umbraco-nivå på CMS-opplevelse
- profesjonell disiplin og produktkvalitet i stil med en moden enterprise-aktør
- sømløs, rolig, rask og tillitsvekkende opplevelse

--------------------------------------------------------------------------------
3. FORRETNINGSMODELL SOM SKAL VÆRE FASIT
--------------------------------------------------------------------------------

Implementer og håndhev følgende som autoritativ forretningslogikk:
- Minimum 20 ansatte per kunde
- Bindingstid: 12 måneder
- Oppsigelse: 3 måneder før utløp av bindingstid
- Company admin skal få tydelig påminnelse før oppsigelsesvinduet
- Påminnelsen skal være ærlig og tydelig: velg å si opp eller fortsette i ny 12-måneders periode
- Ingen skjulte feller
- Ingen unntak utenfor systemet
- Pris per ansatt / per lokasjon
- Plattformen er én sannhetskilde
- B2B-faktura hver 14. dag til company admin
- Ingen Vipps eller Klarna i Lunchportalen-kundeopplevelsen
- Avbestilling og presis planlegging skal brukes som styrke for bærekraft og redusert matsvinn

Dersom repoet har Stripe/SaaS-flyt for andre plattformformål, skal du ikke ødelegge den. Men Lunchportalen-forretningsmodellen skal være B2B-faktura til company admin, ikke checkout for ansatte.

--------------------------------------------------------------------------------
4. ROLLER OG TILGANGER
--------------------------------------------------------------------------------

Systemet skal ha disse rollene med fail-closed tilgang:

## Superadmin
Full kontroll over alt:
- firma
- avtaler
- ansatte
- company admins
- kjøkken
- drivere
- lokasjoner
- menyer
- ukeplaner
- innhold
- media
- AI-arbeidsflyter
- systemstatus
- fakturaer
- oppsigelser
- stenging/sletting
- ESG-oversikt
- SEO-motor og innholdskalender
- SoMe-kalender og publisering

Superadmin kan endre og slette alt.

## Company admin
Skal ha tilgang til:
- firmaets avtaleoversikt (lesing eller kontrollert endringsforespørsel)
- økonomi
- fakturaer
- ansatte: legge til, invitere, deaktivere, slette innenfor firma
- lokasjoner innenfor firma dersom forretningsreglene tillater det
- se status på abonnement, bindingstid og oppsigelsesfrist
- motta påminnelse om oppsigelse/fornyelse
- se ESG-/bærekraftsoversikter for eget firma dersom det passer produktet

Company admin skal ikke kunne bryte rammer satt av system og superadmin.
Company admin skal ikke kunne gjøre superadmin-mutasjoner på avtale dersom målbildet sier at superadmin styrer dette.
Hvis company admin trenger endring, bygg kontrollert forespørsel-/godkjenningsflyt.

## Employee
Skal være ekstremt enkel og mobiloptimal.
Employee skal kun ha tilgang til:
- Week
- bestilling
- avbestilling
- kun innenfor avtale og cutoff

Ikke gi employee brede portalflater.
Gjør tilgangsmodellen strengere enn i dagens allowlists dersom repoet er for romslig.

## Kitchen
Skal ha naturlige kjøkkenfunksjoner:
- produksjonsliste
- oversikt per dato
- per firma
- per lokasjon
- per ansatt dersom nødvendig
- filtrering og utskrifts-/eksportmuligheter dersom relevant
- status og oversikt som støtter drift
- menystyring/forbruksoverblikk hvis dette hører til eksisterende modell

## Driver
Skal ha mobiloptimal leveringsflate:
- dagens leveringer
- rute-/listevisning
- lokasjon, kontaktinfo, status
- markere som levert på mobil
- rask interaksjon ute i felt

--------------------------------------------------------------------------------
5. OPERATIV HOVEDFLYT
--------------------------------------------------------------------------------

Du skal gjøre denne flyten til hovedsannhet i systemet:
1. Firma registrerer seg → status `pending`
2. Superadmin godkjenner firma og avtale
3. Firma blir aktivt
4. Company admin kan invitere og administrere ansatte
5. Ansatte bruker kun Week for bestilling/avbestilling
6. Kitchen får produksjonsgrunnlag
7. Driver får leveringsgrunnlag og kan markere levert
8. Fakturagrunnlag genereres hver 14. dag til company admin
9. ESG og driftstall avledes fra faktiske bestillinger, avbestillinger og leveranser

Alt skal være servervalidert.
Alt skal være rollebasert.
Alt skal være tenant-sikkert.

--------------------------------------------------------------------------------
6. WEEK-LOGIKK: DETTE SKAL VÆRE KRYSTALLKLART
--------------------------------------------------------------------------------

Du skal rydde og ferdigstille Week som den viktigste operative flaten.

Målregler:
- Cutoff for bestilling/avbestilling: 08:00 lokal tid (servervalidert)
- Denne uken skal fjernes fredag kl. 15:00
- Neste uke skal bli synlig torsdag kl. 08:00
- Det skal være overlapp mellom torsdag 08:00 og fredag 15:00 der begge ukene er synlige
- Ansatte kan kun operere innenfor avtalen
- Ansatte skal ikke kunne bestille utenfor tillatte dager/nivåer/lokasjoner

VIKTIG:
Repoet ser ut til å ha minst to spor for ukeplan (`menu`+agreement og `weekPlan`).
Du skal IKKE la dette fortsette som uklar dobbel sannhet.

Du skal:
1. kartlegge alle spor som påvirker Week
2. velge og dokumentere én autoritativ sannhet
3. migrere eller koble andre spor under denne sannheten
4. rydde opp i naming og ansvar
5. rette fredag 14:00 → fredag 15:00 dersom forretningsreglene her er fasit

Lag tydelig dokumentasjon på hva som eier:
- menyinnhold
- ukesynlighet
- lock/cutoff
- ordregrunnlag
- produksjonsgrunnlag
- fakturagrunnlag
- ESG-grunnlag

--------------------------------------------------------------------------------
7. CMS SOM HOVEDENHET
--------------------------------------------------------------------------------

CMS-et skal være det profesjonelle navet i plattformen.
Det skal ikke være et tilfeldig adminpanel.

Bygg eller ferdigstill et ekte enterprise CMS med:
- content tree
- blokkbygging / page builder
- preview som bruker samme render pipeline som frontend
- media library
- globale innstillinger
- side-/seksjonsbygging
- publiseringsflyt
- revisions/versioning der relevant
- AI-assistanse direkte i editor
- strukturert innhold som kan brukes på tvers av frontend og operativ flate

CMS skal være på nivå med Umbraco eller bedre i opplevd profesjonalitet.

CMS-kjerne som må ferdigstilles:
1. Content tree
   - ekte persistens
   - flytting/rekkefølge
   - nesting
   - tydelig oversikt
2. Media system
   - bibliotek
   - metadata
   - varianter
   - referanser
   - trygg sletting/brukskontroll
3. Content workspace
   - bryt opp monolittisk workspace hvis nødvendig
   - modulær, rolig, vedlikeholdbar editor
4. Block system
   - rydde komponentduplikater
   - stramme kontrakter
   - tydelige schemas
5. Preview
   - samme pipeline som publisert side

--------------------------------------------------------------------------------
8. DESIGN, TYPOGRAFI, FARGESTYRING OG UX
--------------------------------------------------------------------------------

Dagens CMS-design skal behandles som utilstrekkelig.
Ikke gjør kosmetiske småjusteringer. Gjør en systematisk redesign av designgrunnlaget.

Du skal forbedre eksplisitt:
- typografi
- fontvalg og fontskala
- fargehierarki
- semantiske tokens
- spacing og rytme
- informasjonsarkitektur i CMS
- tetthet og lesbarhet i tabeller og skjemaer
- sidebar, toolbar, modaler, paneler og overlays
- states: tom, loading, saving, success, error, disabled, dirty, published, scheduled
- ikonbruk
- konsistent visuell språkføring
- profesjonell ro og tydelighet
- tillitsvekkende enterprise-følelse
- mobilopplevelse for Week og Driver

Mål:
- CMS/backoffice skal føles premium, selvsikkert og ryddig
- det skal se ut som et produkt, ikke en samling features
- det skal være bedre strukturert, penere og mer gjennomført enn dagens løsning
- ansatte på mobil skal oppleve Week som lett og lynrask

Du skal produsere:
- `docs/refactor/CMS_VISUAL_AUDIT.md`
- `docs/refactor/DESIGN_SYSTEM_FOUNDATIONS.md`
- `docs/refactor/CMS_UX_REDESIGN_PLAN.md`
- `docs/refactor/DESIGN_TOKEN_MAP.md`
- `docs/refactor/COMPONENT_CONSOLIDATION_LOG.md`
- `docs/refactor/CMS_VISUAL_BEFORE_AFTER.md`
- `docs/refactor/MOBILE_WEEK_AND_DRIVER_UX_PLAN.md`

Du skal også rydde opp i duplisert komponentbruk mellom `components/` og `src/components/` uten å lage et tredje UI-rotpunkt.

--------------------------------------------------------------------------------
9. AI I CMS — SIDER, REALISTISKE BILDER, TEKST, SEO, CRO, UI OG UX
--------------------------------------------------------------------------------

AI i CMS er et kjerneområde og skal videreutvikles til et profesjonelt redaksjonelt arbeidsverktøy.
Det er ikke ferdig i dag. Du skal ferdigstille det kontrollert.

Bygg eller ferdigstill disse AI-evnene i CMS:
- generere hele sider
- generere seksjoner og blokker
- generere realistiske bilder der systemet har godkjent provider/oppsett for det
- generere tekstutkast
- generere metadata, titler, beskrivelser og struktur for SEO
- foreslå CRO-forbedringer
- foreslå UI/UX-forbedringer for landingssider og konverteringsflater
- gi health score / kvalitetsvurdering på innhold
- forklare hvorfor et forslag er bra eller dårlig

Viktige regler:
- AI skal være assisterende og redigerbar
- alt AI-generert innhold må kunne lagres, redigeres, previewes og lastes inn igjen identisk
- AI skal ikke skape skjult datatap eller uforutsigbar struktur
- AI-bilder må inn i mediesystemet eller en tilsvarende kontrollert asset-flyt
- AI-genererte sider må bruke samme block/render-pipeline som vanlige sider
- bygg revisjonshistorikk for AI-innhold der det er relevant
- logg input/output på trygg måte uten å lekke secrets eller sensitiv data
- bruk eksisterende AI-byggesteiner hvis de er gode; konsolider ellers

--------------------------------------------------------------------------------
10. SEO-DOMINANS-MOTOR FOR LUNSJ
--------------------------------------------------------------------------------

Det finnes et mål om at systemet skal dominere SEO for lunsjrelaterte søk. Du skal bygge dette som en kontrollert, compliant SEO-motor i CMS/backoffice.

VIKTIG:
Ikke bygg ulovlig eller uansvarlig scraping.
Bruk godkjente og robuste datakilder/APIs der mulig.

Motoren skal kunne bruke, dersom tilgjengelig:
- Google Search Console-data
- Google Analytics-data
- Google Trends eller tilsvarende legitime trendkilder
- interne søkedata
- eksisterende sideytelse og SERP-data fra godkjente kilder
- publisert innhold og innholdsgap i eget domene

Mål:
- identifisere hva folk søker etter innen lunsj, lunch, kontorlunsj, lunsjtid og nærliggende emner
- prioritere innholdsgap
- foreslå eller generere nye sider/poster/innlegg
- optimalisere eksisterende sider for SEO og CRO
- bygge innholdsplan og publiseringskalender
- måle effekt over tid

Bygg dette som et CMS-produktområde med:
- keyword/topic dashboard
- opportunities backlog
- AI content recommendations
- content gap analyzer
- page optimizer
- metadata optimizer
- internal linking suggestions
- SEO health overviews
- approval workflow før større endringer publiseres

Ingen “mystisk black box” som bare sprøyter ut tekst.
Alt skal være synlig, forklarbart og redigerbart.

--------------------------------------------------------------------------------
11. AUTOMATISK INNLEGGSGENERERING OG INNLEGGSKALENDER FOR LUNCHPORTALEN
--------------------------------------------------------------------------------

Dette er et eget produktområde som skal bygges inn i CMS/backoffice.
Det skal ligne arbeidsflyten man kjenner fra profesjonelle publiseringsverktøy, men brukes KUN for Lunchportalen sine egne kanaler.
Ikke for kunder. Ikke multi-tenant posting for andre selskaper.

Formål:
Bygg en redaksjonell innleggsmodul som automatisk kan generere og planlegge innlegg til Lunchportalen sine egne:
- Facebook
- Instagram

Innleggene skal handle om temaer som naturlig passer Lunchportalen:
- Lunsj
- Lunch
- Kontorlunsj / kontor lunsj
- Lunsjtid
- lunsj på jobb
- menyer, arbeidsplassmat, trivsel rundt lunsj, bærekraft, matsvinn, sesong og relevante vinklinger

Funksjonelle krav:
- innholdskalender
- måned/uke/dag-visning
- status per innlegg: draft, generated, scheduled, published, failed, rejected
- generering av bilde, tekst/caption og hashtags
- redaksjonell gjennomgang før publisering
- mulighet til å redigere innlegg
- mulighet til å slette innlegg
- mulighet til å forkaste innlegg som er for dårlige eller feil
- mulighet til å regenerere tekst, bilde eller hashtags hver for seg
- mulighet til å pause publisering
- mulighet til å publisere manuelt nå
- logging av publiseringsforsøk og feil
- historikk på hva AI foreslo vs hva som faktisk ble publisert
- integrasjon med mediesystemet og SEO-motoren der det gir verdi

Plattformkrav:
- KUN Lunchportalen sine egne kontoer
- bruk offisielle Meta-integrasjoner/API-er for Facebook og Instagram der det er mulig
- lagre tokens/credentials sikkert via env/secrets, ikke hardkodet
- tydelig skille mellom generert innhold og publisert innhold
- støtte planlagt publisering via cron/worker/outbox
- bruk eksisterende AI-, media-, queue- og cron-byggesteiner i repoet hvis de finnes
- ikke bygg et separat mini-system hvis dette kan integreres i CMS/backoffice på en ryddig måte

Editorial kvalitet:
- føles som Lunchportalen
- trygg og profesjonell tone
- relevant for lunsj/arbeidsplass/bedriftsmat
- unngå generisk søppelinnhold
- unngå gjentakelser
- variasjon i vinkling og format
- norske innlegg som hovedspor, med strategisk bruk av engelske ord som Lunch kun der det gir mening

Moderering og kontroll:
Superadmin eller autorisert redaktør skal kunne:
- se kalenderen
- endre plan
- redigere tekst
- bytte bilde
- fjerne hashtags
- slette innlegget
- godkjenne/avvise innlegg
- se hvorfor et innlegg feilet
- re-queue innlegg

--------------------------------------------------------------------------------
12. ESG OG BÆREKRAFT ER ET EGET SYSTEMOMRÅDE
--------------------------------------------------------------------------------

Lunchportalen skal ikke bare være en bestillingsmotor. Den skal også tydelig vise bærekraftseffekt og ESG-relevans.

Avbestilling før cutoff skal behandles som en styrke fordi det reduserer svinn.
Bygg eller ferdigstill et ESG-/bærekraftsmodul som minimum kan håndtere:
- registrere og beregne reduksjon i matsvinn basert på avbestillinger og presis planlegging
- oversikt over bestilt vs avbestilt vs levert
- bærekraftsnøkler per firma, lokasjon og total plattform
- rapporter/dashboards for superadmin og company admin der relevant
- historikk over forbedringer over tid
- tydelige forklaringer, ikke bare tall

Dersom data finnes eller kan beregnes på en ryddig måte, vurder også:
- leveringspresisjon
- ruteeffektivitet
- emballasjeindikatorer
- sesong-/lokalmatindikatorer
- utslippsproxyer

Viktig:
- Ikke bygg falsk ESG
- Hvis en metrikk er usikker, merk den tydelig som estimat
- ESG må bygges på faktiske data og tydelige antagelser

--------------------------------------------------------------------------------
13. SUPABASE, .ENV.LOCAL OG VERCEL
--------------------------------------------------------------------------------

Dette systemet skal fortsatt henge sømløst sammen med Supabase.
`.env.local` inneholder viktige koder/konfigurasjon.

Regler:
- ikke print hemmeligheter i logger eller docs
- ikke overskriv fungerende auth-kontrakter
- ikke byt ut Supabase med annen auth eller database
- ikke bryt eksisterende miljøvariabler hvis det ikke er absolutt nødvendig
- hvis nye env-variabler må inn, dokumenter dem tydelig i `.env.example` eller tilsvarende uten å lekke hemmeligheter
- behold Vercel-kompatibel deploy
- behold eller forbedre bygg som allerede brukes i repoet

--------------------------------------------------------------------------------
14. PRESTASJON OG MOBILKRAV
--------------------------------------------------------------------------------

Systemet skal være lynraskt og spesielt optimalisert for mobile ansatte på farten.

Employee mobile:
- Week skal være ekstremt rask
- bestilling/avbestilling på få trykk
- tydelig status
- minimal venting
- ingen tung, støyete UI
- raske serverresponser
- liten klientlast der mulig

Driver mobile:
- dagens leveringer må fungere svært godt på mobil
- store trykkflater
- rask statusoppdatering
- tydelig levering ferdig

Company admin og kitchen:
- responsivt nok til å fungere bra på mindre skjermer, men uten å ofre desktop arbeidsflyt

Tekniske krav:
- bruk server components der det gir mening
- unngå unødvendig client-side kompleksitet
- reduser bundle-støy
- cache klokt
- profilér tunge ruter
- ikke introduser nye ytelsesregresjoner

--------------------------------------------------------------------------------
15. SIKKERHET OG KONSISTENS
--------------------------------------------------------------------------------

Du skal gå hardt etter auth- og autorisasjonsmodellen.

Mål:
- streng server-side rollevalidering
- streng tenant-isolasjon
- ingen employee-tilgang utover Week dersom det er målbildet
- superadmin-ruter skal være hardt gated
- company_admin-ruter skal være stramt scoped til eget firma
- kitchen/driver skal kun se det de trenger
- ingen route må stole kun på middleware-cookie

Dersom repoet i dag har for tynn middleware og mer spredt auth, skal du stramme dette inn kontrollert uten å knuse login-flyten.

--------------------------------------------------------------------------------
16. ARBEIDSMETODE — MÅ GJØRES I FASER
--------------------------------------------------------------------------------

Du skal ikke bare begynne å skrive kode. Du skal jobbe i disse fasene:

Fase 0 — Repo-scan og sannhetskart
Produser:
- `docs/refactor/REPO_SCAN_AND_TRUTH_MAP.md`
- `docs/refactor/DUPLICATE_AND_UNUSED_FILE_AUDIT.md`
- `docs/refactor/LUNCHPORTALEN_DOMAIN_MAP.md`

Målet er å dokumentere:
- hva som finnes
- hva som er i bruk
- hva som overlapper
- hva som er dødt
- hva som er autoritativ sannhet for hvert domene

Fase 1 — Arkitekturavgjørelser
Produser:
- `docs/refactor/TARGET_ARCHITECTURE.md`
- `docs/refactor/ROLE_AND_ACCESS_MATRIX.md`
- `docs/refactor/WEEK_DOMAIN_DECISION.md`
- `docs/refactor/SOCIAL_PUBLISHING_ARCHITECTURE.md`
- `docs/refactor/AI_CMS_CAPABILITIES_MAP.md`
- `docs/refactor/SEO_ENGINE_ARCHITECTURE.md`
- `docs/refactor/ESG_SYSTEM_MODEL.md`

Fase 2 — Rydding før nybygg
- fjern/merge duplikater
- samle komponentrøtter
- rydde døde API-spor der det er trygt
- splitte ut monolittiske komponenter kontrollert
- bevare fungerende login/onboarding

Fase 3 — CMS-kjerne og design
- content tree
- media library
- workspace-refaktor
- blokksystem-konsolidering
- preview/publishing
- design system
- visual cleanup

Fase 4 — Operativ kjerne
- Week som én sannhet
- employee stramming
- company admin finans/invoice/employee management
- kitchen
- driver
- agreement/approval lifecycle
- bindingstid/oppsigelsesvarsling
- ESG-kobling til operativ data

Fase 5 — AI og vekstmotor
- AI i CMS ferdigstilles
- SEO engine
- social calendar
- generator workflows
- scheduler/publisher
- review/edit/delete flows

Fase 6 — Test, hardening, deploy readiness
- tester
- ytelse
- sikkerhet
- observability
- verifisert Vercel readiness

--------------------------------------------------------------------------------
17. IKKE-DUPLIKAT-REGLER
--------------------------------------------------------------------------------

Før du lager nye moduler eller filer må du:
1. søke etter eksisterende tilsvarende modul
2. vurdere om den kan utvides eller refaktoreres
3. dokumentere hvorfor ny fil er nødvendig hvis du likevel lager den

Lag løpende logg i:
- `docs/refactor/COMPONENT_CONSOLIDATION_LOG.md`
- `docs/refactor/MODULE_DECISION_LOG.md`

Hver ny mappe/fil som opprettes skal ha en kort begrunnelse.

--------------------------------------------------------------------------------
18. TESTKRAV
--------------------------------------------------------------------------------

Du skal ikke regne arbeidet som ferdig uten tester og verifisering.

Minstekrav:
- auth/login/post-login ikke regress
- onboarding pending → activate flyt verifisert
- company admin og superadmin-tilganger testet
- employee kun Week testet
- Week cutoff og synlighet testet med torsdag 08:00 / fredag 15:00
- kitchen og driver flyter testet
- fakturavindu 14 dager testet
- bindingstid/oppsigelsespåminnelse testet
- social post generator + kalender + review + publish testet
- SEO-engine beslutningsflyt testet
- ESG-metrikkgrunnlag testet der mulig
- tenant-isolasjon testet
- AI persistence testet der AI påvirker redigerbart innhold

--------------------------------------------------------------------------------
19. LEVERANSER DU SKAL PRODUSERE
--------------------------------------------------------------------------------

I tillegg til kode skal du produsere:
1. `docs/refactor/REPO_SCAN_AND_TRUTH_MAP.md`
2. `docs/refactor/DUPLICATE_AND_UNUSED_FILE_AUDIT.md`
3. `docs/refactor/LUNCHPORTALEN_DOMAIN_MAP.md`
4. `docs/refactor/TARGET_ARCHITECTURE.md`
5. `docs/refactor/ROLE_AND_ACCESS_MATRIX.md`
6. `docs/refactor/WEEK_DOMAIN_DECISION.md`
7. `docs/refactor/CMS_VISUAL_AUDIT.md`
8. `docs/refactor/DESIGN_SYSTEM_FOUNDATIONS.md`
9. `docs/refactor/CMS_UX_REDESIGN_PLAN.md`
10. `docs/refactor/DESIGN_TOKEN_MAP.md`
11. `docs/refactor/COMPONENT_CONSOLIDATION_LOG.md`
12. `docs/refactor/MODULE_DECISION_LOG.md`
13. `docs/refactor/SOCIAL_PUBLISHING_ARCHITECTURE.md`
14. `docs/refactor/SOCIAL_CALENDAR_EDITORIAL_MODEL.md`
15. `docs/refactor/AI_CMS_CAPABILITIES_MAP.md`
16. `docs/refactor/SEO_ENGINE_ARCHITECTURE.md`
17. `docs/refactor/ESG_SYSTEM_MODEL.md`
18. `docs/refactor/ENV_AND_DEPLOY_NOTES.md`
19. `FINAL_IMPLEMENTATION_REPORT.md`

`FINAL_IMPLEMENTATION_REPORT.md` må inneholde:
- hva som ble beholdt
- hva som ble refaktorert
- hva som ble slettet
- hvorfor
- hvilke domener som nå har én sannhet
- hvordan auth ble bevart
- hvordan Supabase/Vercel ble bevart
- hvordan CMS ble styrket
- hvordan design systemet ble implementert
- hvordan AI i CMS fungerer
- hvordan SEO engine fungerer
- hvordan social publishing fungerer
- hvordan ESG-systemet fungerer
- hva som fortsatt er teknisk gjeld

--------------------------------------------------------------------------------
20. SLUTTKRAV FØR DU ANSER JOBBEN SOM FERDIG
--------------------------------------------------------------------------------

Arbeidet er ikke ferdig før følgende er sant:
- login og registrering virker fortsatt
- Supabase-integrasjon er bevart
- Vercel deploy-modellen er bevart
- ingen unødvendige duplikatfiler er introdusert
- employee-opplevelsen er mobilrask og stram
- company admin har økonomi/faktura/ansattstyring
- superadmin kan styre alt
- kitchen og driver har naturlige operative flater
- CMS føles profesjonelt og redaktørvennlig
- design, skrift og fargestyring er løftet markant
- Week har én sannhet
- fredag-regel er korrekt etter fasit
- innleggskalender for Lunchportalen egne Facebook/Instagram-kanaler fungerer med review/edit/delete
- SEO-motoren er kontrollert, forklarbar og nyttig
- ESG-modulen bygger på reelle data og tydelige estimater
- AI er nyttig og kontrollert
- testene dekker kritiske flater

--------------------------------------------------------------------------------
21. ARBEIDSSTIL I CURSOR
--------------------------------------------------------------------------------

Du skal jobbe som en senior som rydder et ekte produkt:
- små, trygge steg
- scan før endring
- dokumenter før ombygging når det er nødvendig
- gjenbruk eksisterende moduler der det er riktig
- unngå performative omskrivninger
- vær ærlig om hva som er for dårlig
- ferdigstill, ikke bare demonstrer

Start nå med Fase 0.
Ikke hopp rett til ny kode.
Først: kartlegg sannhet, duplikater, auth-risiko, CMS-gap, designgjeld, Week-domene, SEO-spor, ESG-spor og eksisterende AI/social-relaterte spor.
