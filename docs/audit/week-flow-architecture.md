# Audit: /week-flow architecture

Dato: 2026-05-12
Scope: Pure read-only audit av `/week`-flaten for planlegging av fase 9b.
Kilder: Repo-lesing. Ingen Sanity-, Supabase- eller eksterne API-kall er gjort.

## Seksjon 1: Route-oversikt

`app/(app)/week/page.tsx` (server component, 725 linjer): Håndterer `/week`, gjør auth/rolle/firmastatus-gating, rendrer normal ansattflate med `EmployeeWeekClient`, og rendrer superadmin-preview med Sanity `menuDay`-status. Se imports og metadata i `app/(app)/week/page.tsx:1-31`, normal retur i `app/(app)/week/page.tsx:570-723`.

`app/(app)/week/EmployeeWeekClient.tsx` (client component, 1718 linjer): Hovedklient for ansatt ukevisning; henter ordre-vindu fra `/api/order/window`, viser dager/menytekst/status, og skriver bestilling/avbestilling via `/api/order/set-day`. Se API-konstant i `app/(app)/week/EmployeeWeekClient.tsx:22` og hovedcomponent i `app/(app)/week/EmployeeWeekClient.tsx:926-1718`.

`app/(app)/week/min-dag/page.tsx` (server component, 221 linjer): Read-only statusflate som bruker samme ordre-vindu som `/week` for synlige dager, låsing og egen lunsjstatus. Se kommentar og imports i `app/(app)/week/min-dag/page.tsx:1-30`, server-fetch i `app/(app)/week/min-dag/page.tsx:182-218`.

`app/(app)/week/mine-registrerte-dager/page.tsx` (server component, 281 linjer): Read-only kompakt oversikt over dagens/kommende vindusdata pluss nylige tidligere ordredager. Se formål i `app/(app)/week/mine-registrerte-dager/page.tsx:1-35`, datainnhenting i `app/(app)/week/mine-registrerte-dager/page.tsx:168-185`.

`app/(app)/week/mine-lunsjendringer/page.tsx` (server component, 156 linjer): Read-only liste over egne siste ordre-rader fra operativ `orders`-tabell. Se formål og metadata i `app/(app)/week/mine-lunsjendringer/page.tsx:1-27`, historikkhenting i `app/(app)/week/mine-lunsjendringer/page.tsx:77-81`.

`app/(app)/week/tidligere-lunsjdager/page.tsx` (server component, 188 linjer): Read-only historikk for egne tidligere lunsjdager før dagens Oslo-dato, gruppert per uke. Se formål og metadata i `app/(app)/week/tidligere-lunsjdager/page.tsx:1-29`, historikkhenting og gruppering i `app/(app)/week/tidligere-lunsjdager/page.tsx:79-86`.

`app/(app)/week/bestillingsprofil/page.tsx` (server component, 282 linjer): Read-only enkel bestillingsprofil basert på operativ ordrehistorikk og ordre-vindu. Se formål i `app/(app)/week/bestillingsprofil/page.tsx:1-37`, parallell datainnhenting i `app/(app)/week/bestillingsprofil/page.tsx:89-109`.

`app/(app)/week/ordre/[date]/page.tsx` (server component, 276 linjer): Read-only ordredetalj for én leveringsdato, med operativ ordrestatus og dagsforklaring fra ordre-vindu når datoen finnes der. Se formål i `app/(app)/week/ordre/[date]/page.tsx:1-31`, datainnhenting i `app/(app)/week/ordre/[date]/page.tsx:100-129`.

## Seksjon 2: Hovedflaten - `/week`

### 2.1 Data-henting server-side i `page.tsx`

- Auth-cookie precheck: leser cookies og lokal dev-bypass i `app/(app)/week/page.tsx:577-580`. Resultatet brukes til å redirecte til `/login?next=/week` før Supabase-klient opprettes.
- Supabase auth: kaller `sb.auth.getUser()` etter `supabaseServer()` i `app/(app)/week/page.tsx:583-587`. Resultatet brukes til å hente e-post, metadata-rolle og redirecte unauthenticated til `/login?next=/week`.
- Rolleutledning: e-postrolle og user_metadata-rolle normaliseres i `app/(app)/week/page.tsx:590-593`. `superadmin` får egen preview-flate i `app/(app)/week/page.tsx:595-597`.
- Aktiv avtale-gate: kaller `requireActiveAgreement()` i `app/(app)/week/page.tsx:599`. Funksjonen bypasser bare `superadmin`, ellers henter avtale-status og redirecter til `/avtale-ikke-aktiv` hvis ikke aktiv, se `lib/agreements/requireActiveAgreement.ts:18-49`.
- Profile query: henter `company_id,location_id` fra `profiles` via `sb.from("profiles").select("company_id,location_id").maybeSingle()` i `app/(app)/week/page.tsx:601-602`. `company_id` brukes til firmaverifisering; manglende profil gir `/status?code=PROFILE_MISSING` for employee i `app/(app)/week/page.tsx:601-635`.
- Admin client init: `adminClientOrNull()` importerer `supabaseAdmin()` i `app/(app)/week/page.tsx:62-68`. Hvis service role mangler, rendres `EmployeeWeekClient` med `canAct=false` og `billingHoldReason` i `app/(app)/week/page.tsx:640-667`.
- Company query: henter `id,status,billing_hold,billing_hold_reason,hold_active,hold_reason,payment_hold` fra `companies` med `.eq("id", companyId).maybeSingle()` i `app/(app)/week/page.tsx:671-675`. Resultatet går inn i `computeBillingHold()` i `app/(app)/week/page.tsx:707`, som setter `canAct` og `billingHoldReason`.
- Superadmin Sanity-kall: kun for `role === "superadmin"` kalles `renderSuperadminWeekPreview()` i `app/(app)/week/page.tsx:595-597`. Den henter `menuDay` via `getMenuForDates(allDates)` i `app/(app)/week/page.tsx:476-488`, importert fra `@/lib/cms/menuDay` i `app/(app)/week/page.tsx:20`.
- Normal ansattdata for dager/ordre/meny hentes ikke server-side i `page.tsx`; `EmployeeWeekClient` får bare gating-props og henter vinduet client-side fra `/api/order/window`, se `app/(app)/week/EmployeeWeekClient.tsx:1052-1149`.

### 2.2 Props til `EmployeeWeekClient`

Type er definert lokalt i `app/(app)/week/EmployeeWeekClient.tsx:404-409`:

```ts
type Props = {
  canAct: boolean;
  billingHoldReason?: string | null;
  previewMode?: PreviewMode;
  readOnlyPreview?: boolean;
};
```

- `canAct`: styrer om ordrehandlinger er globalt tilgjengelige. Brukes i `blocked` i `app/(app)/week/EmployeeWeekClient.tsx:1453` og sendes til dagkort i `app/(app)/week/EmployeeWeekClient.tsx:1643-1657`.
- `billingHoldReason`: melding når `canAct=false`. Brukes i blocked-state i `app/(app)/week/EmployeeWeekClient.tsx:1495-1504`.
- `previewMode`: `"basis" | "luxus" | "mixed"`, definert i `app/(app)/week/EmployeeWeekClient.tsx:73`, brukes til demo-dager via `buildPreviewDays()` i `app/(app)/week/EmployeeWeekClient.tsx:311-332`.
- `readOnlyPreview`: gjør klienten ikke-skrivbar og bruker preview-data. Brukes ved superadmin-preview i `app/(app)/week/page.tsx:450-456` og i preview-reset i `app/(app)/week/EmployeeWeekClient.tsx:997-1017`.
- Call sites: superadmin preview sender `canAct={false}`, `previewMode`, `readOnlyPreview` i `app/(app)/week/page.tsx:450-456`; profil/service/firmastatus-feil sender `canAct={false}` i `app/(app)/week/page.tsx:633`, `app/(app)/week/page.tsx:666` og `app/(app)/week/page.tsx:702`; normal ansattflate sender `canAct={hold.canAct}` og `billingHoldReason={hold.reason}` i `app/(app)/week/page.tsx:721`.

### 2.3 State i `EmployeeWeekClient`

Det finnes ingen `useReducer` i `EmployeeWeekClient`.

- `days`: `DayRow[]`, primær modell for synlige dager. Initieres fra preview eller tomt i `app/(app)/week/EmployeeWeekClient.tsx:934`, settes fra `/api/order/window` i `app/(app)/week/EmployeeWeekClient.tsx:1106-1118`, rendres som valgt dag og kommende dager i `app/(app)/week/EmployeeWeekClient.tsx:1536-1693`.
- `agreementMessage`: melding fra API-vinduets `agreement.message`, satt i `app/(app)/week/EmployeeWeekClient.tsx:1118`, vist når bestilling er blokkert i `app/(app)/week/EmployeeWeekClient.tsx:1499-1504`.
- `companyName`: firmanavn fra API-vindu, satt i `app/(app)/week/EmployeeWeekClient.tsx:1119`, vist i header i `app/(app)/week/EmployeeWeekClient.tsx:1580`.
- `loadError`: lastfeil for ordre-vindu, satt i `app/(app)/week/EmployeeWeekClient.tsx:1090-1092` og `app/(app)/week/EmployeeWeekClient.tsx:1134-1136`, rendres i `app/(app)/week/EmployeeWeekClient.tsx:1487-1492`.
- `forbidden`: 403-state fra ordre-vindu, satt i `app/(app)/week/EmployeeWeekClient.tsx:1071-1085`, rendres i `app/(app)/week/EmployeeWeekClient.tsx:1466-1484`.
- `loading`: styrer skeleton og initial fetch. Settes i `app/(app)/week/EmployeeWeekClient.tsx:939`, `app/(app)/week/EmployeeWeekClient.tsx:1059-1064` og `app/(app)/week/EmployeeWeekClient.tsx:1146-1148`; skeleton rendres i `app/(app)/week/EmployeeWeekClient.tsx:1458-1463`.
- `busyDate`: markerer dato under submit. Settes i `app/(app)/week/EmployeeWeekClient.tsx:1421-1428`, brukes som `busyThis` i dagkort og sticky CTA i `app/(app)/week/EmployeeWeekClient.tsx:1643-1657` og `app/(app)/week/EmployeeWeekClient.tsx:1704-1712`.
- `errorBanner`: midlertidig feilbanner. Settes i `showErrorBanner()` i `app/(app)/week/EmployeeWeekClient.tsx:1344-1355`, rendres i `app/(app)/week/EmployeeWeekClient.tsx:1610-1615`.
- `toastSuccess`: suksess-toast. Settes i `showSuccessToast()` i `app/(app)/week/EmployeeWeekClient.tsx:1335-1342`, rendres fixed i `app/(app)/week/EmployeeWeekClient.tsx:1560-1567`.
- `confirm`: bekreftelsesmodal payload `{ date, action }`, definert i `app/(app)/week/EmployeeWeekClient.tsx:72`, settes i `requestOrder()` og `requestCancel()` i `app/(app)/week/EmployeeWeekClient.tsx:1433-1451`, rendres i `WeekConfirmModal` i `app/(app)/week/EmployeeWeekClient.tsx:1548-1558`.
- `confirmSubmitting`: spinner/disable-state i modal, settes i `app/(app)/week/EmployeeWeekClient.tsx:1421-1428`, sendes til modal i `app/(app)/week/EmployeeWeekClient.tsx:1555-1557`.
- `selectedDate`: aktiv dag i mobil-/listevisning. Settes ved default/pattern i `app/(app)/week/EmployeeWeekClient.tsx:1183-1191`, ved tap i `app/(app)/week/EmployeeWeekClient.tsx:1329-1333`, brukes til `activeDay` i `app/(app)/week/EmployeeWeekClient.tsx:1536-1538`.
- `contentVisible`: opacity fade-in etter lasting, settes i `app/(app)/week/EmployeeWeekClient.tsx:1302-1312`, brukes i wrapper-klassen i `app/(app)/week/EmployeeWeekClient.tsx:1541-1547`.
- `stickyBarHidden`: skjuler/viser mobil sticky CTA ved scroll. Settes i `app/(app)/week/EmployeeWeekClient.tsx:1284-1300`, brukes i fixed bottom bar i `app/(app)/week/EmployeeWeekClient.tsx:1695-1700`.
- `demandHintLine`: informasjonslinje fra `/api/order/week-demand-hints`, settes i `app/(app)/week/EmployeeWeekClient.tsx:1023-1036`, rendres i `app/(app)/week/EmployeeWeekClient.tsx:1604`.
- `serverOsloDate`: serverens Oslo-dato fra API-vindu, settes i `app/(app)/week/EmployeeWeekClient.tsx:1121-1122`, brukes til dagens nudge og fallback `todayDay` i `app/(app)/week/EmployeeWeekClient.tsx:988-990` og `app/(app)/week/EmployeeWeekClient.tsx:1536`.
- `weekOrderingAllowed`: serverfasit for om ukehandlinger er tillatt, settes i `app/(app)/week/EmployeeWeekClient.tsx:1123`, inngår i `blocked` i `app/(app)/week/EmployeeWeekClient.tsx:1453`.
- `todayCutoffStatus`: serverens cutoff-status, settes i `app/(app)/week/EmployeeWeekClient.tsx:1124-1127`, rendres som hint i `app/(app)/week/EmployeeWeekClient.tsx:1605-1609`.
- `orderingUrgencyHint`: 07:xx-hint fra API-vindu, settes i `app/(app)/week/EmployeeWeekClient.tsx:1128`, rendres i `app/(app)/week/EmployeeWeekClient.tsx:1605-1607`.
- `menuSanityFetchFailed`: skiller Sanity-feil fra tom meny, settes i `app/(app)/week/EmployeeWeekClient.tsx:1129`, rendres i `app/(app)/week/EmployeeWeekClient.tsx:1589-1597`.
- `patternTick`: trigger for å lese lokale ordremønstre på nytt. Settes i `app/(app)/week/EmployeeWeekClient.tsx:975-979` og bumpes etter suksessbestilling i `app/(app)/week/EmployeeWeekClient.tsx:1399-1403`.
- Ref-basert lokal state: abort/controller/timere/inflight/prefetch/IO/scroll ligger i `app/(app)/week/EmployeeWeekClient.tsx:958-974`. De styrer abort av vindusfetch, timers for toast/error/fallback, duplikatbeskyttelse per dato, prefetch-gating, valgt dato og sticky-scrolllogikk.

### 2.4 Interaksjoner

- Initial last: `useEffect` kaller `loadWindow()` i `app/(app)/week/EmployeeWeekClient.tsx:1151-1155`. `loadWindow()` gjør `GET /api/order/window?weeks=1` i `app/(app)/week/EmployeeWeekClient.tsx:1052-1068`, mapper `payload.days` til `DayRow[]` i `app/(app)/week/EmployeeWeekClient.tsx:1106-1118`, og setter servermetadata i `app/(app)/week/EmployeeWeekClient.tsx:1121-1129`.
- Refresh ved "Prøv igjen": tomt vindu rendrer knapp som kaller `loadWindow()` i `app/(app)/week/EmployeeWeekClient.tsx:1510-1524`.
- Demand hint: etter vellykket last kalles `GET /api/order/week-demand-hints` i `app/(app)/week/EmployeeWeekClient.tsx:1023-1036`. API-en krever employee/company_admin i `app/api/order/week-demand-hints/route.ts:27-35`, leser `orders(date,status,created_at,updated_at)` scoped til company/location i `app/api/order/week-demand-hints/route.ts:45-56`, og returnerer hint i `app/api/order/week-demand-hints/route.ts:90-103`.
- Velg dag: `selectDayFromTap(date)` setter `navSourceRef`, vibrerer og setter `selectedDate` i `app/(app)/week/EmployeeWeekClient.tsx:1329-1333`. Kalles fra dagtabs i `app/(app)/week/EmployeeWeekClient.tsx:1623-1627`, aktivt dagkort i `app/(app)/week/EmployeeWeekClient.tsx:671-684`, og kommende-dager-listen i `app/(app)/week/EmployeeWeekClient.tsx:1667-1673`. Ingen API-kall gjøres ved rent dagvalg.
- Bestill: dagkort/sticky CTA kaller `requestOrder(date)` i `app/(app)/week/EmployeeWeekClient.tsx:1433-1441`, som bare åpner confirm-modal. Knappene ligger i desktopkort `app/(app)/week/EmployeeWeekClient.tsx:606-624`, mobilkort `app/(app)/week/EmployeeWeekClient.tsx:794-812`, og sticky CTA `app/(app)/week/EmployeeWeekClient.tsx:903-921`.
- Avbestill: dagkort/sticky CTA kaller `requestCancel(date)` i `app/(app)/week/EmployeeWeekClient.tsx:1443-1451`, som bare åpner confirm-modal. Knappene ligger i desktopkort `app/(app)/week/EmployeeWeekClient.tsx:585-603`, mobilkort `app/(app)/week/EmployeeWeekClient.tsx:773-792`, og sticky CTA `app/(app)/week/EmployeeWeekClient.tsx:878-899`.
- Bekreft submit: modalens `onConfirm` kaller `handleConfirmSubmit()` i `app/(app)/week/EmployeeWeekClient.tsx:1548-1557`. Handleren setter `confirmSubmitting` og `busyDate`, kjører `guardedAction()` mot dato, kaller `postSetDayInner(date, action === "order")`, og rydder busy-state i `app/(app)/week/EmployeeWeekClient.tsx:1415-1431`.
- Write endpoint: `postSetDayInner()` sender `POST /api/order/set-day` med `{ date, wants_lunch }`, `Content-Type` og `x-rid` i `app/(app)/week/EmployeeWeekClient.tsx:1357-1373`. Endpointet parser body i `app/api/order/set-day/route.ts:169-179`.
- Optimistisk UI: UI gjør ikke optimistisk statusendring av `days`; den setter bare busy/modal state i `app/(app)/week/EmployeeWeekClient.tsx:1421-1428`. Etter vellykket write re-fetches vinduet med `loadWindow({ silent: true })` i `app/(app)/week/EmployeeWeekClient.tsx:1389-1393`, og fallback-refresh kjøres etter 1500 ms i `app/(app)/week/EmployeeWeekClient.tsx:1394-1398`.
- Feilhåndtering client: ugyldig API-svar leses med `readApiError()` i `app/(app)/week/EmployeeWeekClient.tsx:85-99`; cutoff-koder normaliseres i `app/(app)/week/EmployeeWeekClient.tsx:102-106`; feil vises med `showErrorBanner()` i `app/(app)/week/EmployeeWeekClient.tsx:1344-1355` og brukes i `postSetDayInner()` i `app/(app)/week/EmployeeWeekClient.tsx:1384-1387` og `app/(app)/week/EmployeeWeekClient.tsx:1407-1409`.

### 2.5 Eksisterende meny-data

- `EmployeeWeekClient` forventer menyfeltene `menuTitle`, `menuDescription`, `allergens` og `menuImages` i `DayRow` i `app/(app)/week/EmployeeWeekClient.tsx:45-49`. Mapping fra API-payload skjer i `app/(app)/week/EmployeeWeekClient.tsx:154-161`.
- Desktop viser bilder, tittel, beskrivelse og allergener i `app/(app)/week/EmployeeWeekClient.tsx:541-565`.
- Mobil viser bilder og kategoriliste fra `getTierCategories(day)` i `app/(app)/week/EmployeeWeekClient.tsx:719-752`. Mobilkortet viser ikke `menuDescription` eller `allergens` i den viste grenen; de brukes i desktopkortet.
- Kategorier i dagens `/week` er ikke `menuDay.category`. De kommer fra `allowedChoices` hvis labels er lesbare, ellers fallback-arrays `BASIS_CATEGORY_LABELS` og `LUXUS_CATEGORY_LABELS`, se `app/(app)/week/EmployeeWeekClient.tsx:198-199` og `app/(app)/week/EmployeeWeekClient.tsx:259-279`.
- API-vinduet henter ikke `menuDay` for ansattflaten. Det henter CMS `menu`-dokumenter per `mealType` via `getMenusByMealTypesWithFetchStatus()` i `app/api/order/window/route.ts:708-724`. Denne helperen spør Sanity `_type == "menu"` med feltene `mealType,title,description,allergens,nutrition,variants,imageUrls,legacyImageUrl` i `lib/cms/getMenusByMealTypes.ts:15-33`.
- API-vinduet velger `headerMenu` via `resolveMenuForDay()` og setter `menuTitle`, `menuDescription`, `allergens`, `menuImages` i dagmodellen i `app/api/order/window/route.ts:586-621`.
- `getMenuForDateAndPlan()` finnes i `lib/cms/menuDay.ts:207-225`, men brukes ikke i `app/(app)/week/`. `rg` fant bare `getMenuForDates` i `app/(app)/week/page.tsx:20` og `app/(app)/week/page.tsx:481`.

## Seksjon 3: UI-struktur

### 3.1 Layout-hierarki

```text
EmployeeWeekPage (server)
├── auth/cookie/profile/company gates
├── WeekBrandMark + H1 intro (normal employee)
└── EmployeeWeekClient
    ├── WeekConfirmModal
    ├── ToastSuccess (fixed)
    ├── Header logo/company/title
    ├── Status/hint area
    │   ├── menuSanityFetchFailed warning
    │   ├── streak/habit/demand hints
    │   └── errorBanner
    ├── Day tabs nav (5 buttons)
    ├── ActiveDay section
    │   └── WeekDayCardMobile
    │       ├── tier/status badges
    │       ├── selected day title
    │       ├── image/category list
    │       └── order/cancel button
    ├── UpcomingDays section
    │   └── button per remaining day
    └── Sticky mobile CTA (fixed bottom)
```

Desktop-only helper `WeekDayRowDesktop` finnes i `app/(app)/week/EmployeeWeekClient.tsx:490-630`, men i den synlige return-grenen fra `app/(app)/week/EmployeeWeekClient.tsx:1540-1718` rendres `WeekDayRowDesktop` ikke. UKLART om dette er bevisst historikk eller en ubrukt desktopgren.

Superadmin-preview har separat tre: `renderSuperadminWeekPreview()` -> `SuperadminWeekPreviewCard` -> `SuperadminDayPreview` -> `SuperadminCategoryGroup` -> `SuperadminCategoryLine`, se `app/(app)/week/page.tsx:327-407` og `app/(app)/week/page.tsx:462-567`.

### 3.2 CSS-klasser brukt i `EmployeeWeekClient.tsx`

- `ds-*`: Ingen `ds-*`-klasser finnes i `EmployeeWeekClient.tsx`; søk i JSX viser Tailwind-klasser og ingen `ds-`-prefiks.
- `lp-*`: Ingen `lp-*`-klasser brukes inne i `EmployeeWeekClient.tsx`. `/week/page.tsx` bruker `lp-h1` i fallback-greiner i `app/(app)/week/page.tsx:608`, `app/(app)/week/page.tsx:644` og `app/(app)/week/page.tsx:680`.
- Lokale CSS-klasser i samme fil: Ingen class selectors definert i lokal CSS. Lokale class-string-konstanter er `BTN_TOUCH`, `CARD_TRANSFORM`, `PRIMARY_CTA` og `SECONDARY_CTA` i `app/(app)/week/EmployeeWeekClient.tsx:192-202`.
- Tailwind utility-klasser i modal/skeleton/hints: `fixed`, `inset-0`, `z-[60]`, `flex`, `items-end`, `justify-center`, `bg-black/40`, `p-4`, `sm:items-center`, `w-full`, `max-w-sm`, `rounded-2xl`, `bg-white`, `shadow-xl`, `ring-1`, `min-h-[48px]`, `flex-1`, `disabled:opacity-50`, `animate-pulse`, `md:text-left`, se `app/(app)/week/EmployeeWeekClient.tsx:386-472`.
- Tailwind utility-klasser i desktop day row: `rounded-2xl`, `border`, `border-black/10`, `bg-white/90`, `p-4`, `text-center`, `shadow-sm`, `md:text-left`, `flex-col`, `md:flex-row`, `inline-flex`, `rounded-full`, `ring-1`, `h-24`, `max-w-full`, `object-cover`, `whitespace-pre-wrap`, `sm:flex-row`, `md:justify-start`, `min-h-[54px]`, se `app/(app)/week/EmployeeWeekClient.tsx:510-624`.
- Tailwind utility-klasser i mobil day card: `rounded-[2rem]`, `bg-white/85`, `p-5`, `text-center`, `shadow-[0_18px_60px_rgba(24,20,16,0.08)]`, `active:bg-white`, `cursor-pointer`, `rounded-[1.5rem]`, `focus-visible:ring-2`, `text-2xl`, `tracking-[-0.03em]`, `h-20`, `space-y-2`, `min-h-[48px]`, `h-8`, `w-8`, `min-w-0`, se `app/(app)/week/EmployeeWeekClient.tsx:661-815`.
- Tailwind utility-klasser i hovedreturn: `mx-auto`, `w-full`, `px-4`, `py-6`, `min-h-dvh`, `max-w-lg`, `md:max-w-2xl`, `pb-32`, `opacity-0/100`, `fixed bottom-24`, `left-4 right-4`, `z-50`, `max-w-md`, `md:top-24`, `grid grid-cols-5 gap-2`, `min-w-0`, `truncate`, `space-y-2`, `pointer-events-none`, `fixed bottom-0`, `backdrop-blur-sm`, se `app/(app)/week/EmployeeWeekClient.tsx:1540-1715`.
- Dynamiske statusklasser: `badgeClassForStatus()` returnerer `bg-emerald-50`, `text-emerald-900`, `ring-emerald-200`, `bg-amber-50`, `text-amber-950`, `bg-neutral-100`, `text-neutral-700`, `bg-stone-100`, `bg-[#fff7dc]`, se `app/(app)/week/EmployeeWeekClient.tsx:216-221`.
- Dynamiske action-klasser: primær CTA er gul gradient i `PRIMARY_CTA` i `app/(app)/week/EmployeeWeekClient.tsx:200-201`; sekundær CTA er hvit/border i `app/(app)/week/EmployeeWeekClient.tsx:202`.

### 3.3 Mobile-first eller desktop-first?

- Selve `EmployeeWeekClient` er i praksis mobile-first i JSX: base-klasser er mobil, og desktopjusteringer bruker `sm:`/`md:` min-width-varianter, f.eks. `md:text-left`, `sm:flex-row`, `md:max-w-2xl` i `app/(app)/week/EmployeeWeekClient.tsx:388-397`, `app/(app)/week/EmployeeWeekClient.tsx:568-624` og `app/(app)/week/EmployeeWeekClient.tsx:1540-1546`.
- Den bruker også eksplisitt JS media query `useMediaQuery("(max-width: 768px)")` i `app/(app)/week/EmployeeWeekClient.tsx:932`. Dette er desktop/mobile branching via max-width, ikke ren CSS mobile-first.
- Global CSS har gamle `.lp-week*` selectors i `app/globals.css:2484-2521`, men `EmployeeWeekClient.tsx` bruker ikke `lp-weekTitle`, `lp-weekSub`, `lp-weekDate` eller `lp-weekRow`.
- Global mobile-hardening er desktop-down med `@media (max-width: 640px)` i `app/globals.css:3620-3666` og `@media (max-width: 767px)` i `app/globals.css:3965-3981`. Det påvirker generelle `lp-*` klasser mer enn den Tailwind-baserte klienten.

### 3.4 Eksisterende mobil-mønstre

- Dagvalg er en 5-kolonne tab-bar med `grid grid-cols-5 gap-2` i `app/(app)/week/EmployeeWeekClient.tsx:1618-1639`.
- Aktiv dag vises som eget stort mobilkort i `app/(app)/week/EmployeeWeekClient.tsx:1641-1658`, og andre dager som kompakte knapper i `app/(app)/week/EmployeeWeekClient.tsx:1661-1693`.
- Sticky bottom CTA finnes for valgt dag i `app/(app)/week/EmployeeWeekClient.tsx:1695-1715`, med safe-area padding i `app/(app)/week/EmployeeWeekClient.tsx:1700`.
- Sticky CTA skjules ved scroll ned og vises ved scroll opp i `app/(app)/week/EmployeeWeekClient.tsx:1284-1300`.
- Det finnes kode for horisontal snap/IntersectionObserver i `app/(app)/week/EmployeeWeekClient.tsx:1206-1263`, men `carouselRef` er bare deklarert og lest i `app/(app)/week/EmployeeWeekClient.tsx:966`, `app/(app)/week/EmployeeWeekClient.tsx:1211` og `app/(app)/week/EmployeeWeekClient.tsx:1230`. Søk fant ingen `ref={carouselRef}` i JSX. UKLART: snap-logikken ser derfor inert ut på dagens branch.
- Haptisk feedback forsøkes med `navigator.vibrate()` i `app/(app)/week/EmployeeWeekClient.tsx:24-31`, brukt ved IO-valg, tap og submit i `app/(app)/week/EmployeeWeekClient.tsx:1248`, `app/(app)/week/EmployeeWeekClient.tsx:1331`, `app/(app)/week/EmployeeWeekClient.tsx:1418` og `app/(app)/week/EmployeeWeekClient.tsx:1404`.

## Seksjon 4: Bedriftens plan og kategori-bevissthet

### 4.1 Hvor leses bedriftens tier i `/week` i dag?

- Søk etter `agreement.tier|planTier|company_current_agreement` i `app/(app)/week/` ga ingen treff.
- `EmployeeWeekClient` leser `tier` fra API-payloadens dagrad i `mapDay()` i `app/(app)/week/EmployeeWeekClient.tsx:143-147`, ikke direkte fra agreement i `/week`.
- Selve tier-kilden for `/week` er indirekte: `/api/order/window` henter current agreement state i `app/api/order/window/route.ts:338-452`, der `dayTiers = (state.dayTiers ?? {})` settes i `app/api/order/window/route.ts:404-407`.
- `getCurrentAgreementState()` henter aktiv `agreements`-rad med `id,company_id,status,delivery_days,tier,price_per_meal_nok,starts_at,ends_at,updated_at` i `lib/agreement/currentAgreement.ts:183-193`, bygger `dayTiers` fra `agreements.delivery_days` og `agreements.tier` i `lib/agreement/currentAgreement.ts:101-123`, og returnerer `planTier`/`dayTiers` i `lib/agreement/currentAgreement.ts:268-285`.
- `loadAgreementForChoices()` i `/api/order/window` leser `company_current_agreement` for valgdata i `app/api/order/window/route.ts:454-468`.

### 4.2 Brukes tier til noe i `/week`-UI-en i dag?

- Ja, tier endrer antall valg og label: `tierChoiceLimit()` gir 3 for `BASIS`, 6 for `LUXUS` og `ENTERPRISE` i `app/(app)/week/EmployeeWeekClient.tsx:245-249`; `tierLabel()` viser `Basis/Luxus/Enterprise - N valg` i `app/(app)/week/EmployeeWeekClient.tsx:251-257`.
- Ja, tier endrer fallback-kategorier: `fallbackCategoryLabels()` gir 3 Basis-labels eller 6 Luxus/Enterprise-labels i `app/(app)/week/EmployeeWeekClient.tsx:259-263`.
- Ja, tier påvirker hvilke choices som vises i UI via `getTierCategories()` i `app/(app)/week/EmployeeWeekClient.tsx:273-279` og rendres i `DayMenuSummary()` i `app/(app)/week/EmployeeWeekClient.tsx:344-383` og mobilkortet i `app/(app)/week/EmployeeWeekClient.tsx:657-658` og `app/(app)/week/EmployeeWeekClient.tsx:733-746`.
- Nei, `/week` filtrerer ikke `menuDay`-dokumenter per `planTier/category` i dag. Den viser avtale-/CMS-menuType-valg fra API-vinduet, ikke `menuDay`-kategorirader.

### 4.3 `getMenuForDateAndPlan`

- `getMenuForDateAndPlan(date, planTier)` er definert i `lib/cms/menuDay.ts:207-225`.
- Den brukes ikke i `app/(app)/week/` i dag. Søk fant ingen treff i week-folderen.
- Menydata for ansattflaten hentes via `/api/order/window` -> `getMenusByMealTypesWithFetchStatus()` i `app/api/order/window/route.ts:708-724`, som igjen henter `_type == "menu"` i `lib/cms/getMenusByMealTypes.ts:15-33`.
- Superadmin-preview på `/week?preview=...` bruker `getMenuForDates()` i `app/(app)/week/page.tsx:480-488`, ikke `getMenuForDateAndPlan()`.

## Seksjon 5: Bestillings-flyt

### 5.1 Hvordan registreres bestilling i dag?

1. Bruker trykker "Bestill lunsj" i mobilkort, desktop helper eller sticky CTA; knappene kaller `requestOrder(activeDay.date)` i `app/(app)/week/EmployeeWeekClient.tsx:1651-1653` og sticky CTA kaller `requestOrder(selectedDay.date)` i `app/(app)/week/EmployeeWeekClient.tsx:1704-1712`.
2. `requestOrder()` nuller error timer og setter `confirm={ date, action: "order" }` i `app/(app)/week/EmployeeWeekClient.tsx:1433-1441`.
3. `WeekConfirmModal` rendres når `confirm` finnes i `app/(app)/week/EmployeeWeekClient.tsx:1548-1558`.
4. Bekreftelse kaller `handleConfirmSubmit()` i `app/(app)/week/EmployeeWeekClient.tsx:1555`.
5. `handleConfirmSubmit()` kjører `guardedAction(date, ...)`, setter `confirmSubmitting` og `busyDate`, og kaller `postSetDayInner(date, true)` for bestilling i `app/(app)/week/EmployeeWeekClient.tsx:1415-1431`.
6. `postSetDayInner()` sender `POST /api/order/set-day` med `{ date, wants_lunch: true }` i `app/(app)/week/EmployeeWeekClient.tsx:1357-1373`.
7. `app/api/order/set-day/route.ts` validerer datoformat i `app/api/order/set-day/route.ts:180-182`, autentisert bruker i `app/api/order/set-day/route.ts:184-185`, cutoff 08:00 i `app/api/order/set-day/route.ts:187-195`, og Man-Fre i `app/api/order/set-day/route.ts:197-202`.
8. Endpointet henter profil `id, company_id, location_id, role` fra `profiles` i `app/api/order/set-day/route.ts:206-217`, og blokkerer roller utenom `employee`/`company_admin` i `app/api/order/set-day/route.ts:52-54` og `app/api/order/set-day/route.ts:219-221`.
9. Endpointet kjører firmaskrive-gate via `assertCompanyOrderWriteAllowed()` i `app/api/order/set-day/route.ts:226-229`. Den leser `companies(billing_hold,billing_hold_reason,status)` i `lib/orders/companyOrderEligibility.ts:15-70`.
10. Endpointet kjører avtale-/dag-/closed-date-preflight via `assertOrderWithinAgreementPreflight()` i `app/api/order/set-day/route.ts:231-242`. Den sjekker weekday, operative closed dates og `requireRule()` i `lib/orders/orderWriteGuard.ts:173-242`.
11. `requireRule()` henter aktiv `company_current_agreement` i `lib/agreement/requireRule.ts:59-78`, sjekker `delivery_days` i `lib/agreement/requireRule.ts:80-96`, og henter aktiv regel fra `company_current_agreement_rules` i `lib/agreement/requireRule.ts:98-170`.
12. Endpointet henter legacy contract choices fra `companies(contract_week_tier, contract_basis_choices, contract_premium_choices)` i `app/api/order/set-day/route.ts:244-269`, velger/faller tilbake til choice key i `app/api/order/set-day/route.ts:270-280`, og krever variant-note for salatbar/paasmurt i `app/api/order/set-day/route.ts:282-290`.
13. Hvis aktiv ordre allerede finnes i `orders` for samme user/company/location/date/slot, returneres eksisterende ordre som ok i `app/api/order/set-day/route.ts:295-319`.
14. Ellers kalles `lpOrderSet()` for bestilling eller `lpOrderCancel()` for avbestilling i `app/api/order/set-day/route.ts:322-324`. Wrapperen kaller RPC `lp_order_set` i `lib/orders/rpcWrite.ts:84-102` og `lib/orders/rpcWrite.ts:125-140`.
15. Etter RPC leses `orders(id,date,status,updated_at,created_at)` fra `orders` i `app/api/order/set-day/route.ts:331-343`.
16. Ved bestilling upsertes `day_choices(company_id,location_id,user_id,date,choice_key,note,status)` i `app/api/order/set-day/route.ts:345-360`.
17. Outbox fanout kjøres best effort i `app/api/order/set-day/route.ts:380-384`, og success returnerer `orderId,status,date,timestamp` i `app/api/order/set-day/route.ts:386-391`.

### 5.2 Hvordan reflekteres bestillingen i UI?

- Ingen optimistisk endring av `days`: UI setter bare `busyDate`/`confirmSubmitting` i `app/(app)/week/EmployeeWeekClient.tsx:1421-1428`.
- Etter vellykket `POST`, kaller klienten `loadWindow({ silent: true })` i `app/(app)/week/EmployeeWeekClient.tsx:1389-1393`, som henter `/api/order/window` på nytt og erstatter `days` i `app/(app)/week/EmployeeWeekClient.tsx:1117`.
- Klienten legger også inn fallback-refresh etter 1500 ms i `app/(app)/week/EmployeeWeekClient.tsx:1394-1398`.
- Ved bestilling lagres lokalt mønster med `recordSuccessfulOrder()` og `patternTick` bumpes i `app/(app)/week/EmployeeWeekClient.tsx:1399-1403`.
- Suksess vises som toast "Bestilling registrert ✔" eller "Avbestilling registrert ✔" i `app/(app)/week/EmployeeWeekClient.tsx:1404-1406`, rendret i `app/(app)/week/EmployeeWeekClient.tsx:1560-1567`.

### 5.3 Endringer/avbestilling

- Ansatt kan bestille og avbestille samme dag før cutoff hvis `canAct`, `day.isEnabled`, ikke `day.isLocked`, og ingen global busy-state. Dette er samlet i `canOrderDay()` i `app/(app)/week/EmployeeWeekClient.tsx:293-295`.
- Avbestilling går gjennom samme modal og samme endpoint, men `requestCancel()` setter `action: "cancel"` i `app/(app)/week/EmployeeWeekClient.tsx:1443-1451`, og `postSetDayInner(date, false)` sender `wants_lunch: false` i `app/(app)/week/EmployeeWeekClient.tsx:1424`.
- Serveren bruker samme `/api/order/set-day` og kaller `lpOrderCancel()` når `wantsLunch` er false i `app/api/order/set-day/route.ts:322-324`.
- Etter cutoff låses UI med `lockReason === "CUTOFF"` og viser disabled knapp i desktop/mobil/sticky CTA i `app/(app)/week/EmployeeWeekClient.tsx:571-580`, `app/(app)/week/EmployeeWeekClient.tsx:759-768` og `app/(app)/week/EmployeeWeekClient.tsx:861-872`.
- Read-only underflater for endringer/historikk finnes i `mine-lunsjendringer`, `tidligere-lunsjdager`, `mine-registrerte-dager`, `bestillingsprofil` og `ordre/[date]`, men de skriver ikke. Se formålskommentarer i `app/(app)/week/mine-lunsjendringer/page.tsx:1`, `app/(app)/week/tidligere-lunsjdager/page.tsx:1`, `app/(app)/week/mine-registrerte-dager/page.tsx:1`, `app/(app)/week/bestillingsprofil/page.tsx:1` og `app/(app)/week/ordre/[date]/page.tsx:1`.

## Seksjon 6: Avhengigheter mellom `/week` og resten av appen

### 6.1 Navigation

- Canonical app shell kan lenke til `/week` via `HeaderShell`, som henter CMS header og rollevariant i `src/components/nav/HeaderShell.tsx:16-55`. Navigation normaliseres fra CMS i `lib/layout/globalHeaderFromCms.ts:35-48`, og rollevariant for employee er `employee` i `lib/layout/globalHeaderFromCms.ts:11-18`.
- `components/app/AppShell.tsx` har hardkodet nav-item `{ href: "/week", label: "Ukesplan" }` i `components/app/AppShell.tsx:25-35`. UKLART om denne klient-shell fortsatt brukes for `/week`, siden `app/(app)/layout.tsx` bruker `HeaderShell`.
- `/home` lenker flere steder til `/week`: `app/(app)/home/page.tsx:171`, `app/(app)/home/page.tsx:214`, `app/(app)/home/page.tsx:223` og `app/(app)/home/page.tsx:279`.
- Adminflater lenker til `/week`, f.eks. `app/admin/page.tsx:377` og `app/admin/page.tsx:482`, `app/admin/dagens-brukere/page.tsx:165`, `app/admin/dagens-levering/page.tsx:243`, `app/admin/uke-bestillbarhet/page.tsx:186`.
- `/week`-subflater lenker tilbake til hovedflaten og hverandre, f.eks. `app/(app)/week/min-dag/page.tsx:191-209`, `app/(app)/week/mine-lunsjendringer/page.tsx:91-113`, `app/(app)/week/tidligere-lunsjdager/page.tsx:101-123`, `app/(app)/week/mine-registrerte-dager/page.tsx:199-217`, `app/(app)/week/bestillingsprofil/page.tsx:127-145`, `app/(app)/week/ordre/[date]/page.tsx:146-167`.
- Invite-flow router erstatter til `/week` etter accept invite i `app/(auth)/accept-invite/AcceptInviteClient.tsx:155`.

### 6.2 Auth-guards

- Middleware definerer `/week` som protected path i `middleware.ts:31-41`. Hvis ingen Supabase session cookie eller lokal dev-bypass finnes, redirectes til `/login?next=<path>` i `middleware.ts:113-133`.
- Middleware bypasser `/api/*` bortsett fra auth API-er i `middleware.ts:11-28`, så `/api/order/window` og `/api/order/set-day` må gjøre egne guards.
- `/week/page.tsx` gjør egen cookie/auth-check og redirecter til `/login?next=/week` i `app/(app)/week/page.tsx:577-588`.
- `/week/page.tsx` tillater `superadmin` å se preview i `app/(app)/week/page.tsx:595-597`, men normal employee/company_admin krever aktiv avtale via `requireActiveAgreement()` i `app/(app)/week/page.tsx:599`.
- `/api/order/window` bruker `scopeOr401()` i `app/api/order/window/route.ts:642-644`, og tillater bare `employee` og `company_admin` i `app/api/order/window/route.ts:649-652`.
- `/api/order/set-day` tillater bare `employee` og `company_admin` via `isOrderWriteRoleAllowed()` i `app/api/order/set-day/route.ts:52-54` og sjekk i `app/api/order/set-day/route.ts:219-221`.
- `(app)`-layout håndhever at `employee` bare kan være på tillatte appflater via `enforceEmployeeWeekOnlyOnAppShell()` i `app/(app)/layout.tsx:7-10`. Tillatte employee-flater er `/week`, `/week/*`, `/meny`, `/meny/*` i `lib/auth/employeeAppSurfacePath.ts:5-8`.

### 6.3 Layout-arv

- Root layout: `app/layout.tsx` importerer globale CSS-filer og setter viewport `width=device-width`, `initialScale=1`, `viewportFit=cover` i `app/layout.tsx:1-5` og `app/layout.tsx:61-65`. Den wrapper alt i `<html lang="no">` og `<body>` i `app/layout.tsx:70-79`.
- App group layout: `app/(app)/layout.tsx` er nærmeste layout for `/week`; den kjører `enforceEmployeeWeekOnlyOnAppShell()` i `app/(app)/layout.tsx:9-10`, rendrer `HeaderShell` i `app/(app)/layout.tsx:13-18`, og `AppFooter` i `app/(app)/layout.tsx:20`.
- Header shell: `src/components/nav/HeaderShell.tsx` henter global header/CMS og scope-rolle i `src/components/nav/HeaderShell.tsx:16-38`, og setter grid-klasser `grid-cols-[1fr_auto_1fr]` i `src/components/nav/HeaderShell.tsx:44-46`.
- Header view: `src/components/nav/HeaderShellView.tsx` rendrer logo/link, desktop nav og e-post/logout i `src/components/nav/HeaderShellView.tsx:25-68`.

## Seksjon 7: Eksisterende mobil-optimalisering

### 7.1 Viewport-strategi

- Global viewport er satt i `app/layout.tsx:61-65`.
- `EmployeeWeekClient` bruker `useMediaQuery("(max-width: 768px)")` i `app/(app)/week/EmployeeWeekClient.tsx:932`.
- Tailwind-breakpoints brukt i klienten inkluderer `sm:` og `md:` i store deler av JSX, f.eks. modal `sm:items-center` i `app/(app)/week/EmployeeWeekClient.tsx:436`, skeleton `md:text-left` i `app/(app)/week/EmployeeWeekClient.tsx:392`, wrapper `md:max-w-2xl` i `app/(app)/week/EmployeeWeekClient.tsx:1545`, og toast `md:bottom-auto md:top-24` i `app/(app)/week/EmployeeWeekClient.tsx:1562`.
- Global CSS har mobile hardening ved `max-width: 640px` i `app/globals.css:3620-3666`, og utility `.lp-mobile-center` ved `max-width: 767px` i `app/globals.css:3965-3981`.

### 7.2 Touch-targets

- Confirm modal-knapper har `min-h-[48px]` i `app/(app)/week/EmployeeWeekClient.tsx:445-459`.
- Bestill/avbestill-knapper i dagkort og sticky CTA har `min-h-[54px]` i `app/(app)/week/EmployeeWeekClient.tsx:592`, `app/(app)/week/EmployeeWeekClient.tsx:613`, `app/(app)/week/EmployeeWeekClient.tsx:780`, `app/(app)/week/EmployeeWeekClient.tsx:801`, `app/(app)/week/EmployeeWeekClient.tsx:887` og `app/(app)/week/EmployeeWeekClient.tsx:910`.
- Disabled cutoff-knapper har `min-h-[48px]` i `app/(app)/week/EmployeeWeekClient.tsx:576`, `app/(app)/week/EmployeeWeekClient.tsx:764` og `app/(app)/week/EmployeeWeekClient.tsx:867`.
- Kategorirader i mobilkort har `min-h-[48px]` i `app/(app)/week/EmployeeWeekClient.tsx:738`.
- Kommende-dager-knapper har `min-h-[58px]` i `app/(app)/week/EmployeeWeekClient.tsx:1667-1674`.
- Svakhet: dagtab-knappene i 5-kolonne nav har `px-2 py-3`, men ingen eksplisitt `min-h` eller `min-w` i `app/(app)/week/EmployeeWeekClient.tsx:1618-1637`. På 360 px viewport gir 5 kolonner med gaps ca. 64 px bredde per knapp, men høyden er avhengig av tekstlinjer/padding, ikke låst.

### 7.3 Performance

- Første render for normal ansatt sender ikke dager fra server; klienten laster skeleton og gjør ett `GET /api/order/window?weeks=1` etter mount i `app/(app)/week/EmployeeWeekClient.tsx:1052-1068` og `app/(app)/week/EmployeeWeekClient.tsx:1151-1155`.
- API-vinduet returnerer inntil 5 dager for `weeks=1`, eller inntil 10 for `weeks=2` når neste uke er åpen, se dato-logikk i `app/api/order/window/route.ts:685-703`.
- API-vinduet gjør parallelle kall for company `agreement_json`, Basis productPlan og Luxus productPlan i `app/api/order/window/route.ts:708-714`, henter CMS-menyer for meal keys i `app/api/order/window/route.ts:715-724`, henter orders i `app/api/order/window/route.ts:726-728`, day choices i `app/api/order/window/route.ts:730`, agreement state i `app/api/order/window/route.ts:732-740`, agreement choices i `app/api/order/window/route.ts:744`, og closed dates i `app/api/order/window/route.ts:746-756`.
- Klienten prefetcher samme vindu og eventuelt neste uke uten setState i `app/(app)/week/EmployeeWeekClient.tsx:1193-1204`, `app/(app)/week/EmployeeWeekClient.tsx:1265-1282` og `app/(app)/week/EmployeeWeekClient.tsx:1318-1327`.
- Ingen Suspense-boundary er definert rundt `EmployeeWeekClient` i `page.tsx`; normal render returnerer headerseksjon og klientcomponent direkte i `app/(app)/week/page.tsx:709-722`.
- Images i `EmployeeWeekClient` bruker vanlig `<img>` for menybilder med ESLint-disable i `app/(app)/week/EmployeeWeekClient.tsx:543-551` og `app/(app)/week/EmployeeWeekClient.tsx:721-729`, ikke `next/image`.

### 7.4 Sticky/fixed-elementer

- Suksess-toast er `fixed` nederst på mobil og øverst på desktop i `app/(app)/week/EmployeeWeekClient.tsx:1560-1567`.
- Confirm modal er `fixed inset-0` i `app/(app)/week/EmployeeWeekClient.tsx:435-472`.
- Sticky bottom CTA er `fixed bottom-0 left-0 right-0 z-40` i `app/(app)/week/EmployeeWeekClient.tsx:1695-1715`.
- Global app header er ikke sticky i `src/components/nav/HeaderShell.tsx:40-46`; den er border/bg wrapper.

## Seksjon 8: Hva som mangler eller er svakt

- `EmployeeWeekClient` har to hoved-H1-er på normal `/week`: server `page.tsx` rendrer H1 "Bestill eller avbestill lunsj" i `app/(app)/week/page.tsx:711-720`, og klienten rendrer samme H1 igjen i `app/(app)/week/EmployeeWeekClient.tsx:1569-1587`. Dette bryter "én H1 per view" og kan gi dobbelt introinnhold.
- Menyvisningen i dagens `/week` er ikke category-aware mot `menuDay.category`; mobilkortet viser en kategoriliste fra choices/fallback i `app/(app)/week/EmployeeWeekClient.tsx:733-746`, mens faktiske `menuDay`-felt ikke brukes i ansattflaten. Dette er hovedgapet for fase 9b.
- `getMenuForDateAndPlan()` finnes i `lib/cms/menuDay.ts:207-225`, men `/week` bruker ikke den funksjonen. Hvis fase 9b vil vise plan-spesifikke `menuDay`-rader, må ny server-side kobling inn.
- Mobilkortet viser kategorier, men ikke `menuDescription` eller `allergens`; de feltene vises i desktop helper `WeekDayRowDesktop` i `app/(app)/week/EmployeeWeekClient.tsx:555-564`. Den helperen rendres ikke i hovedreturn-grenen `app/(app)/week/EmployeeWeekClient.tsx:1540-1718`, så mobil/aktivt kort mister detaljene.
- `carouselRef`/IntersectionObserver snap-logikken ser ubrukt ut fordi ingen `ref={carouselRef}` finnes i JSX. Koden finnes i `app/(app)/week/EmployeeWeekClient.tsx:1206-1263`, men refen er bare deklarert/lest i `app/(app)/week/EmployeeWeekClient.tsx:966`, `app/(app)/week/EmployeeWeekClient.tsx:1211` og `app/(app)/week/EmployeeWeekClient.tsx:1230`. UKLART om dette er død kode eller en uferdig mobil-swipe.
- Dagtabbaren er fem like kolonner i `app/(app)/week/EmployeeWeekClient.tsx:1618-1639`. Bredden er trolig OK på 360 px, men høyden er ikke eksplisitt låst til 48 px. For mobile production law bør dette måles.
- Sticky CTA dupliserer handlingen fra aktivt kort: aktivt kort har bestill/avbestill i `app/(app)/week/EmployeeWeekClient.tsx:756-815`, og sticky CTA gjentar den i `app/(app)/week/EmployeeWeekClient.tsx:1695-1715`. Det kan være bra for reach, men øker vertikal/visuell kompleksitet på liten skjerm.
- API-vinduet henter CMS `menu` per mealType, ikke `menuDay`. Integrasjon av `menuDay` i klienten uten å flytte sannhetskilde kan gi to parallelle menykontrakter (`menu` og `menuDay`) i samme flate.
- `/api/order/set-day` bruker type `Tier = "BASIS" | "PREMIUM"` i `app/api/order/set-day/route.ts:22`, mens øvrig ny tier-modell har `"BASIS" | "LUXUS" | "ENTERPRISE"`. Dette ligger utenfor ren audit, men er relevant svakhet for menyvalg/tierforståelse i bestillingsskriving.
- `resolveTierForOrderDay()` mapper `LUXUS` til `PREMIUM` og fallbacker ellers til `BASIS` i `lib/orders/agreementContractFallback.ts:27-44`. UKLART hvordan `ENTERPRISE` skal skrive valg gjennom denne legacy-grenen hvis `contract_week_tier` ikke er populert.
- `app/styles/meny.css` er globalt importert i root layout i `app/layout.tsx:1-5`, selv om `/meny` kan bli slettet eller integrert. Dette kan bli død global CSS etter fase 9b.

## Seksjon 9: Filer som kommer i veien for fase 9b

- `app/(app)/meny/page.tsx`: finnes. Den gjør egen agreement-fetch via `getCurrentAgreementState()` i `app/(app)/meny/page.tsx:49-64`, beregner uke og henter `getMenuForDateAndPlan()` per dato i `app/(app)/meny/page.tsx:35-41` og `app/(app)/meny/page.tsx:66-77`. Sannsynlig opprydding hvis meny integreres i `/week`: slett standalone route eller gjør den til redirect. Claude må velge om `/meny` skal fjernes helt, redirecte til `/week`, eller beholdes som read-only separat flate.
- `app/(app)/meny/MenyView.tsx`: finnes. Den har nyttig enkel rendering av `expectedCategories` mot `menusPerDay` i `app/(app)/meny/MenyView.tsx:50-97`, og viser `mealTitle`, `description`, `allergens` i `app/(app)/meny/MenyView.tsx:74-82`. Sannsynligvis ikke gjenbrukbar direkte i `/week` uten å splitte ut mindre presentasjonskomponent, fordi `/week` har aktiv dag, sticky CTA og ordrestatus.
- `app/styles/meny.css`: finnes og er globalt importert i `app/layout.tsx:1-5`. Den er mobile-first og bare scoped under `.meny-page` i `app/styles/meny.css:1-15`. Hvis `/meny` slettes, bør import og fil slettes; hvis komponentstiler gjenbrukes, bør de flyttes til `/week`-relevant CSS eller Tailwind i ny komponent.
- `lib/cms/menuDayContract.ts`: finnes. Bør gjenbrukes. Det er client-safe kontrakt for `PLAN_TIERS`, `CATEGORIES`, `CATEGORY_LABELS`, `PLAN_CATEGORIES` og `asPlanTier()` i `lib/cms/menuDayContract.ts:1-25`.
- `lib/date/week.ts`: finnes. Har `weekRangeISO()` brukt av `/week` superadmin-preview i `app/(app)/week/page.tsx:22` og `app/(app)/week/page.tsx:467-472`, samt `getCurrentWeekDates()`/`weekRangeISOFrom()` brukt av `/meny` i `app/(app)/meny/page.tsx:15` og `app/(app)/meny/page.tsx:28-32`. Bør ikke slettes uten å flytte `weekRangeISO()`-bruk.
- `lib/auth/employeeAppSurfacePath.ts`: finnes. Den tillater både `/week` og `/meny` i `lib/auth/employeeAppSurfacePath.ts:5-8`. Hvis `/meny` fjernes, bør Claude velge om `/meny` tas ut av allowlist samtidig eller beholdes for redirect.
- `tests/app/meny-page.test.tsx`: finnes. Dekker `MenyView` og kategoriantall i `tests/app/meny-page.test.tsx:47-115`. Hvis `/meny` slettes, bør testen slettes eller omskrives til ny `/week` menykomponent. Kontrakttestene for category/tier kan delvis gjenbrukes.

## Seksjon 10: Anbefalt integrasjonspunkt for meny-visning

- Anbefalt sannhetskilde: utvid `/api/order/window` sin dagmodell, ikke `app/(app)/week/page.tsx`. Normal `/week` får i dag alle dagrader fra `GET /api/order/window?weeks=1` i `app/(app)/week/EmployeeWeekClient.tsx:1052-1118`, og API-et bygger allerede hver `DayRow` i `app/api/order/window/route.ts:507-630`.
- Konkret serverpunkt: i `app/api/order/window/route.ts`, etter `dayTiers` er kjent i `app/api/order/window/route.ts:732-740` og før `days = dates.map(...)` i `app/api/order/window/route.ts:758-773`, kan fase 9b hente `menuDay` per `{ date, tier }` med `getMenuForDateAndPlan()` fra `lib/cms/menuDay.ts:207-225`. Da slipper klienten å gjøre Sanity-kall og holder server-only-kontrakten.
- Konkret klientpunkt: utvid `DayRow` i `app/(app)/week/EmployeeWeekClient.tsx:34-49` med f.eks. `categoryMenus` eller `menusByCategory`, map feltet i `mapDay()` i `app/(app)/week/EmployeeWeekClient.tsx:130-163`, og render inne i `WeekDayCardMobile` rundt `app/(app)/week/EmployeeWeekClient.tsx:719-752`.
- Desktop/large viewport: siden hovedreturn per nå ikke rendrer `WeekDayRowDesktop`, må Claude først velge om den skal gjeninnføres eller om aktivt mobilkort skal være canonical også på desktop. Dagens return bruker samme aktiv-dag/k kommende-dager struktur for alle viewports i `app/(app)/week/EmployeeWeekClient.tsx:1540-1718`.
- Best prop/state-grein: `days` er riktig grein. Den er allerede source of truth for `tier`, `allowedChoices`, valgt ordrestatus, menu title/description/allergens/images og låser i `app/(app)/week/EmployeeWeekClient.tsx:34-49`.
- Nye komponenter som trengs: liten presentasjonskomponent som `WeekCategoryMenuList` eller `DayCategoryMenus`, brukt av `WeekDayCardMobile` og eventuelt desktoprad. Den bør konsumere `PLAN_CATEGORIES`/`CATEGORY_LABELS` fra `lib/cms/menuDayContract.ts:1-20`, ikke hardkode labels slik dagens `BASIS_CATEGORY_LABELS`/`LUXUS_CATEGORY_LABELS` gjør i `app/(app)/week/EmployeeWeekClient.tsx:198-199`.
- CSS-plassering: For minimal diff bør Tailwind i `EmployeeWeekClient.tsx` følge eksisterende mønster. Hvis klasser blir store/gjenbrukbare, legg en ny scoped CSS-fil under `app/styles/` og importer globalt bare hvis den er scoped til en `/week` wrapper. Eksisterende `.meny-page` CSS i `app/styles/meny.css:1-155` bør ikke brukes direkte på `/week` uten rename/scope-endring.
- Oppryddingsvalg: hvis integrasjonen gjør `/meny` overflødig, må Claude rydde `app/(app)/meny/page.tsx`, `app/(app)/meny/MenyView.tsx`, `app/styles/meny.css`, root importen i `app/layout.tsx:1-5`, `/meny` allowlist i `lib/auth/employeeAppSurfacePath.ts:5-8`, og `tests/app/meny-page.test.tsx`. Hvis `/meny` beholdes, bør den dele presentasjonskomponent/kontrakt med `/week` for å unngå to divergerende menyflater.

