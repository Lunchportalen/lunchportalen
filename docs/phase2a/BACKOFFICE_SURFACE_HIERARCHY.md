# Backoffice surface hierarchy (V3)

## Lag (utenfra og inn)

1. **App shell** — `BackofficeShell`: `bg-[rgb(var(--lp-bg))]` (varm base).
2. **Chrome bar** — `TopBar`: `bg-[rgb(var(--lp-chrome-bg))]/90` + blur; aktiv fane: `var(--lp-hotpink)` understrek.
3. **Section split** — `SectionShell`: tre-kolonne `cmsSectionTreeAsideClass` (glass + høyre kant); hovedflate `cmsWorkspaceMainSurfaceClass`.
4. **Workspace** — editor: `rgb(var(--lp-surface-alt))` / kort `rgb(var(--lp-card))`.
5. **CMS-design** — targeting-bar: glass + soft shadow (ikke full neon-bakgrunn).
6. **AI rail** — introkort: glass + svak rosa kant (`border-pink-500/15`).

## Kontrast

- Kritiske lister/tabeller: behold `bg-white` / `bg-[rgb(var(--lp-card))]` uten tung blur.
- Preview-kolonne: tydelig kant (`border-l`) mot editor.

## Komponenter

| Komponent | Overflate |
|-----------|-----------|
| `GlobalDesignSystemSection` | `bg-white` panel |
| `CmsDesignTargetingBar` | glass + border token |
| `CmsBlockDesignSection` | `bg-white/90` + blur lett |
