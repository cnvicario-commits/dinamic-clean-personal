# 06 — Seguridad del despliegue en el VPS

No se crearon usuarios ni se editó `sudoers`, SSH o el firewall. Ninguna cuenta se agrega al grupo `docker`.

Los comandos SSH ejecutan binarios bajo `/opt/dinamic-clean-privileged/bin`. `scripts/deploy/authorized-command.sh` y `scripts/deploy/production-authorized-command.sh` rechazan cualquier otra cadena. La variable que apunta a otro directorio solo se honra en el modo de fixture de pruebas. El script termina si su propia ruta está dentro de `/opt/dinamic-clean` o `/opt/dinamic-clean-cristian`. `/opt/dinamic-clean-cristian` no se confunde con la raíz productiva.

`scripts/deploy/print-privileged-install.sh` imprime la instalación con propietario root y modo `755` para binarios y `700` para el estado y `/etc/dinamic-clean`. No copia archivos y no se ejecutó. El checkout de la aplicación no es el origen de los scripts en tiempo de ejecución. El estado vive en `/var/lib/dinamic-clean`. Los secretos siguen fuera de Git.

`AcceptEnv` no debe permitir cambiar la ruta privilegiada. Cada entorno conserva su propia llave. La de Cristian no acepta `production-apply`.
