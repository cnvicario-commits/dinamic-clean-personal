# 01 — Estado actual

Fecha de relevamiento local: 2026-11-05. Rama de trabajo: `DIN-417`. No se modificó el VPS, Vercel, GitHub ni Supabase.

## Repositorio

Remote: `https://github.com/cnvicario-commits/dinamic-clean-personal.git`.

`gh auth status` responde que no hay sesión. No se pudieron leer rulesets, environments, el plan de GitHub ni los deployments de Vercel. No existe `.vercel/project.json` y la CLI `vercel` no está instalada. La conexión real del repositorio con Vercel queda `NOT_VERIFIED`.

El CI previo es `.github/workflows/ci.yml`: push a `main`/`master`, todo pull request, permiso `contents: read`, sin environment y sin secretos. No había workflow de despliegue.

## Cristian

El usuario informa que el frontend y el backend ya están desplegados, que el acceso externo responde y que validó el login manualmente. Esta sesión no volvió a medir el VPS ni repitió ese login. La medición anterior del servidor, 16 CPU, 31 GiB de RAM y disco libre, no se repitió porque esta fase no aplica cambios en el servidor. Hay que medir de nuevo antes de activar el despliegue.

Direcciones vigentes, por decisión del usuario y sin HTTPS:

- Frontend: `http://170.239.85.196:8086`
- API: `http://170.239.85.196:3006`
- Supabase Test: `edruejzwwnixsjsadbgb`

Esa publicación HTTP no protege credenciales ni datos reales.

## Producción

La API productiva sigue en el contenedor `dinamic-clean-api`, puerto `3005`, detrás de Nginx y HTTPS. El frontend productivo sigue en Vercel. Supabase producción: `biectbcujabpjhinouil`.

`deploy/docker-compose.api.yml` es el Compose local de la API. No es la definición verificada del proceso que corre en `/opt/dinamic-clean`. Esta fase no lo convierte en el Compose productivo ni toca Nginx.

## Migraciones

Hay 28 archivos SQL en `supabase/migrations/forward/`. El runner `scripts/apply-forward-migrations.sh` rechaza el proyecto productivo antes de conectar. No se ejecutó contra ninguna base.
