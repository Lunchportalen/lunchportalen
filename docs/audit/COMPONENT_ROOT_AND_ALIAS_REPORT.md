# Component root and alias report (V2)

## `tsconfig.json` paths (kritisk)

```json
"@/components/*": ["./src/components/*", "./components/*"],
"@/lib/*": ["./lib/*", "./src/lib/*"],
"@/types/*": ["./types/*", "./src/types/*"]
```

## Rekkefølge = skyggelegging

| Alias | Første treff | Andre treff | Konsekvens |
|-------|--------------|---------------|------------|
| `@/components/...` | `src/components` | `components` | Filer i **src** vinner — **SHADOWED** |
| `@/lib/...` | `lib` | `src/lib` | `lib` vinner |
| `@/types/...` | `types` | `src/types` | `types` vinner |

## Størrelse

| Mappe | Ca. filer |
|-------|-----------|
| `components/` | 233 |
| `src/components/` | 17 |

**Tolkning:** Liten `src/components` — men **høy** prioritet i resolver.

## Kjente duplikate filnavn (begge røtter)

| Fil | `components/` | `src/components/` |
|-----|---------------|-------------------|
| `nav/HeaderShellView.tsx` | Ja | Ja |
| `nav/NavActiveClient.tsx` | Ja | Ja |
| `nav/AuthSlot.tsx` | Ja | Ja |
| `ui/toast.tsx` | Ja | Ja |
| `layout/PageContainer.tsx` | Ja | Ja |
| `week/WeekMenuReadOnly.tsx` | Ja | Ja |
| `ui/ds/*` (Button, Card, …) | delvis | Ja |

## Import-mønster (stikkprøve)

- `grep` for `from "@/components` treffer **mange** konsumenter — faktisk resolved fil avhenger av **hvilken** path som eksisterer i `src` først.

## Design tokens / stylespor

- `lib/ui/tokens.ts`, `tailwind.config.cjs` — **CANONICAL** for Tailwind.
- `docs/phase2a/DESIGN_TOKEN_MAP.md` — **PARTIALLY_CURRENT**.

## Anbefaling

1. **En** eksplisitt policy: «Nye komponenter kun i X».  
2. Fjern duplikater **senere** ( **REFACTOR_LATER** ) — ikke i V2-leveransen.

## Klassifisering

| Tema | Tag |
|------|-----|
| Dobbelt rot | **DUPLICATE** + **SHADOWED** |
| `strict: false` i tsconfig | **SCALE_RISK** / kvalitet — se hovedrapport |
