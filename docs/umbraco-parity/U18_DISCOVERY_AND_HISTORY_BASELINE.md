# U18 — Discovery & history baseline

**Dato:** 2026-03-29

## Nær Umbraco 17-paritet (før U18-kode)

- **Command palette** (`BackofficeCommandPalette`) med Ctrl/⌘K, gruppert etter seksjon.
- **Extension registry** (`backofficeExtensionRegistry.ts`) som eneste kilde for palett-treff.
- **Historikk-strip** (`CmsHistoryDiscoveryStrip`) med ærlig flerkilde-fortelling.
- **Context strip** (U17) for workspace + posture.

## Under paritet (merkbare gap)

- Palett matchet kun `label`/`href` — svak **alias**- og **tårn**-discovery.
- Historikk-strip var kompakt; **rollback**-ærlighet kun implisitt.

## Løst i U18 (kode)

- **`discoveryAliases`** + utvidet `filterBackofficeNavItems` (blob fra manifest — **ingen** ny søkemotor).
- **Tårn-lenker** i samme registry (`/admin`, `/kitchen`, `/driver`, `/superadmin/overview`) kun i palett.
- **Historikk-strip** omskrevet til punktliste med eksplisitt «ingen én tidslinje» + rollback-klarhet.
- **AI Control Center**-side med `AiGovernanceOverview` (full `MODULE_LIVE_POSTURE_REGISTRY`).

## Åpne risikoer (uendret)

- Ingen global indeksert søk — bevisst.
- Ingen teknisk merge av Postgres/Sanity/uke-logger — bevisst.
