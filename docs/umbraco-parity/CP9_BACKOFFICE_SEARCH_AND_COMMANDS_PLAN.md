# CP9 — Backoffice search and commands plan

## Hva som finnes i dag

- **Content tree:** CP9 **klient-side søk** (navn/slug) med auto-ekspandering av mapper til treff.
- **Media:** liste med filtre der implementert.
- **Domener:** oversiktssider + kort.
- **Kommandoer:** kontekstmenyer på tre-rader, domain actions, lenker.

## Merkbare gap

- Ingen **global** ⌘K / én søkeboks for hele backoffice.
- Ingen **server-side** fulltext på tvers av tre uten eksisterende API.

## Hva som kan bygges nå (CP9)

- **Tree filter** — implementert (ingen ny motor).
- **Fremtid:** vurder `Cmd+K` palett som kun **lenker** til eksisterende ruter (uten ny indeks) — utenfor CP9 hvis ikke tid.

## Replatforming

- Ekte enterprise search (Elasticsearch) — egen plattform.
