# CP8 — Editorial workflow contract

## Handlinger

| Handling | Full paritet | Simulert paritet | Merknad |
|----------|--------------|------------------|---------|
| **Save** | Postgres content pages (workspace) | Sanity = Studio-lagre utkast | To systemer — tydelig hvor du er |
| **Preview** | Content preview + Sanity perspectives | Meny: kundesynlig filter i GROQ | Samme *filosofi* for publisert vs ikke |
| **Publish** | Content publish + workflow | Sanity `menuContent` via Studio eller CP7 broker | Samme Actions for broker |
| **Schedule / governance** | Content workflow flags | Cron + visibility i drift | Ikke én Umbraco Scheduler |
| **History / rollback** | Page recovery der implementert | Sanity document history | **Fortell** hvor historikk lever — ikke én tidslinje |

## Hva som er «full paritet» i praksis

- **Nettsideinnhold:** save → preview → publish → variant (innenfor eksisterende workspace).
- **Operativ meny:** rediger i Studio → publish (eller broker) → `GET /api/week` leser publisert.

## Hva som er simulert paritet

- **Én sammenkoblet CMS-database** for alt — **nei**; **UX** og **kontrollplan** simulerer helhet.

## Hva som må bygges nå (CP8)

- Dokumenter denne kontrakten.
- **Synkroniser narrativ** i operativ publish-kjede med broker (kode/kopi).
