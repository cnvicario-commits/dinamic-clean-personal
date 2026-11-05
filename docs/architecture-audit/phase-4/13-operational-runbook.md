# 13 — Runbook de activación

Esta corrección no ejecuta el runbook.

## Antes de encender Cristian

1. Medir de nuevo CPU, memoria y disco.
2. Confirmar que la rama por defecto contiene `.github/workflows/cd-cristian.yml`. `workflow_run` usa ese archivo, no el de `cristian-pruebas`.
3. Proteger `main` y `cristian-pruebas`: PR, CI verde y sin push directo.
4. Crear el environment `cristian-pruebas` solo con secretos de Test.
5. Ejecutar, como root y fuera de esta sesión, los comandos que imprime `scripts/deploy/print-privileged-install.sh`.
6. Copiar los Compose revisados a `/opt/dinamic-clean-privileged/compose/`. No usar los archivos del checkout como ejecutables privilegiados.
7. Instalar la llave de Cristian con `command=` hacia `cristian-ssh` y `restrict`. No agregar la cuenta a `docker`. El permiso para recrear los dos contenedores de Cristian queda limitado a ese wrapper.
8. Recién entonces definir `CRISTIAN_DEPLOY_ENABLED=true`.

Un push a `cristian-pruebas` debe mostrar el CI verde y, después, el gate del CD para ese SHA. Si el CI falla, el CD registra `CRISTIAN_DEPLOY_SKIPPED` y no abre SSH.

## Producción

No encenderla junto con Cristian. Hace falta, además:

1. Required reviewers del environment `production`, o dejar `PRODUCTION_DEPLOY_ENABLED` sin definir si el plan no los ofrece.
2. Correr en el servidor los comandos de `scripts/deploy/production-readonly-diagnose.sh` y revisar la salida.
3. Colocar el Compose revisado en la ruta privilegiada y definir `PRODUCTION_COMPOSE_REVIEWED=operator-reviewed` solo después de esa lectura.
4. Completar el checklist de Vercel del documento 05. No crear un segundo deploy de frontend.
5. Despachar `cd-production` desde `main` con el texto `deploy-production`.

## Apagado y rollback

Vaciar la variable `*_ENABLED` detiene el job antes del environment. Retirar la línea de `authorized_keys` detiene el SSH. El rollback de un servicio usa su propio registro y no toca el otro. Si el registro dice `ROLLBACK_UNAVAILABLE`, no hay imagen anterior que restaurar: se conserva el estado y se interviene a mano.
