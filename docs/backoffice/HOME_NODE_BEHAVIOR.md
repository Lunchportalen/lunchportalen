# Hjem/Forside-node — oppførsel (Umbraco 13-paritet)

Dette dokumentet beskriver klikk-, caret-, kebab- og tastaturoppførsel for innholdstreet i backoffice, med Hjem (Forside) som rotnode.

---

## 1) Single click på rad

- **Handling:** Raden velges og editoren åpnes.
- **Teknisk:** `setSelectedId(id)` og `router.push(/backoffice/content/[id])`. For Hjem brukes `/backoffice/content` (eller dashboard/edit-route etter avtale).
- **Viktig:** Single click **toggler ikke** expand/collapse; kun navigasjon og valg.

---

## 2) Caret-klikk (pil-ikon)

- **Handling:** Kun expand/collapse for noden; ingen navigasjon.
- **Teknisk:** `stopPropagation()` på caret-klikk. `toggleExpanded(id)` kalles. Caret-klikk skal **aldri** trigge rad-klikk eller navigasjon.

---

## 3) “Second click” (dobbeltklikk-opplevelse)

- **Mål:** Hvis brukeren klikker på **samme rad** igjen innen **350 ms**, skal det oppleves som “dobbeltklikk” og **kun** togglere expand/collapse, **uten** ny navigasjon.
- **Teknisk:** Two-click guard:
  - Lagre `lastClickRef = { id, ts }` ved rad-klikk.
  - Ved neste rad-klikk: hvis `id === lastClickRef.id` og `now - lastClickRef.ts < 350 ms` → kall `toggleExpanded(id)`, nullstill `lastClickRef`, og **returner** (ingen `router.push`).
  - Ellers: utfør vanlig single-click (velg + naviger) og oppdater `lastClickRef`.
- **Resultat:** Første klikk åpner editor, andre raskt klikk på samme rad ekspanderer/kollapser uten å navigere på nytt.

---

## 4) ⋯ (kebab) — NodeActionsMenu

- **Handling:** Klikk på ⋯ åpner handlingsmenyen for noden.
- **Lukking:** Klikk utenfor menyen eller **Esc** lukker menyen.
- **Tastatur:** Menyen er tastaturnavigerbar (Pil opp/ned + Enter for å velge handling).
- **Viktig:** Kebab-klikk skal **aldri** navigere; `stopPropagation()` slik at rad-klikk ikke trigges.

**Actions (med disabled-tilstand):**

| Action         | Beskrivelse        | Disabled når                    |
|----------------|--------------------|----------------------------------|
| Opprett under  | Opprett undernode  | `!canCreate`                     |
| Omdøp          | Endre nodenavn     | `!canRename`                    |
| Kopier lenke   | Kopier node-URL    | Aldri                            |
| Forhåndsvis    | Åpne i ny fane     | Mangler `slug`                   |
| Flytt          | Flytt node         | Hjem eller `!canMove`            |
| Slett          | Flytt til papirkurv| Hjem (`id === "home"`) eller `!canDelete` |

**Policy (denne patchen):**

- **Hjem (id === "home"):** `canDelete = false`, `canMove = false`, `canRename = true`, `canCreate = true`.
- **Andre noder:** Alle tillatelser `true`.

**Copy link:** Kopierer `/backoffice/content/[id]` til utklippstavle (`navigator.clipboard` med fallback til `textarea` + `execCommand`).

**Preview:** Åpner nytt vindu med `/content/[slug]` når `slug` finnes (`window.open`).

**Create child:** Kaller `onCreateChild(id)`; i denne patchen legges barn kun til i lokal state/mock (ingen API).

**Rename:** Inline redigering i tre-raden (tekstfelt); oppdaterer nodenavn i state.

**Delete:** Flytter node til “recycle bin”-array i lokal state og fjerner den fra treet.

---

## 5) Tastaturoppføring

- **Rad:** Fokusérbar (f.eks. `role="treeitem"` på knapp/rad).
- **Enter:** Åpne editor (samme som single click).
- **Mellomrom:** Toggle expand/collapse **uten** å navigere.
- **Pil høyre:** Utvid node (hvis `hasChildren` og ikke allerede utvidet).
- **Pil venstre:** Kollaps node (hvis den er utvidet).
- **Esc:** Lukk actions-meny hvis den er åpen.

---

## 6) Visuelt og tilgjengelighet

- **Radhøyde:** 36–38 px (tight density).
- **Valgt rad:** Venstre stripe (f.eks. rød) + subtil bakgrunn.
- **Hover:** Subtil bakgrunnsendring.
- **Fokus:** Synlig fokusring (`focus-visible:ring`).
- **Klikkflate:** Full bredde på rad; caret og ⋯ har egne klikkområder og stopper propagasjon.

---

## Referanseimplementasjon

- `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` — state (`selectedId`, `expandedIds`), two-click guard, callbacks.
- `app/(backoffice)/backoffice/content/_tree/TreeNodeRow.tsx` — rad-klikk, caret, ⋯, tastatur.
- `app/(backoffice)/backoffice/content/_tree/NodeActionsMenu.tsx` — handlingsmeny med actions og lukking (klikk utenfor + Esc).
