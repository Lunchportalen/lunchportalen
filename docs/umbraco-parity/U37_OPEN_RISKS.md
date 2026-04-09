# U37 Open Risks

- `ContentWorkspace.tsx` er fortsatt en stor host/orchestrator. Risiko: videre Bellissima-paritet blir dyrere og mer skjør hvis denne ikke brytes ned videre.
- `contentWorkspaceWorkspaceRootImports.ts` er fortsatt i repoet. Risiko: framtidig utvikling kan igjen skjule eierskap bak import-samling.
- Document types / data types / property editor-systemet er fortsatt primært code-governed read management. Risiko: overpåstått parity hvis dette omtales som full object lifecycle.
- Week/menu-publisering går fortsatt via Sanity Studio selv om governance ligger i CMS. Risiko: svakere “alt i én backoffice”-fortelling enn full Umbraco-paritet.
- `build:enterprise` er tung og langvarig. Risiko: treg feedback-loop ved videre editorarbeid.
- Moduler med ikke-bred live posture består:
  - `LIMITED`: weekPlan editorial, social calendar, SEO growth, ESG
  - `DRY_RUN`: social publish
  - `STUB`: worker jobs
  - `INTERNAL_ONLY`: cron growth / ESG
