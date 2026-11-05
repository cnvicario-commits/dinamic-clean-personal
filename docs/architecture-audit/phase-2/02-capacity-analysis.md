# Capacidad

El VPS tiene 16 CPU lógicas, 31 GiB de RAM y unos 24 GiB libres en el momento del relevamiento, más 127 GB de disco libre. Alcanza para la API de producción, la API de Cristian y el futuro contenedor de Next.js.

Límites ya aplicados a la API de Cristian: 1 CPU y 512 MB. Producción queda en su contenedor del puerto `3005`, sin bajarle recursos para hacer lugar.

El puerto `8086` queda reservado para el frontend de la fase 3. Hay que verificar que esté libre antes de publicarlo. No se usa en esta fase.

`deploy/docker-compose.cristian.yml` sigue sin defaults. `scripts/check-cristian-compose.sh` puede renderizar con `0.25`, `256m` y el puerto `3199`. Esos valores solo prueban la sintaxis. No son la capacidad del servidor y `docker compose config` no autoriza un despliegue.

El preflight de despliegue tiene que recibir los límites reales:

```bash
export CRISTIAN_API_CPUS=1
export CRISTIAN_API_MEMORY=512m
export CRISTIAN_API_HOST_PORT=3006
```
