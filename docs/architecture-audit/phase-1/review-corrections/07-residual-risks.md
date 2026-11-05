# 07 — Riesgos que siguen

| Riesgo | Estado |
|--------|--------|
| Supabase Test en 21 migraciones | Abierto. Sigue haciendo falta backup restaurable y aprobación. Esta corrección no lo declara cerrado. |
| `results-postgres` 409 contra 502 en una base vacía | Abierto para la fase 6. La suite no se aflojó. |
| 74 pruebas de integración fuera del CLI | Abiertas para la fase 6. Inventario en `04-integration-coverage.md`. |
| Job de GitHub no visto en `ubuntu-latest` | Abierto hasta el primer PR con `gh` autenticado. El esquema local pasó actionlint. |
| `LOCAL_SUPABASE_ALREADY_RUNNING` | Implementado, no ejercitado en esta sesión. |
| VPS, Vercel productivo y rulesets | Siguen sin lectura. `GITHUB_BRANCH_PROTECTION_DEFERRED`. |
| Base Test compartida entre local y la futura demo | Decisión vigente. El runner de tests no la usa. |
