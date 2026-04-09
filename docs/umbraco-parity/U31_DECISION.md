# 1. Endelig beslutning

**GO WITH CONDITIONS** — U31 løfter backoffice tydelig nærmere Bellissima på section/tree/workspace, context/apps/footer og editorro, uten å late som Lunchportalen har blitt Umbraco internt.

# 2. Hva som er oppnådd

- **Tree truth:** Virtuelle røtter, folder-roots og fixed-page-kinds er samlet i én kanonisk modell på tvers av API og UI.
- **Sections / workspaces:** Registry, TopBar, context strip, content landing og settings leser samme section-/view-definisjoner.
- **Content-first entry:** `/backoffice/content` oppfører seg mer som en arbeidsflate enn et dashboard, med signaler og faktisk opprett-side-handling.
- **Settings som kontrollplan:** Seksjonen er mer operativ og mindre brosjyre, med tydelig management-kontekst og live governance-signaler.
- **Workspace context:** `ContentBellissimaWorkspaceSnapshot` beskriver nå section, workspace, historikkstatus, preview-lenke og primære/sekundære handlinger.
- **Workspace apps:** Properties-railen er ikke bare omdøpt; innhold, design og governance viser nå riktigere kontrolltyper.
- **Editorro:** Main canvas fikk større preview og mindre badge-støy; høyrepanelet er strammere rundt Workspace / AI / Runtime.

# 3. Hva som fortsatt er svakt

- **REPLATFORMING_GAP:** Persistente document type/data type CRUD-flater finnes fortsatt ikke; code-governed modell er fortsatt sannheten.
- **Historikk:** Audit-helse og versjonshistorikk er synligere, men fortsatt ikke én fullt samlet arbeidsflate som i Bellissima.
- **Moduler:** `moduleLivePosture` og eksisterende runtime-posture er uendret i denne fasen.

# 4. Nærhet til Umbraco 17 / verdensklasse

- **Opplevd arbeidsflyt** er nå klart nærmere Bellissima på innholdsflaten.
- **Teknisk identitet** er fortsatt Next.js/Supabase/Postgres, ikke Umbraco runtime. Det er en bevisst og ærlig differanse.

# 5. Før ubetinget enterprise-live-ready

- Full historikk/audit når tabell eller migrasjon mangler.
- Eventuell samling av historikkstatus og versjonsdialog i samme workspace-surface.
- Målrettet manuell QA av content landing, page editor og settings i faktisk nettleser.

# 6. Kan vente

- Pixel-perfect Umbraco chrome.
- Pluggbar workspace app-registry utover dagens route-/snapshot-baserte modell.
- Videre finpolering av sekundære apps som `Scripts` og `Avansert`.
