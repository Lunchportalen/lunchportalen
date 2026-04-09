# U30X-READ-R2 — Editor UX failures (evidence register)

## Skjermbilde-bevis (U30X-READ-R2)

**Ingen skjermbilder var vedlagt i denne økten.** Følgende er derfor **strukturert fra kildekode og kjente mønstre**, supplert av tidligere intern doc `U30X_EDITOR_FAILURES_FROM_SCREENSHOT.md` hvis teamet trenger visuell baseline — **ikke duplisert her**.

**Krav ved neste visuell verifisering:** ta screenshot av `/backoffice/content`, `/backoffice/content/{uuid}`, settings-seksjonen, og vedlegg til neste READ/VERIFY-fase.

## Problemer avledet fra kodearkitektur (høy tillit)

| Problem | Where seen (konseptuelt) | Severity | Why it hurts editor workflow | Likely owning files |
|---------|--------------------------|----------|------------------------------|---------------------|
| **“Content” root ≠ editor** | `/backoffice/content` viser **GrowthDashboard** | **Høy (IA)** | Bruker forventer CMS-start med tre+side; får vekst/analyse-kontrolltårn | `content/page.tsx`, nav registry |
| **Dual host for editor** | `ContentWorkspaceLayout` rendrer `ContentEditor` når `selectedNodeId` satt, ellers `children` | **Middels** | To veier inn kan skape forvirring om state (layout selection vs route) | `ContentWorkspaceLayout.tsx` |
| **Monolittisk workspace** | Enorm `ContentWorkspace.tsx` + mange paneler | **Høy** | Kognitiv last; vanskelig å se “ett arbeidsområde” | `ContentWorkspace.tsx`, `ContentWorkspaceFinalComposition.tsx` |
| **Mange samtidige “kontroll”-striper** | TopBar + extension strip + command palette + runtime status (details) + history strip | **Middels–høy** | Hierarki konkurrerer; primær handling utvannes | `BackofficeShell.tsx`, `layout.tsx` |
| **Modal + overlay + live preview draft** | Block edit modal oppdaterer `editModalLiveBlock` for preview | **Middels** | Risiko for forveksling mellom ulagret modal og lagret side | `ContentWorkspace.tsx`, `BlockEditModal.tsx` |
| **Tree bredde 360–520px** | `SectionShell` eksplisitt min/max | **Lav–middels** | Tar horisontal plass fra canvas på desktop; kan være bevisst Umbraco-lignende | `SectionShell.tsx` |
| **WOW/Demo/Pitch URL-moduser** | `useContentWorkspaceUrlModeFlags` | **Middels** | Demo-støy i produksjonslignende editor | `ContentWorkspace.tsx`, `contentWorkspaceModalStackViewModel.ts` |
| **Minimal document type matrix** | Kun `page` i `contentDocumentTypes` | **Høy** for Umbraco-paritet | Ingen rik “create under type”-opplevelse | `lib/cms/contentDocumentTypes.ts` |

## Kolonnebalanse / canvas / inspector (analytisk)

- **SectionShell** bruker **én** grid: `minmax(360px, min(36vw, 520px))` + `1fr` — preview+inspector må dele `1fr`; ved mange paneler (global/design moduser) oppleves **ikke** ett sammenhengende “canvas-first” rom uten videre visuell prioritering (krever screenshot for å bekrefte subjektiv UX).

- **Inspector prioritet:** `ContentWorkspacePropertiesRail` er avhengig av valgt blokk/side — hvis header/topbar dominerer vertikal luft, “properties” kan oppleves som sekundær (krever måling).

- **Tre som primær navigasjon:** `ContentTree` er **korrekt** koblet til `router.push`, men **landing** på `/content` åpner ikke automatisk en side — tre underminerer “start her” for vanlig redigering.

## Kosmetisk vs blokkerende

| Type | Eksempler |
|------|-----------|
| **Kosmetisk** | Badge-tekst, små spacing i strip (uten funksjonell feil) |
| **Blokkerende** | Tree API feiler uten degradering; side PATCH feiler; data lastes ikke |
| **Semi-blokkerende** | Audit degradert uten tydelig banner i UI (hvis klient ignorerer `degraded`) |

## Først i neste UX-runde (når screenshots finnes)

1. Bekreft **header/toolbar** konkurranser (H1-regel vs backoffice chrome).  
2. Kartlegg **preview** faktisk størrelse vs inspector.  
3. Verifiser **touch targets** på mobil hvis backoffice noen gang brukes på smal skjerm (nå primært desktop-nav).
