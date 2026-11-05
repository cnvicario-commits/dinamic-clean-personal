# Resultado

`PHASE_2_PARTIAL`

La API de Cristian está desplegada y el VPS ya fue relevado. El acceso de navegador elegido después es HTTP en `170.239.85.196`, sin dominio ni HTTPS. Esa publicación todavía no se aplicó en el servidor. HTTPS queda como mejora opcional, no como requisito de esta decisión.

## Verificado en el VPS

- 16 CPU lógicas, 31 GiB de RAM, unos 24 GiB libres en el relevamiento y 127 GB de disco libre.
- Producción en el puerto `3005`, sin cambios en su contenedor.
- Cristian en `127.0.0.1:3006`, 1 CPU, 512 MB, estado healthy.
- Imagen `d713fb79ade3`. `/healthz` y `/readyz` respondieron HTTP 200.
- Supabase Test `edruejzwwnixsjsadbgb`, con la CA en `/opt/dinamic-clean-cristian/certs/supabase-ca.crt`.
- `SELF_SIGNED_CERT_IN_CHAIN` se resolvió montando esa CA. La verificación TLS sigue activa.

El contenedor que está corriendo sigue publicado en loopback. El Compose nuevo lo publica en `0.0.0.0:3006` y el CORS pasa a `http://170.239.85.196:8086`. Eso exige recrear la API en el despliegue de la fase 3B. HTTPS no es obligatorio para esa publicación.

## Pendiente

- Aplicar la publicación HTTP y el CORS nuevo en el VPS.
- HTTPS, Nginx y Certbot quedan opcionales para más adelante.
- El usuario de deploy restringido sigue sin implementar.
