# Lunchportalen — live-state i Sanity

**Dato for dump:** 2026-05-12T11:12:24.968Z  
**Repo-commit:** 0625628d64c37e2302242bf62ec47ee65a3aea48  
**Sanity projectId:** 4udoq5d8  
**Sanity dataset:** production  
**Sanity API-versjon brukt:** 2024-01-01

---

## 1. Dokumentantall per type

| Type | Antall dokumenter | Antall drafts | Antall published | Antall som er bare draft (ikke publisert) |
|---|---:|---:|---:|---:|
| menuDay | 10 | 0 | 10 | 0 |
| menuContent | 5 | 0 | 5 | 0 |
| weekPlan | 0 | 0 | 0 | 0 |
| mealIdea | 1000 | 0 | 1000 | 0 |
| menu | 0 | 0 | 0 | 0 |
| closedDate | 0 | 0 | 0 | 0 |
| announcement | 0 | 0 | 0 | 0 |
| dish | 0 | 0 | 0 | 0 |
| productPlan | 0 | 0 | 0 | 0 |
| weekTemplate | 0 | 0 | 0 | 0 |

Forklaring: "Bare draft" betyr et dokument der `_id` starter med `drafts.` og det IKKE finnes et tilsvarende dokument uten `drafts.`-prefix.

## 2. menuDay — felt-analyse

| Felt | Antall dokumenter med feltet | Antall med non-null verdi | Eksempelverdi (første ikke-null) |
|---|---:|---:|---|
| `_createdAt` | 10 | 10 | 2026-04-25T08:57:30Z |
| `_id` | 10 | 10 | menuDay-2026-04-20 |
| `_rev` | 10 | 10 | 5HfN120UQvvCz6r9eASIHW |
| `_type` | 10 | 10 | menuDay |
| `_updatedAt` | 10 | 10 | 2026-04-25T10:27:34Z |
| `allergens` | 10 | 10 | [] |
| `approvedForPublish` | 10 | 10 | false |
| `costTier` | 10 | 10 | BUDGET |
| `customerVisible` | 10 | 10 | false |
| `date` | 10 | 10 | 2026-04-20 |
| `description` | 10 | 10 | Varm lunsjrett med tydelig meksikansk preg, egnet for produksjon i volum og servering på kontor. |
| `estimatedCostPerPortion` | 10 | 10 | 27 |
| `isFishDish` | 10 | 10 | false |
| `isSoup` | 10 | 10 | true |
| `isVegetarian` | 10 | 10 | true |
| `kitchenStyle` | 10 | 10 | Internasjonalt/Meksikansk |
| `mayContain` | 10 | 10 | ["spor av gluten","spor av melk"] |
| `mealRef` | 10 | 10 | {"_ref":"mealIdea.0115.meksikansk-suppe-av-sotpotet-i-fyldig-suppe-med-jalapeno-mais-og-ovnsbak","_type":"reference"} |
| `mealTitle` | 10 | 10 | Meksikansk suppe av søtpotet i fyldig suppe med jalapeño, mais og ovnsbakte småpoteter |
| `nutritionPer100g` | 10 | 10 | {"carbohydratesG":21.4,"energyKcal":126,"fatG":3.5,"fiberG":4.4,"per":"100g","proteinG":4.9,"saltG":0.85,"saturatedFa... |

## 3. menuContent — felt-analyse

| Felt | Antall dokumenter med feltet | Antall med non-null verdi | Eksempelverdi (første ikke-null) |
|---|---:|---:|---|
| `_createdAt` | 5 | 5 | 2026-04-24T12:29:04Z |
| `_id` | 5 | 5 | menuContent-2026-04-20 |
| `_rev` | 5 | 5 | nMSxjXpD1FV0FKp4ZS2pm0 |
| `_type` | 5 | 5 | menuContent |
| `_updatedAt` | 5 | 5 | 2026-04-24T12:29:04Z |
| `allergens` | 5 | 5 | [] |
| `date` | 5 | 5 | 2026-04-20 |
| `description` | 5 | 5 |  |
| `isPublished` | 5 | 5 | false |

Spesialfelt: `title`, `tier`, `approvedForPublish`, `approvedAt`, `customerVisible` og `customerVisibleSetAt` vises i tabellen over hvis de finnes i live-dumpen.

## 4. weekPlan — felt-analyse

Ingen dokumenter funnet.

Nyeste `weekPlan._updatedAt`: Ikke funnet

## 5. Tidsstempel-analyse — hvilken modell er aktiv?

| Modell | Eldste `_createdAt` | Nyeste `_createdAt` | Eldste `_updatedAt` | Nyeste `_updatedAt` |
|---|---|---|---|---|
| menuDay | 2026-04-25T08:57:30Z | 2026-04-25T08:57:46Z | 2026-04-25T10:27:34Z | 2026-04-25T10:27:56Z |
| menuContent | 2026-04-24T12:29:04Z | 2026-04-24T12:29:08Z | 2026-04-24T12:29:04Z | 2026-04-24T12:29:08Z |
| weekPlan | Ikke funnet | Ikke funnet | Ikke funnet | Ikke funnet |

Tolkning: siste aktivitet etter `_updatedAt` er `menuDay` (2026-04-25T10:27:56Z). Full rekkefølge etter nyeste `_updatedAt`: `menuDay` 2026-04-25T10:27:56Z, `menuContent` 2026-04-24T12:29:08Z. Dette er tallgrunnlag, ikke en beslutning om kanon.

## 6. Dato-spenn — hvilke uker er dekket?

| Modell | Eldste `date` | Nyeste `date` | Antall unike datoer | Fortid | Fremtid |
|---|---|---|---:|---:|---:|
| menuDay | 2026-04-20 | 2026-05-01 | 10 | 10 | 0 |
| menuContent | 2026-04-20 | 2026-04-24 | 5 | 5 | 0 |

## 7. Krysskobling — finnes samme dato i flere modeller?

| Dato | menuDay? | menuContent? | weekPlan (via days[].date)? |
|---|---|---|---|
| 2026-04-20 | ja | ja | nei |
| 2026-04-21 | ja | ja | nei |
| 2026-04-22 | ja | ja | nei |
| 2026-04-23 | ja | ja | nei |
| 2026-04-24 | ja | ja | nei |

## 8. Referanseintegritet

| Modell | Referanser til mealIdea | Referanser som finnes | Referanser som mangler |
|---|---:|---:|---:|
| menuDay.mealRef | 10 | 10 | 0 |
| weekPlan.days[].mealRef | 0 | 0 | 0 |

## 9. Drafts som ikke er publisert

| _id | _type | date | _updatedAt |
|---|---|---|---|
| Ikke funnet |  |  |  |

## 10. Sammendrag

- `menuDay`: 10 dokumenter i dumpen.
- `menuContent`: 5 dokumenter i dumpen.
- `weekPlan`: 0 dokumenter i dumpen.
- `mealIdea`: 1000 dokumenter i dumpen.
- Nyeste aktivitet blant `menuDay`, `menuContent`, `weekPlan`: `menuDay` (2026-04-25T10:27:56Z).
- Dato-overlapp på tvers av modellene: 5 datoer.
- Drafts uten published motpart: 0.
- Skjema/runtime-mismatch må leses fra feltanalysene over, særlig `menuContent`-felter markert `[UDEKLARERT]`.
