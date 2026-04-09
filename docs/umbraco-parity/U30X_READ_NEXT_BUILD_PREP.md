# U30X-READ-R2 — Next build prep

## Først

1. **Beslut IA for `/backoffice/content`:** enten redirect til siste åpnede side, tree-first landing, eller tydelig CTA til “Rediger sider” vs “Vekst-dashboard”.  
2. **Les `ContentWorkspaceLayout.tsx` + `content/page.tsx` sammen** — forstå når `children` vs layout-`ContentEditor` vinner.  
3. **Verifiser DB-migrasjoner** i målmiljø for `content_pages`, tree-kolonner, `content_audit_log`.  
4. **Kjør** (når build-fase tillates): `npm run typecheck` → `npm run lint` → `npm run build:enterprise` per AGENTS.

## Ikke rør ennå

- Auth/middleware/post-login.  
- Parallelle “nye CMS” — forsterk eksisterende workspace.  
- Slette docs uten eier-review.

## Filer å åpne først (neste runde)

1. `app/(backoffice)/backoffice/content/page.tsx`  
2. `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceLayout.tsx`  
3. `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` (grep først etter `useEffect` / fetch)  
4. `app/api/backoffice/content/tree/route.ts`  
5. `app/api/backoffice/content/pages/[id]/route.ts`  
6. `lib/cms/blockAllowlistGovernance.ts` + `lib/cms/contentDocumentTypes.ts`

## Docs å ignorere (under implementasjon)

- Alt som lover full **Umbraco 17** uten å mappe til konkrete filer.  
- Eldre SIGNOFF som motstrider nåværende `ContentWorkspace` struktur.

## Runtime-feil før UX-polish

- Tree 500 / tom degradert tre uten forklaring.  
- Audit `degraded` uten UI-banner.  
- PATCH-konflikt / version mismatch — må repros før “pynt”.

## Raskeste editor-løft (ROI)

1. **Landing** som peker redaktører til **tre + side**.  
2. **Tydelig lagret vs ulagret** rundt modal/preview.  
3. **Reduser synlige paneler** i default modus (progressiv avdekking).
