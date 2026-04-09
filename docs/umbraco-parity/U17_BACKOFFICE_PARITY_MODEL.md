# U17 — Backoffice parity model (Umbraco 17-prinsipper)

**Referanse:** [Umbraco 17 LTS](https://umbraco.com/blog/umbraco-17-lts-release/) — moden, støttet plattform; konsistent dato/tid; skalerbar backoffice-tenkning; LTS som langsiktig basis.

## 1. Hvordan backoffice skal speile Umbraco 17

| Prinsipp | Umbraco 17 (intent) | Lunchportalen |
|----------|---------------------|---------------|
| Moden backoffice | Ikke «beta»-følelse | Én `BackofficeShell` + workspace surface; rolig 2A-design |
| Skalerbar tenkning | Utvidelser, last | Seksjoner og palett skalerer uten ny app |
| Konsistente datoer | UTC, tydelighet | Per-domene; gap der legacy — dokumentert i gap map |
| Editorforutsigbarhet | Forutsigbare handlinger | Eksplisitte primærhandlinger, ingen skjult auto-publish |
| Tilgjengelighet | Bedre a11y i LTS-fokus | Følg eksisterende mønstre; systematisk audit egen fase |
| Utvidbarhet | Pakker / extensions | Nye ruter under backoffice + API; ikke parallell shell |

## 2. Full paritet (innenfor stack)

- **Navigasjon og workspaces** som ett system.
- **Content tree + media** som første klasse.
- **Publish workflow** for innholdssider der implementert.

## 3. UX-paritet (føles som Umbraco, er Next.js)

- **Command palette** som discovery (ikke full Elasticsearch).
- **History strip** som forklaring (ikke én SQL-tidslinje for alt).
- **Section grouping** og workspace-krom.

## 4. Ikke identisk uten replatforming

- **.NET 10 / Umbraco-kjerne** — ikke relevant; **bevisst stack-valg**.
- **Load-balanced backoffice-noder** — erstattes av Vercel/Next-skalering; **annen modell**, samme bruksklasse for SMB/mid-market.
- **Umbraco granular member permissions** — Lunchportalen bruker **roller og server guards**; finmasket Umbraco-tilgang krever **egen RBAC-modell** (replatforming eller større feature).

Se `U17_REPLATFORMING_GAPS.md`.
