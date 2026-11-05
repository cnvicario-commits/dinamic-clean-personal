# Docker Compose

Archivo: `deploy/docker-compose.cristian.yml`.

Incluye proyecto `dinamic-clean-cristian`, imagen `dinamic-clean-api:<sha>`, red propia, publicación en `0.0.0.0` para el acceso HTTP por IP, `restart: unless-stopped`, healthcheck de `/readyz`, límites obligatorios de CPU y memoria, logs `json-file` de 10m por 5 archivos, usuario `10001:10001`, `no-new-privileges`, `cap_drop: ALL` y `MIGRATIONS_DATABASE_URL` vacío. No se enlaza `170.239.85.196` porque no se comprobó que exista en una interfaz local.

La CA de Supabase no entra en la imagen. `CRISTIAN_SUPABASE_CA_FILE` se monta solo lectura en `/app/certs/supabase-ca.crt`, con `create_host_path: false`. El proceso recibe `NODE_EXTRA_CA_CERTS` apuntando a ese archivo. En el VPS el archivo está en `/opt/dinamic-clean-cristian/certs/supabase-ca.crt`.

`scripts/check-cristian-compose.sh` solo renderiza la sintaxis con un certificado temporal. `docker compose config` no sustituye al preflight. El despliegue pasa por `scripts/preflight-cristian-deploy.sh`, que exige un X.509 real y rechaza una CA ausente, vacía, inválida, con clave privada o ubicada en producción. `scripts/redeploy-cristian-api.sh` llama a ese preflight antes de recrear el contenedor.

## Imagen

`apps/api/Dockerfile` sigue siendo el único Dockerfile de la API. Acepta `APP_RELEASE_SHA` y lo deja en el entorno. El build de prueba usó `abc1234`.

Comprobado en esa imagen, que después se borró:

- usuario `dinamic`
- el historial de build no contiene `service_role`, `password`, `postgres://` ni `secret`
- `GET /healthz` respondió `200` y `{"status":"ok","release":"abc1234"}`
- `GET /readyz` respondió `503` contra un Postgres inalcanzable, así que no declara listo sin base
- `SIGTERM` terminó el proceso con código 0

No se apuntó esa imagen a Supabase Test ni a producción. `/readyz` 200 contra Test sigue siendo el de la fase 1, con el mismo código de probes, fuera de esta imagen.
