# 07 — Secretos y entornos

No se crearon secrets ni variables en GitHub. No hay valores en el repositorio. Un workflow de pruebas no declara el environment `production`, y el de producción no declara `cristian-pruebas`. Esa separación queda comprobada sobre los archivos por `scripts/ci/check-workflow-isolation.mjs`. La aplicación real de GitHub Environments queda `NOT_VERIFIED`.

Los secretos productivos no se guardan como secrets de repositorio. Si se guardaran ahí, cualquier workflow podría leerlos.

## Variable de repositorio

- `CRISTIAN_DEPLOY_ENABLED`
- `CRISTIAN_MIGRATIONS_ENABLED`
- `PRODUCTION_DEPLOY_ENABLED`

Las tres permanecen ausentes. Ausente significa apagado.

## Environment `cristian-pruebas`

Variables:

- `CRISTIAN_NEXT_PUBLIC_SUPABASE_URL`
- `CRISTIAN_NEXT_PUBLIC_API_URL`

Secrets:

- `CRISTIAN_NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CRISTIAN_DEPLOY_SSH_KEY`
- `CRISTIAN_DEPLOY_KNOWN_HOSTS`
- `CRISTIAN_DEPLOY_HOST`
- `CRISTIAN_DEPLOY_USER`
- `CRISTIAN_MIGRATIONS_DATABASE_URL`

## Environment `production`

Secrets:

- `PRODUCTION_DEPLOY_SSH_KEY`
- `PRODUCTION_DEPLOY_KNOWN_HOSTS`
- `PRODUCTION_DEPLOY_HOST`
- `PRODUCTION_DEPLOY_USER`

No incluye URL ni claves de Supabase Test. La configuración de Vercel no se copia a este environment.

## Archivos del servidor, fuera de Git

`/opt/dinamic-clean-cristian/deploy.env` solo puede contener las claves que acepta `scripts/deploy/load-cristian-deploy-env.sh`. Una clave desconocida detiene el script. `/opt/dinamic-clean/deploy.env` solo acepta `PRODUCTION_COMPOSE_FILE` y `PRODUCTION_REGISTRY`.

Los workflows no imprimen esas variables. El paso SSH falla con `CRISTIAN_DEPLOY_NOT_CONFIGURED` o `PRODUCTION_DEPLOY_NOT_CONFIGURED` si falta alguno, sin mostrar el contenido. La clave anónima del frontend es pública por diseño; el guardia rechaza una clave `service_role`. Aun así, BuildKit puede conservar un build arg en el historial de la imagen. No se pasa service role, contraseña ni connection string como build arg.
