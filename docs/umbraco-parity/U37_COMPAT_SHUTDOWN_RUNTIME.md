# U37 Compat Shutdown Runtime

## Removed
- `app/(backoffice)/backoffice/content/_components/blockRegistry.ts`
  - Fjernet fordi den konkurrerte med plugin-/catalog-truth om hvilke blokker som finnes og hvilke defaults de starter med.

## Neutralized
- `createBlock()` er nå en tynn klient mot den kanoniske blokkatalogen, ikke en egen lokal defaults-motor.
- Modal stack og modal shell-props bruker nå katalogtypene direkte, ikke gamle registry-typer.

## Boxed In, But Still Present
- `contentWorkspaceTriPaneShellBundle.ts` er fortsatt et assembly-lag, men bærer ikke ny runtime truth i U37.
- `contentWorkspaceWorkspaceRootImports.ts` er fortsatt til stede som import-aggregat. Den er ikke sannhetskilde, men er fortsatt et strukturmessig restlag som bør fjernes i neste editor-lukkerunde.
