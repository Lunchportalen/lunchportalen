# U30X — Backoffice target model

## Umbraco 17-lignende mål (ikke stack-påstand)

1. **Én extension registry** — `lib/cms/backofficeExtensionRegistry.ts` (seksjon → moduler).
2. **Section først** — `TopBar` seksjons-dropdown, deretter modul-lenker i gruppen.
3. **Workspace context** — `BackofficeExtensionContextStrip` (modul + posture + domain surface) — komprimert i U30X.
4. **Content workspace** — Ytre tre (`SectionShell`) + innre tri-pane (struktur | editor | inspektør).
5. **Operational runtime truth** — Ordre, uke, billing forblir utenfor CMS-mutasjon; lenker og read-only innsikt OK.

## Grenser (låst)

- Ingen ny tree-motor, ingen ny audit-motor, ingen parallel settings-DB.
- AI/orchestrator utvides ikke — overflater og governance først.
