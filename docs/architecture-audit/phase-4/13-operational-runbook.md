# 13 — Runbook de activación

Esta fase deja los archivos listos y no ejecuta este runbook. El orden es el de activación posterior. No incluye cambios de firewall, Nginx, DNS ni HTTPS de Cristian.

## Antes de tocar el VPS

1. Medir CPU, memoria y disco. La medición anterior no se repite aquí.
2. Confirmar que `/opt/dinamic-clean-cristian` y `/opt/dinamic-clean` siguen siendo directorios distintos.
3. Crear en GitHub los environments `cristian-pruebas` y `production`.
4. Cargar solo los nombres del documento 07. No usar secrets de repositorio para producción.
5. Activar required reviewers en `production`. Si el plan no los ofrece, dejar `PRODUCTION_DEPLOY_ENABLED` sin definir y no usar el workflow productivo.
6. Proteger `main` y `cristian-pruebas`: PR obligatorio, CI verde y sin push directo.
7. Crear dos llaves SSH. Instalar cada pública con `command=` a su wrapper y `restrict`. No agregar la cuenta a `docker`. El permiso para Compose tiene que quedar limitado a los scripts del checkout correspondiente.
8. Copiar el checkout de `main` ya promovido. Crear `deploy.env` fuera de Git, con el allowlist del loader. Permiso de lectura solo para la cuenta de despliegue.

## Cristian

1. Integrar `main` en `cristian-pruebas` con merge.
2. Definir `CRISTIAN_DEPLOY_ENABLED=true` solo después de los pasos anteriores.
3. El push publica el tag `cristian-<sha>` y ejecuta `cristian-apply` del servicio afectado.
4. Verificar los comandos del documento 11. Confirmar que el contenedor `dinamic-clean-api` del puerto 3005 conserva su imagen anterior.
5. Para volver atrás sin reconstruir: `cristian-rollback <servicio> <sha anterior>`, con la imagen todavía presente.

## Producción

1. Merge autorizado a `main`.
2. Observar el despliegue que Vercel ya tenga configurado. No lanzar otro.
3. Con reviewers activos, despachar `cd-production` desde `main` y escribir `deploy-production`.
4. Definir `PRODUCTION_DEPLOY_ENABLED=true` solo en ese momento.
5. El script usa el Compose que ya está en el servidor y el puerto 3005. No reemplaza Nginx.
6. Si `/healthz` no coincide con el SHA, el script intenta el SHA anterior. No toca la base.

## Migraciones de Test

Despachar `cd-migrations` con `migrate-test` solo cuando `CRISTIAN_MIGRATIONS_ENABLED=true` y el secret apunte al proyecto `edruejzwwnixsjsadbgb`. El runner aborta si el URL contiene el ref productivo. No forma parte del push de aplicación.

## Apagado

Borrar o vaciar la variable `*_ENABLED` detiene el job antes del environment. Retirar la línea de `authorized_keys` detiene el SSH aunque la variable siga encendida.
