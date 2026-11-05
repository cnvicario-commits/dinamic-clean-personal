# Capacidad

No hay mediciones del VPS. No se asignan números de CPU ni de RAM como si fueran el resultado de esa medición.

`deploy/docker-compose.cristian.yml` no trae defaults para:

- `CRISTIAN_API_CPUS`
- `CRISTIAN_API_MEMORY`
- `CRISTIAN_API_HOST_PORT`

`docker compose config` falla si faltan. El valor usado para comprobar que el archivo renderiza (`0.25`, `256m`, puerto `3199`) es una sonda de sintaxis. No es la reserva del servidor y no se usó para arrancar un stack.

## Qué hay que reservar

Además de la API que ya corre, el mismo VPS tiene que seguir teniendo lugar para:

- la API de Cristian
- el Next.js de Cristian, que se construye en la fase 3
- sistema operativo, Nginx, logs e imágenes Docker

No se reduce producción para hacer espacio.

## Rechazo del despliegue

No levantar el stack si ocurre cualquiera de estas condiciones:

- no hay salida del relevamiento
- la RAM libre, después de dejar margen al sistema y a producción, no cubre el límite de la API demo más una reserva equivalente para el frontend de la fase 3
- el disco no alcanza para una imagen nueva y los logs rotados
- el puerto elegido ya está en escucha
- aplicar el límite obligaría a bajar o restringir el contenedor productivo

Eso todavía no se puede afirmar ni descartar. El estado de esta fase no es `PHASE_2_BLOCKED_BY_CAPACITY`.
