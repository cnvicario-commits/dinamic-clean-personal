# Relevamiento del VPS

Medido en el servidor durante el despliegue de la API de Cristian.

| Recurso | Valor |
| --- | --- |
| CPU lógicas | 16 |
| RAM total | 31 GiB |
| RAM disponible en el relevamiento | aproximadamente 24 GiB |
| Disco libre | 127 GB |
| API de producción | contenedor independiente, loopback puerto `3005` |
| API de Cristian | `127.0.0.1:3006`, imagen del commit `d713fb79ade3` |
| Límite de la API de Cristian | 1 CPU y 512 MB |
| Estado de ese contenedor | healthy |
| Base de Cristian | Supabase Test `edruejzwwnixsjsadbgb` |
| CA | `/opt/dinamic-clean-cristian/certs/supabase-ca.crt` |
| Reserva de frontend | puerto `8086`, hay que confirmar que sigue libre antes de usarlo |

`/healthz` y `/readyz` respondieron HTTP 200. El contenedor de producción no se modificó.

Esta corrección no volvió a abrir SSH. Los datos de arriba son el relevamiento ya hecho, no una medición nueva.
