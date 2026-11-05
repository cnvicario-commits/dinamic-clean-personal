# 10 — Rollback

## Cristian

El frontend y la API tienen registros separados. Un fallo del frontend restaura solo la imagen anterior del frontend. La API permanece en su propio SHA.

Antes de recrear el contenedor, un fallo no cambia `current`. Después de recrearlo, la recuperación usa la imagen y el digest de `current`. Si ese registro no existe, el comando sale con `ROLLBACK_UNAVAILABLE` y conserva `lastFailed`. No reconstruye una imagen antigua y no borra el historial `events.jsonl`.

Un run id menor que el ya desplegado se rechaza. Dos escritores del mismo servicio no entran juntos: el segundo recibe `locked`.

## Producción

El mismo modelo aplica al servicio `api` bajo `/var/lib/dinamic-clean/production`. El script no ejecuta Docker hasta que el Compose privilegiado fue revisado. Restaurar el contenedor no ejecuta SQL. Si el esquema ya avanzó, la imagen anterior solo vuelve a ser usable cuando sigue siendo compatible. Esa decisión no la toma el script.

El frontend de Vercel no se revierte desde aquí. `VERCEL_INTEGRATION_NOT_VERIFIED`.
