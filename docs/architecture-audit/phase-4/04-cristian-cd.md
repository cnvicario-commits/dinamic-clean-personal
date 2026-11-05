# 04 — Despliegue de Cristian

Archivo: `.github/workflows/cd-cristian.yml`.

No se dispara con un push. El despliegue automático usa `workflow_run` cuando termina el workflow `ci`. GitHub ejecuta ese archivo desde la rama por defecto del repositorio, no desde el YAML que haya en `cristian-pruebas`. Un `workflow_dispatch` solo se admite desde `refs/heads/main`. El gate recibe la conclusión, el evento, la rama, el SHA y el repositorio que devolvió la corrida de CI, no valores escritos a mano.

`scripts/ci/evaluate-cristian-deploy-gate.mjs` deja seguir el deploy únicamente cuando se cumplen todas estas condiciones:

- el repositorio y `head_repository` son `cnvicario-commits/dinamic-clean-personal`;
- el workflow se llama `ci` y su conclusión es `success`;
- el evento de origen es `push` a `cristian-pruebas`;
- el SHA tiene 40 hexadecimales y es el mismo que se construye y se envía por SSH.

Una conclusión `failure`, `cancelled` o un pull request producen `CRISTIAN_DEPLOY_SKIPPED` y no publican. Un fork o un SHA distinto producen `CRISTIAN_DEPLOY_REJECTED`. El job de publicación y el de SSH siguen apagados mientras `CRISTIAN_DEPLOY_ENABLED` no sea `true`.

## Salud

`/healthz` debe responder HTTP 200 y `{ "status": "ok", "release": "<sha>" }`. `/readyz` debe responder HTTP 200 y `{ "status": "ready" }`. `status=ok` en `/readyz` es un fallo. El frontend valida `/api/healthz`: HTTP 200, `status=ok`, el SHA y `deployment=cristian-pruebas`. No consulta la API, así que una API caída no provoca rollback del frontend.

La sonda tiene tres intentos y un timeout de tres segundos. Un HTTP 503 o un timeout fallan.

## Estado

Cada servicio tiene su archivo en `/var/lib/dinamic-clean/cristian/<servicio>.json`, con SHA, imagen, digest, fecha, resultado, run id y el release anterior. El registro se escribe con un archivo temporal y `rename`. Un intento fallido queda en `lastFailed` y no reemplaza `current`. El run id debe ser mayor que el ya registrado; si no, el resultado es `stale_run`. El mismo SHA, digest y run id es idempotente.

La imagen se descarga por digest. Si el digest inspeccionado no coincide, no se recrea el contenedor.

## Rollback

Si el fallo ocurre antes de recrear, no hay rollback. Si ocurre después, se restaura la imagen de `current` de ese servicio y el registro no se marca exitoso hasta que el contenedor responde el SHA restaurado. Si no hay un release exitoso, el resultado es `ROLLBACK_UNAVAILABLE` y el registro no se borra. El rollback de operador usa `previous` de ese servicio y deja el release saliente en `previous`. `docker compose config` tiene que mostrar la imagen verificada antes de recrear.
