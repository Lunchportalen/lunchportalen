# CMS — Week / menu publish chain

**Dato:** 2026-03-29

```
Sanity: menu documents
        ↓ (GROQ / getMenusByMealTypes / menuContent)
GET /api/week  +  company_current_agreement (ACTIVE)
        ↓
Employee week UI
```

**Ikke i kjeden:** Sanity `weekPlan` → employee order (primær).

**Redaksjonelt spor:** `weekPlan` + superadmin publish API — separat.

**Preview/publish:** Content pages bruker Postgres publish; meny bruker Sanity-tilgjengelighet — **to lag**, begge dokumentert i UI.
