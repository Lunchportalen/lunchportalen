# U23 — Settings-seksjon workspace-modell

## Målbilde (Umbraco-lignende IA)

**Settings** skal være førsteordens **kontrollflate** for:
1. **System & drift** — eksisterende globale toggles (superadmin-sannhet).
2. **Skjemastyrning** — lesbar oversikt over document types, data type-lignende felt, create options (read-only governance).
3. **Koblinger** — lenker til **AI governance** (`/backoffice/ai-control`), **runtime** (`/backoffice/runtime`), **modulposture** der allerede eksponert — uten å duplisere data.

## URL-struktur (U23)

| Rute | Formål |
|------|--------|
| `/backoffice/settings` | Hub: velg underflate |
| `/backoffice/settings/system` | Eksisterende systeminnstillinger (flyttet fra rot) |
| `/backoffice/settings/schema` | Document types + data type-katalog (read-only) |
| `/backoffice/settings/create-options` | Create flow + filter-forklaring |

## Prinsipper
- **Én** TopBar-post (`Settings`) — understier under samme «workspace».
- **Ingen** ny shell ved siden av `BackofficeShell` / `TopBar`.
- **Fail-closed**: schema-sider muterer ikke sannhet; system-siden beholder eksisterende API-kontrakter.
