# Superadmin — informasjonsarkitektur (2C4 runtime)

## Kanonisk overflate

| Rute | Formål |
|------|--------|
| **`/superadmin`** | Hovedkontrollflate: hurtiglenker, **kontrollsignaler** (KPI fra DB), deretter `capabilities`-grupper (Kjerne, Operasjoner, Vekst, System). |
| Eksisterende dype ruter | `companies`, `firms`, `agreements`, `users`, `system`, `overview`, `audit`, osv. — **uendret** som sannhetsflater; ingen v2-ruter. |

## Samlet vs deprecate

| Element | Status |
|---------|--------|
| `lib/superadmin/capabilities.ts` | **Beholdt** som eneste register for kort/lenker til App Router. |
| `/superadmin` | **Utvidet** med server-side `loadSuperadminHomeSignals()` — samme talllogikk som dashboard (firma, ordre, + PENDING-avtaler). |
| Backoffice/vekst-lenker | **Beholdt** i capabilities; dokumentert som CMS/vekst, ikke «ny driftmotor». |

## IA-prinsipp (2C4)

1. **Lesing først** — signaler er tall + lenker; ingen nye mutasjoner på forsiden.  
2. **Godkjenning** — inngang via hurtiglenker og avtale-kort → eksisterende `agreements`-flyt.  
3. **Drift** — `overview`, `system`, `audit` forblir egne sider (frosne regler for system/flytsjekk uendret).  

## Ikke omfattet

- SEO/social/ESG som egen 2C4-runtime — lenker kan finnes i capabilities, men ikke utvidet i denne fasen.  
- Endring av frosne livsløp-filer utover lesende forbedring av hjem — **ikke** gjort.
