# 04 — Migraciones de Supabase Test

Estado: `BLOCKED`. No se escribió en ninguna base cloud.

## Antes, leído en esta ejecución

Proyecto `edruejzwwnixsjsadbgb`:

| Dato | Valor |
|------|-------|
| `app_migrations.forward_history` | 21 |
| `auth.users` | 15 |
| `public.perfiles` | 15 |
| Las siete migraciones listadas abajo | ninguna registrada |
| `purchase_operation_idempotency_operation_check` | solo `purchase_request_import` y `purchase_order_generate` |
| `dinamic_api` sobre `empresas` | `SELECT` |
| `anon` y `authenticated` sobre `empresas` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |

Pendientes, sin cambiar su SQL histórico:

1. `20261008120000_production_schema_reconciliation.sql`
2. `20261030140000_empresas_api_write_grants.sql`
3. `20261030160000_auth_compensation_jobs.sql`
4. `20261030161000_create_idempotency.sql`
5. `20261030170000_auth_compensation_claim.sql`
6. `20261030171000_company_create_idempotency.sql`
7. `20261030172000_purchase_order_create_idempotency.sql`

Esas siete se aplicaron en la base efímera del CLI, no en Test. El check de compras y los grants de `empresas` del proyecto cloud siguen en el estado anterior.

## Producción

Una consulta de solo lectura a `biectbcujabpjhinouil` fue rechazada por el control de esta sesión y no se reintentó. El último conteo verificado sigue siendo el de `phase-0-closure/04-supabase-schema-validation.md`: 28 migraciones, 13 usuarios Auth, 13 perfiles. Esta ejecución no volvió a demostrarlo y no escribió en producción.

## Backup

No hay evidencia de un backup de Test ni de una restauración de ensayo sobre un destino desechable. Un archivo de backup, si existiera, no alcanza.

## Comando preparado y no ejecutado

Después de un backup restaurado con éxito en un destino desechable, y con aprobación explícita del responsable técnico, el único runner es:

```bash
# MIGRATIONS_DATABASE_URL debe resolver al ref edruejzwwnixsjsadbgb.
# Rechazar la ejecución si el ref es biectbcujabpjhinouil.
./scripts/apply-forward-migrations.sh
```

No hay rollback automático. Si una de las siete falla a mitad de camino, se detiene y se informa el archivo. No se toca producción para “reparar” Test.

## Después

No aplica. Test sigue en 21 migraciones.
