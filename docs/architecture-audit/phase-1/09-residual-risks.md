# 09 — Riesgos residuales

| Id | Estado | Efecto |
|----|--------|--------|
| `TEST_MIGRATIONS_PENDING` | Abierto | Supabase Test tiene 21 migraciones. El código actual no puede crear pedidos ni órdenes de compra de forma idempotente contra esa base, y `anon`/`authenticated` siguen con DML sobre `empresas`. |
| `TEST_BACKUP_UNPROVEN` | Abierto | No hay ensayo de restauración. Sin eso no se aplican las siete migraciones. |
| `PRODUCTION_RECHECK_BLOCKED` | Abierto en esta sesión | El conteo de producción no se releyó. La evidencia vigente es la de la fase 0. |
| `GITHUB_BRANCH_PROTECTION_DEFERRED` | Aceptado para esta fase | Sin rulesets, un PR puede entrar aunque el CI falle. Lo cubre la revisión manual. No autoriza secretos de producción. |
| `VPS_UNREAD` | Abierto | No se puede dimensionar el segundo contenedor ni confirmar el ref que usa el API publicado. |
| `VERCEL_UNREAD` | Abierto | No se confirma Production Branch, dominios ni variables. El proyecto de demo no se crea todavía. |
| `GH_UNAUTHENTICATED` | Abierto | Environments, nombres de secrets y GHCR no se listaron. |
| `SHARED_TEST_DATABASE` | Aceptado | Local de Cristian, local del responsable y la futura demo escriben en el mismo proyecto. Un ensayo destructivo en local afecta la demo. Los tests automáticos ya no usan esa base. |
| `CI_DOCKER_ON_GITHUB` | Por ver en el primer PR | El job de integración pasó en esta máquina. Falta verlo en `ubuntu-latest`. |
| `RESTORE_CONFIRMATION` | Cerrado en el código | `restore-development.sh` rechaza producción, Test, poolers y hosts ambiguos. `I_CONFIRM_DISPOSABLE` no cambia el resultado. |

No queda un camino en `npm test` que abra el pooler de test o el host de producción. El servidor de desarrollo sí puede seguir usando Test, que es la decisión de la fase.
