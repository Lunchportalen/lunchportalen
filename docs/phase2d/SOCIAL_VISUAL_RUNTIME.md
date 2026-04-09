# Social Calendar — visuell runtime (2D1)

---

## 1. Design system (2A)

- **Max bredde:** `max-w-[1440px]` (samme som admin-layout-praksis).
- **Topp luft:** `pt-[27px]` der flaten starter (i tråd med header/content-gap-praksis for kontrollflater).
- **Én primær interaksjon:** «Generer utkast» med tydelig fokus-ring (`--lp-hotpink` på primærknapper der det er naturlig).
- **Status:** Fargekodet badges (amber for gjennomgang, violet for planlagt, grønn for publisert, osv.).
- **Touch:** Knapper `min-h-[44px]` der det er primær/flow-handlinger.

---

## 2. Ikke-mål

- Full redesign av backoffice — kun ny side + én TopBar-lenke.
- Ingen ny global header — `BackofficeShell` beholdt.
