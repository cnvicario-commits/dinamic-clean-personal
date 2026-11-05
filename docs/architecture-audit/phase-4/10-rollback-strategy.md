# 10 — Rollback

## Cristian

`scripts/deploy/cristian-remote-apply.sh` guarda `releases/previous-sha` antes de recrear. Si el healthcheck falla, ejecuta `scripts/deploy/cristian-remote-rollback.sh` con ese SHA y el servicio anterior. El rollback exige que la imagen local siga presente, vuelve a pasar el preflight y comprueba el healthcheck. El archivo `releases/rolling-back` hace que una segunda entrada salga con `ROLLBACK_REJECTED already_running`. El lock `releases/deploy.lock` rechaza otro despliegue simultáneo.

No se probó este recorrido sobre contenedores. Estado: `NOT_VERIFIED`.

## Producción

`scripts/deploy/production-remote-apply.sh` conserva el SHA anterior y, si `127.0.0.1:3005/healthz` no contiene el SHA nuevo, llama a `scripts/deploy/production-remote-rollback.sh`. El rollback no ejecuta SQL. Si una migración ya se aplicó, restaurar la imagen anterior solo es válido cuando esa versión de la API sigue siendo compatible con el esquema. Esa decisión queda para el operador; el script no la infiere.

El frontend de Vercel no se promociona ni se revierte desde estos scripts. Si la API se restaura, el estado del frontend tiene que revisarse en Vercel con el mismo SHA anterior. La forma concreta de hacerlo sigue `NOT_VERIFIED` porque no se leyó el proyecto.

No hay borrado automático de la imagen anterior ni rollback destructivo de la base.
