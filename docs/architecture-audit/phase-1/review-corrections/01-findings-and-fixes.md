# 01 — Hallazgos y correcciones

| # | Hallazgo | Clase | Acción |
|---|----------|-------|--------|
| 1 | `defaults.run.working_directory` no existe en el esquema de GitHub Actions. El job `api` no entraba en `apps/api`. | must fix | Cambiado a `working-directory`. `actionlint` exit 0. |
| 2 | `I_CONFIRM_DISPOSABLE=yes` permitía un restore destructivo contra producción y contra Supabase Test. | must fix | El restore solo acepta loopback sin ref cloud. La variable se ignora. |
| 3 | El script efímero hacía `supabase stop` aunque el stack ya estuviera levantado por otra persona, y ejecutaba `source` del archivo de status. | should fix | Si el stack ya está arriba, sale con `LOCAL_SUPABASE_ALREADY_RUNNING` y no lo detiene. El status se parsea línea a línea y el temporal se borra. |
| 4 | El chequeo de host no rechazaba un ref de producción o de test pegado a `127.0.0.1` antes del `DROP SCHEMA`. | should fix | `scripts/disposable-target.mjs` corre antes del drop y dentro del runner. |
| 5 | `results-postgres` contra el CLI devolvió 409 donde la suite espera 502. | should fix | No se cambió la aserción. La suite no entra al job. |
| 6 | La arquitectura todavía mandaba el frontend de Cristian a un segundo proyecto Vercel. | must fix | Documentación de arquitectura y roadmap actualizada. No se crea ese proyecto. |

Quedó fuera: aplicar las siete migraciones de Supabase Test, leer el VPS y configurar rulesets. No hay evidencia nueva que los desbloquee, y esta revisión no los pide como cambio de código.
