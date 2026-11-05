# 09 — Checklist de ejecución

Para la implementación posterior. Nada de esta lista se ejecutó en la fase 0, salvo las lecturas ya citadas en `10-blockers-and-evidence.md`.

## Antes de tocar test

- [ ] Backup del proyecto `edruejzwwnixsjsadbgb` restaurado en una base desechable.
- [ ] `MIGRATIONS_DATABASE_URL` de esa corrida tiene ref `edruejzwwnixsjsadbgb` y no `biectbcujabpjhinouil`.
- [ ] Después del runner, `forward_history` tiene 28 filenames y los checksums iguales a los del repo.
- [ ] El check de `purchase_operation_idempotency` incluye `purchase_order_create` y `purchase_request_create`.
- [ ] Grants de `empresas`: `dinamic_api` INSERT/UPDATE/SELECT. `anon` sin DML. `authenticated` solo SELECT.
- [ ] `count(*)` de `auth.users` en producción sigue en 13. No se restauró producción encima de test.

## Tests

- [ ] `npm test` de `apps/api` con las variables de `apps/api/.env` exportadas no abre el pooler de us-west-2 ni el de sa-east-1.
- [ ] La misma suite en modo simulation contra `127.0.0.1` ejecuta al menos un test de integración y termina.
- [ ] El job de CI falla si `supabase start` falla. No queda en skipped.

## Host y frontend, cuando haya acceso

- [ ] El script de `01-vps-verification.md` corrido y archivado sin secretos.
- [ ] Segundo stack con puerto, usuario y ref distintos. `/readyz` de los dos dominios en 200.
- [ ] Proyecto Vercel nuevo. Bundle sin el ref `biectbcujabpjhinouil`.
- [ ] Dominio de pruebas cargado en Auth del proyecto test.

## GitHub

- [ ] `gh auth status` con sesión.
- [ ] Protection o ruleset de `main` y de `auditoria-nasser` leídos.
- [ ] Environments `cristian-pruebas` y `production` con nombres de secretos disjuntos.
- [ ] El workflow que tiene la llave SSH está en `main`.
- [ ] Un PR que renombra el check obligatorio no logra ponerse en verde por su cuenta.

## Promoción de ensayo

- [ ] Rama `DIN-xxx` creada desde `main`.
- [ ] PR a `auditoria-nasser` con checks del merge ref.
- [ ] Merge a `main` y deploy del SHA de `main`, por digest.
- [ ] Merge de `main` hacia `cristian-pruebas` sin rebase.
