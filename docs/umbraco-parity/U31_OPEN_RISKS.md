# U31 open risks

1. **`content_audit_log` kan mangle** — historikk er mer synlig, men fortsatt degradert når tabell/migrasjon ikke finnes.
2. **Historikk er fortsatt todelt** — audit-helse og versjonsvisning er ikke én fullt samlet Bellissima-arbeidsflate ennå.
3. **Document type / data type er fortsatt code-governed** — settings er operativ, men ikke full CRUD som i Umbraco.
4. **Repoet har fortsatt flere lint-advarsler** — ikke blokkerende nå, men de øker støynivået i videre arbeid.
5. **Manuell browser-QA mangler for denne siste passeringen** — spesielt content landing, editor apps og settings bør klikkes gjennom før merge.
