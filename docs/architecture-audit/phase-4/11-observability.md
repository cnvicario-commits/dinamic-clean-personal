# 11 — Observabilidad

Los workflows emiten identificadores fijos, sin valores de secretos:

- `CD_CRISTIAN_PUBLISHED <servicio> <sha>`
- `CD_CRISTIAN_DEPLOY_REQUESTED <servicio> <sha>`
- `DEPLOY_CONFIRMED` o `DEPLOY_HEALTH_FAILED`
- `ROLLBACK_CONFIRMED` o `ROLLBACK_FAILED`
- `PRODUCTION_PORT_3005 <código>`
- `CD_PRODUCTION_PUBLISHED <sha>`
- `PRODUCTION_DEPLOY_CONFIRMED` o `PRODUCTION_HEALTH_FAILED`
- `PRODUCTION_DEPLOY_DISABLED`, `PRODUCTION_REF_REJECTED`, `PRODUCTION_CONFIRMATION_REJECTED`
- `MIGRATIONS_DISABLED` o `MIGRATIONS_TEST_APPLY_REQUESTED <sha>`

El actor de GitHub queda en el run. El workflow no tiene otro sistema de monitoreo conectado. No se encontró un colector existente al que hubiera que enviar estos eventos, y no se agregó uno.

Los scripts no imprimen el env file, la URL de migración, llaves, JWT ni cookies. El healthcheck público de Cristian sigue sin incluir secretos; al estar publicado en HTTP, no debe usarse como canal de diagnóstico con datos reales.

## Diagnóstico reproducible

En el servidor, cuando la activación ya esté hecha:

```bash
cat /opt/dinamic-clean-cristian/releases/current-sha
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' dinamic-clean-cristian-api
docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' dinamic-clean-cristian-frontend
curl -fsS http://127.0.0.1:3006/healthz
curl -fsS http://127.0.0.1:8086/api/healthz
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3005/healthz
```

Estos comandos no se ejecutaron en esta sesión.
