# 06 — Seguridad del despliegue en el VPS

No se crearon usuarios, no se editó `sudoers`, SSH ni el firewall, y no se agregó ninguna cuenta al grupo `docker`. El acceso al daemon equivale a root; el diseño no usa ese grupo como aislamiento.

## Preparado y no instalado

Cada entorno tiene su propia llave y su propio `ForceCommand`:

| Entorno | Wrapper | Comandos |
|---|---|---|
| Cristian | `scripts/deploy/authorized-command.sh` | `cristian-apply` y `cristian-rollback` con servicio y SHA de 40 hexadecimales |
| Producción | `scripts/deploy/production-authorized-command.sh` | `production-apply` y `production-rollback` con SHA |

La llave de Cristian rechaza `production-apply`. Un comando como `docker system prune` también es rechazado. Esas dos pruebas se ejecutaron en local. La llave de producción no está autorizada a entrar en `/opt/dinamic-clean-cristian`.

La instalación posterior, fuera de esta fase, consiste en una cuenta sin grupo `docker`, una llave por entorno, `command=` apuntando al wrapper, `restrict` en `authorized_keys`, y un mecanismo del sistema que permita a ese wrapper invocar solo los scripts de preflight y `docker compose` del directorio correspondiente. Mientras ese mecanismo no exista, la variable de activación permanece apagada. No se documenta un `sudo` amplio ni una cuenta dentro de `docker`.

## Integridad

Los scripts viven en el checkout del servidor. El wrapper ejecuta la ruta fija; no recibe el cuerpo del script por SSH. Una rotación consiste en retirar la línea de `authorized_keys`, generar otro par y cargar la clave privada solo en el environment de GitHub que corresponde. Los archivos `deploy.env` del servidor quedan fuera de Git, con permiso de lectura solo para la cuenta que ejecuta el wrapper.

El workflow de `cristian-pruebas` corre el YAML de esa rama. Si la rama acepta push directo, alguien puede editar el workflow y pedir el environment `production`. Por eso la protección de rama y los reviewers del environment son parte de la activación, no un detalle posterior.
