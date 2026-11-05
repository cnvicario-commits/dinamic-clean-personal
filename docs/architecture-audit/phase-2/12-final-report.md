# Resultado

`PHASE_2_PARTIAL`

La API de Cristian está desplegada y el VPS ya fue relevado. La fase no pasa a `PHASE_2_COMPLETED` porque el navegador todavía no tiene un acceso definitivo: faltan el dominio, HTTPS público y un `CORS_ORIGIN` real.

## Verificado en el VPS

- 16 CPU lógicas, 31 GiB de RAM, unos 24 GiB libres en el relevamiento y 127 GB de disco libre.
- Producción en el puerto `3005`, sin cambios en su contenedor.
- Cristian en `127.0.0.1:3006`, 1 CPU, 512 MB, estado healthy.
- Imagen `d713fb79ade3`. `/healthz` y `/readyz` respondieron HTTP 200.
- Supabase Test `edruejzwwnixsjsadbgb`, con la CA en `/opt/dinamic-clean-cristian/certs/supabase-ca.crt`.
- `SELF_SIGNED_CERT_IN_CHAIN` se resolvió montando esa CA. La verificación TLS sigue activa.

`CORS_ORIGIN=https://demo.example.com` es un placeholder temporal.

## Pendiente

- Dominio, `nginx -t`, Certbot y HTTPS público.
- Reemplazar el CORS placeholder.
- Confirmar que el puerto `8086`, reservado para el frontend, sigue libre antes de la fase 3.
- El usuario de deploy restringido sigue sin implementar.
