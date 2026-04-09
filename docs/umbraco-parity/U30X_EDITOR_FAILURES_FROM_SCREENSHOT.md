# U30X — Editor failures (UX baseline)

**Evidence:** Produktkrav + kodegjennomgang. Ingen faktisk skjermdump er vedlagt denne sesjonen; beskrivelsene matcher gjeldende shell-komponenter.

## Konkrete UX-problemer (før U30X)

| Problem | Type |
|---------|------|
| For mange visuelle «bånd» (topbar, save, mode strip, kontekst-strip, status) | Hierarki / layout |
| Preview kolonne for smal (`max-w-md`) og ekstra merkelapp «Lunchportalen» | Preview |
| Indre tri-pane hadde relativt smal senter/preview-fraksjon | Layout |
| Venstre content-sidebar 280px vs seksjonstre 360–520px — inkonsistent | Tree / IA |
| «Workspace» som label på høyre rail — vagt for redaktører | IA |
| Inspector faner med mange like store knapper | Action hierarchy |

## IA vs layout vs actions

- **IA:** Seksjon (Kontroll, Runtime, …) er tydelig; modul-rad under er fortsatt tett ved mange faner.
- **Layout:** Tri-pane grid er nå justert (større høyre preview-kolonne i canvas, høyere min-h, bredere venstre sidebar i content shell).
- **Actions:** Primær «Publiser» ligger i `ContentTopbar` (grønn, tydelig); sekundære (kopi support, reload) forblir små — uendret i denne runden.

## Hva som må løses i kode (U30X levert)

- [x] Bredere `ContentWorkspaceShell` sidebar (matcher seksjon bedre).
- [x] Større preview (`LivePreviewPanel` bredde, fjernet overflødig topp-label).
- [x] Tri-pane grid: mer plass til midt/høyre kolonne.
- [x] `RightPanel`: «Inspektør» i stedet for «Workspace».
- [x] `BackofficeExtensionContextStrip`: lavere visuell støy (padding/tekst).

## Gjenstår (ikke ubetinget blokkert av U30X)

- Dypere accordion-gruppering i `ContentWorkspacePropertiesRail` (stor fil — egen runde).
- En enkelt «content app»-bar eksplisitt i chrome (kan bygges på `ContentWorkspaceEditorModeStrip`).
