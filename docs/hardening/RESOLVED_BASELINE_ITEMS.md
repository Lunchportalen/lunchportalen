# Resolved baseline items (mot REPO_DEEP_DIVE_REPORT)

Listen under er **konkret mot** påstander i baseline-rapporten som er **adressert i kode** per 2026-03-28.  
**Merk:** «Resolved» betyr ikke at hele domenet er ferdig hardenet — se `OPEN_PLATFORM_RISKS.md`.

---

## Fullt eller vesentlig avklart (re-verifisert i repo)

1. **Fredagstid for ukesynlighet**  
   - Baseline hevdet **14:00** og **CONTRADICTION** mot 15:00.  
   - **Nå:** `lib/week/availability.ts` implementerer **fredag 15:00** (`isAfterFriday1500`), med deprecert alias-navn.  
   - **Status:** **RESOLVED** mht. baselinepåstand om 14:00 som gjeldende regel.

2. **Employee `next`-allowlist**  
   - Baseline: employee kunne `/week`, `/orders`, `/min-side`.  
   - **Nå:** `allowNextForRole` for employee tillater kun `nextPath.startsWith("/week")`.  
   - **Status:** **RESOLVED** mht. baseline-listen.

---

## Delvis avklart (forbedret dokumentasjon / IA, ikke «ferdig produkt»)

3. **Fragmentert superadmin / operatørflate**  
   - **Delvis:** `lib/superadmin/capabilities.ts`, hurtiglenker og fasedokumentasjon (2A–2C, 2D) — **PARTIAL**, ikke full «løst monolitt».

4. **Enterprise build / SEO-gates**  
   - **Fortsatt aktivt mønster:** `build:enterprise` med SEO-skript — baseline observation **holder**, ikke et «problem» som skal resolves bort.

---

## Ikke-liste (ting baseline kalte risiko som ikke er «løst» her)

- `typescript` strict mode  
- Middleware uten rolle  
- 50k × 200 skaleringsbevis  
- Worker full produksjon for alle jobbtyper  

Disse håndteres i **go-live-planer** og åpne risiko-dokumenter — ikke som «resolved».
