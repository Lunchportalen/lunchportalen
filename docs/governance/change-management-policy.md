# 🔄 CHANGE MANAGEMENT POLICY

---

# 1️⃣ KRAV

Alle endringer skal:

- Skje via PR
- Gjennomgå code review
- Passere CI guard
- Dokumenteres i ADR ved arkitekturendring

---

# 2️⃣ PRODUKSJON

- Ingen direkte DB-endringer
- Ingen hotfix uten logging
- Preflight før deploy

---

# 3️⃣ LOGG

Alle produksjonsendringer logges.
