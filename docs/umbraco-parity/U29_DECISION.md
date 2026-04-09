# U29 — Decision

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- Betingelser: full Umbraco Bellissima-layout for content workspace krever videre fase; U29 leverer settings workspaces + IA + målrettede layout-justeringer.

## 2. Oppnådd

- Settings er **førsteordens seksjon** med sidenav og egne collection/workspace-ruter for document types og data types.
- Create policy som egen workspace; `create-options` redirect.
- TopBar **seksjon → moduler** (færre synlige faner samtidig).
- Tre bredere; preview mindre klemt; striper kollapsbare; kontekststrip slankere.
- Ingen ny sannhetsmotor; kode-registry fortsatt autoritativ.

## 3. Svakheter

- Inspector og full content workspace-komposisjon ikke redesignet.
- Ingen persisted type-CRUD.

## 4. Nærhet Umbraco 17

- **Settings/management UX:** vesentlig løftet.
- **Content editor:** delvis (preview bredde + tre), ikke full paritet.

## 5. Før ubetinget enterprise-live-ready

- E2E på settings-nav og redirects; ev. visuell QA mot reell skjermdump.

## 6. Kan vente

- Database-styrt document/data types; full inspector split.
