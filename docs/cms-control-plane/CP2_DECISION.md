# CP2 — Beslutning

**Dato:** 2026-03-29

## 1. Endelig beslutning

**GO WITH CONDITIONS**

## 2. Hva som er oppnådd

- **CMS** fungerer tydeligere som **hovedbase**: TopBar med **Runtime** og **Uke & meny**, runtime-aggregater, Sanity-meny-lesing i backoffice, bro til Studio og operative tårn.
- **Domener med CMS-kobling**: innhold/media (uendret); **firma/avtale/lokasjon** som **read-only aggregater**; **meny** som **Sanity-lesing** + dokumentert `GET /api/week`-kjede.
- **Ukemeny**: styres fortsatt ved **Sanity `menu`** — CP2 gjør kjeden **synlig**; **weekPlan** forblir **editorial** (LIMITED), ikke employee truth.
- **Control towers**: eksplisitte lenker og språk fra runtime-side.

## 3. Hva som fortsatt er svakt

- **B1** to uke-fortellinger — delvis mitigert med UI/docs, ikke «løst» produktmessig.
- **Worker STUB**, **Social DRY_RUN**, **API/middleware**, **`strict: false`**, **skala-bevis**.

## 4. Nærhet til Umbraco-/verdensklasse

- **Innhold + kontrollflate**: sterkere kohærens; **plattform-governance** fortsatt ikke ubetinget enterprise-nivå.

## 5. Før ubetinget enterprise-live-ready

1. Worker-stubs lukket eller deaktivert.
2. Ekstern social publish eller hard DRY_RUN-grense i produkt.
3. API-gate audit / middleware-strategi.
4. `strict: true` migrasjon.
5. B1 produktvedtak eller signert risiko.

## 6. Kan vente

- Kosmetisk finpuss uten sannhetsendring.
- Dyp inline Sanity-redigering i Next.
