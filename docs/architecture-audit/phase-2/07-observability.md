# Observabilidad

El contenedor demo escribe sus propios logs `json-file`, con rotación de 10 MB y 5 archivos. No comparte el log del contenedor productivo.

La API ya genera `X-Request-Id`. Pino elimina `authorization`, `DATABASE_URL`, `MIGRATIONS_DATABASE_URL`, la service role, JWT y campos de contraseña.

`/healthz` ahora responde:

```json
{"status":"ok","release":"<sha>"}
```

Si no hay SHA, `release` es `unknown`. No incluye project ref ni configuración. `/readyz` sigue comprobando Postgres, el módulo de usuarios y las capacidades de perfiles y HR. El healthcheck de Compose pega a `/readyz`.

CPU, RAM y reinicios se miran con `docker stats` y `docker inspect` del contenedor `dinamic-clean-cristian-api`, no del resto del host. Esos comandos están en el runbook y no se ejecutaron en el VPS.
