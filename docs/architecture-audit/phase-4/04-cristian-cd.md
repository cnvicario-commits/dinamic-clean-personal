# 04 — Despliegue de Cristian

Archivo: `.github/workflows/cd-cristian.yml`.

Trigger: push a `cristian-pruebas` o `workflow_dispatch`. Concurrencia `cristian-deploy`, sin cancelar un despliegue en curso. Permisos: lectura del repo y escritura de paquetes.

El job de publicación y el de despliegue solo arrancan si la variable de repositorio `CRISTIAN_DEPLOY_ENABLED` vale `true` y el diff toca API, frontend o ambos. Un cambio solo de documentación selecciona `services=none` y no recrea contenedores. Esa variable no está definida. Los jobs quedan omitidos hasta la activación.

## Publicación

Environment GitHub: `cristian-pruebas`. No referencia el environment `production` ni el ref productivo.

- API: `ghcr.io/<owner>/dinamic-clean-api:cristian-<sha>`
- Frontend: `ghcr.io/<owner>/dinamic-clean-frontend:cristian-<sha>`

El frontend pasa antes por `scripts/assert-cristian-frontend-env.mjs build`. Las variables públicas de Next quedan fijadas en la imagen. No existe tag `latest`. El workflow no fue ejecutado y no publicó imágenes.

## Despliegue

El job usa SSH con `StrictHostKeyChecking=yes` y un `known_hosts` secreto. El comando remoto permitido es `cristian-apply api|frontend|both <sha>`. El script de destino es `scripts/deploy/cristian-remote-apply.sh`, que solo acepta el checkout `/opt/dinamic-clean-cristian`, toma un lock, conserva el SHA anterior y llama a los preflight y redeploy existentes. `CRISTIAN_NO_BUILD=1` evita reconstruir otra imagen bajo el mismo SHA.

Después exige `/healthz` y `/readyz` en el puerto 3006, o `/api/healthz` y `/login` en el 8086, con el SHA publicado. Si falla y hay un SHA anterior, llama una sola vez a `scripts/deploy/cristian-remote-rollback.sh`. Un marcador `rolling-back` impide repetir el rollback. Al final consulta `127.0.0.1:3005/healthz` y falla si producción no responde 200. No cambia archivos productivos ni borra la red `dinamic-clean-cristian`.

Este script no se copió al VPS y no se ejecutó contra los contenedores. Estado del despliegue real: `NOT_VERIFIED`.
