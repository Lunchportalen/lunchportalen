# U30 — Changed files

| Fil | Hvorfor | Risiko |
|-----|---------|--------|
| `app/api/backoffice/content/audit-log/route.ts` | Unngå 500 når `content_audit_log` mangler; returner `degraded` + tom liste | Lav |
| `components/cms/control-plane/EditorialAuditTimelinePanel.tsx` | Degradert UI + parsing av `data.degraded` | Lav |
| `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` | Tydelig 401/403 for tree | Lav |
| `app/(backoffice)/backoffice/_shell/SectionShell.tsx` | Bredere tree-kolonne (340–480px) | Lav |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceWorkspaceShell.tsx` | Bredere tri-pane | Lav |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx` | Større preview-andel i split | Lav |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceEditorModeStrip.tsx` | Fjernet duplikat status vs `ContentTopbar`; større sekundærknapp | Lav |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHeaderChrome.tsx` | Oppdaterte props til strip | Lav |
| `tests/api/contentAuditLogRoute.test.ts` | Regresjon: degradert audit | Lav |
| `docs/umbraco-parity/U30_*.md` | Fase dokumentasjon | — |
