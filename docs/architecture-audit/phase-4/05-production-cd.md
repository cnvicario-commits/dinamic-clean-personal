# 05 — Despliegue de producción

Archivo: `.github/workflows/cd-production.yml`.

No tiene trigger `push` ni `pull_request`. Solo `workflow_dispatch`. El primer job falla si la ref no es `refs/heads/main`, si la confirmación escrita no es `deploy-production`, o si `PRODUCTION_DEPLOY_ENABLED` no vale `true`. Esa variable no está definida, así que una ejecución hoy terminaría en `PRODUCTION_DEPLOY_DISABLED` antes de usar el environment.

Los jobs siguientes usan el environment `production`. Publican únicamente:

`ghcr.io/<owner>/dinamic-clean-api:production-<sha>`

El build no recibe `APP_DEPLOYMENT_ENV=cristian-pruebas` ni variables de Supabase Test. El comando remoto es `production-apply <sha>`. El script solo acepta `/opt/dinamic-clean`, exige que el Compose existente publique `3005` y rechaza si ese archivo contiene el ref de Test, `cristian-pruebas`, `3006` u `8086`. No modifica Nginx.

## Aprobaciones

No se pudo comprobar si el plan del repositorio ofrece required reviewers. `gh` no tiene sesión. La alternativa implementada es el despacho manual, la confirmación literal y la variable apagada. Eso evita un despliegue automático. No equivale a una aprobación de otra persona si un administrador enciende la variable y despacha el workflow. La protección del environment queda pendiente y es `NOT_VERIFIED`.

## Vercel

No se agregó `vercel deploy` ni un segundo pipeline de frontend. El frontend productivo debe seguir el mecanismo que ya tenga Vercel sobre `main`. Cuál es la rama productiva, si hay preview y si un merge ya despliega solo, no se pudo leer. Estado: `NOT_VERIFIED`. Hasta conocerlo, activar el workflow de API no debe acompañarse de otra publicación del frontend.
