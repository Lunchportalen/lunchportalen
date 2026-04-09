# U29 — Screen UX failures (evidence)

## Vedlagt skjermdump

I denne økten var **ingen binær skjermdump vedlagt** i meldingen. Nedenfor er UX-problemer som er **eksplisitt beskrevet i U29-briefen** og som U29 adresserer med kode.

## Konkrete problemer (brief + kjent tilstand før U29)

| Problem | Type | U29-tiltak (kode) |
|---------|------|-------------------|
| For mange toppnivåvalg i én tett stripe | IA | TopBar: seksjonsfaner + sekundær rad kun for valgt seksjon |
| Svak separasjon section / workspace | IA | Tydelig to-rads navigasjon; Settings får eget layout-sidenav |
| For mange mikrolinjer/badges i toppen | Layout | Historikk-stripe og runtime-stripe kollapsbare (`<details>`); kontekststrip kompaktert |
| Content tree for smalt | Layout | `SectionShell`: tre 300–400px |
| Preview klemt | Layout | Editor/preview grid: `minmax(360px,1fr)` på preview-kolonne |
| Settings som ren infoside | IA | Hub + **document types / data types / create policy** som collection + workspace routes |
| Handlinger for svake | Action hierarchy | Primær lenkestil beholdt; Settings-kort med tydelig «Åpne» |

## Hva som fortsatt kan kreve senere faser

- Full **ContentWorkspace**-redesign (inspector/preview split, alle kort) uten bred refaktor.
- Pixel-match mot faktisk skjermdump når den legges ved.
