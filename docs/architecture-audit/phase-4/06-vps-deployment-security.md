# 06 — Seguridad del despliegue en el VPS

No se crearon usuarios ni se editó `sudoers`, SSH o el firewall. Ninguna cuenta se agrega al grupo `docker`.

Los comandos SSH ejecutan binarios bajo `/opt/dinamic-clean-privileged/bin`. `scripts/deploy/authorized-command.sh` y `scripts/deploy/production-authorized-command.sh` rechazan cualquier otra cadena. Una ruta privilegiada de prueba solo se acepta con `DINAMIC_DEPLOY_FIXTURE=1` o `DINAMIC_DISPOSABLE_DOCKER=1`. Sin eso, el script exige que su ruta canónica esté dentro de `/opt/dinamic-clean-privileged`. Un prefijo textual, un `..` o un symlink que resuelva en un checkout se rechazan.

`scripts/deploy/print-privileged-install.sh` imprime la instalación y, si se le pasa `--apply-to`, copia los shells, los módulos Node, `load-cristian-deploy-env.sh`, el lock y los Compose de Cristian. Sin ese argumento no copia nada. No se ejecutó sobre el VPS. El checkout de la aplicación no es el origen de los scripts en tiempo de ejecución. El estado vive en `/var/lib/dinamic-clean`. Los secretos siguen fuera de Git. El lock de cada servicio es un `flock` que el proceso mantiene desde el plan hasta el commit o el registro del fallo.

`AcceptEnv` no debe permitir cambiar la ruta privilegiada. Cada entorno conserva su propia llave. La de Cristian no acepta `production-apply`.
