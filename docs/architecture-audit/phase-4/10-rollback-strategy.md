# 10 — Rollback

## Cristian

El frontend y la API tienen registros separados. Un fallo del frontend restaura solo la imagen anterior del frontend. La API permanece en su propio SHA.

Antes de recrear el contenedor, un fallo no cambia `current`. Después de recrearlo, la recuperación vuelve a la imagen de `current` y solo entonces deja el registro como estaba. El rollback de operador recrea solo el servicio pedido, comprueba el digest, el health y el SHA, y recién ahí intercambia `current` y `previous`. Si la imagen, el digest o el health fallan, `current` y `previous` no cambian y el intento queda en `lastFailed`. No hay un segundo rollback automático. El historial sigue en `events.jsonl`.

Un deploy exitoso deja el release anterior en `previous`. Un rollback exitoso deja el release del que se salió en `previous`, así un rollback posterior puede volver a él. El deploy siguiente usa como `previous` el release que estaba corriendo, no uno más viejo.

Un run id menor que el ya desplegado se rechaza. El `flock` del servicio cubre plan, pull, recreación, health y commit. El segundo proceso sale con `OPERATION_REJECTED locked` y no toca Docker ni el registro.

## Producción

El mismo modelo aplica al servicio `api` bajo `/var/lib/dinamic-clean/production`. El script no recrea el contenedor hasta que el Compose privilegiado fue revisado. Restaurar el contenedor no ejecuta SQL, no toca Nginx y no toca Vercel. Si existe `schema-incompatible` en el directorio de estado, o `/readyz` informa incompatibilidad de esquema, el script se detiene con `PRODUCTION_ROLLBACK_REQUIRES_HUMAN` y no recrea la imagen anterior.

El frontend de Vercel no se revierte desde aquí. `VERCEL_INTEGRATION_NOT_VERIFIED`.

`scripts/deploy/adopt-release.sh` puede registrar un contenedor que ya está healthy, sin recrearlo. Exige SHA, puerto, entorno y un digest que Docker ya reporte. Si falta el digest, no inventa uno y pide intervención manual. Producción exige `ADOPT_PRODUCTION_AUTHORIZED=operator-authorized`. No se ejecutó en el VPS.
