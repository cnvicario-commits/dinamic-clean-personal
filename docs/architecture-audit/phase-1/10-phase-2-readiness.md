# 10 — Listo para la fase 2

La fase 2 es el segundo stack del backend para `cristian-pruebas`. No empieza con el código de esta fase. Empieza cuando se cumplan estas condiciones.

## Puede empezar el diseño, no el deploy

- El aislamiento de `npm test` ya está y el CLI efímero ya corrió una suite real en local.
- El workflow de PR no recibe secretos. El deploy privilegiado sigue fuera de alcance y, cuando exista, tiene que ser un `workflow_run` definido en `main`.

## Antes de crear los contenedores del VPS

1. Un administrador ejecuta `scripts/recon-vps-readonly.sh` y se confirma RAM libre, el puerto 3001, el vhost y que el ref del contenedor actual es el de producción, no el de test.
2. Un administrador lee el proyecto Vercel productivo: Production Branch, dominios y nombres de variables. No se crea un segundo proyecto Vercel. El frontend de Cristian va a un contenedor del mismo VPS.
3. `gh auth login` y lectura de environments. El environment de demo, cuando se cree, lleva solo credenciales de `edruejzwwnixsjsadbgb`. El de producción no entra a un workflow cuyo YAML viva en `cristian-pruebas`.
4. Decisión explícita sobre las siete migraciones de Test: backup restaurado en un destino desechable, aprobación, y `./scripts/apply-forward-migrations.sh` solo contra ese ref. Sin eso, la demo no ejerce compras idempotentes ni el grant nuevo de `empresas`.
5. El primer PR con el job `api-integration` se ve verde en GitHub, no solo en esta máquina.

## Sigue fuera de la fase 2 inicial

- Rebase o reset de `cristian-pruebas`.
- Rulesets, hasta que el responsable tenga permiso. Mientras tanto, `GITHUB_BRANCH_PROTECTION_DEFERRED` y revisión manual.
- Attendance y cualquier dual-write.
- Una tercera base cloud para el desarrollo local.
