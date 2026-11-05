# Nginx y HTTPS

Esta publicación no usa dominio, Nginx ni HTTPS. El navegador entra por `http://170.239.85.196:8086` y llama a la API en `http://170.239.85.196:3006`. Las plantillas de Nginx quedan para una mejora posterior. No se instalaron, no se recargó Nginx, no se pidió un certificado y no se cambió DNS.

HTTPS no es obligatorio para el acceso que se pidió. Tampoco es equivalente a dejarlo en HTTP: las credenciales quedan expuestas en la red. Si más adelante se pide cifrado, hay que construir otra imagen con el origen HTTPS y cambiar el CORS a ese único origen.

Plantilla: `deploy/nginx/dinamic-clean-cristian-frontend.conf.template`.

Render, sin instalar:

```bash
CRISTIAN_FRONTEND_DOMAIN=<hostname-real> \
CRISTIAN_FRONTEND_HOST_PORT=8086 \
./deploy/render-cristian-frontend-nginx.sh
```

El script rechaza localhost, `*.local`, `*.invalid`, `*.test`, `example.com` y sus subdominios, `*.vercel.app`, el ref productivo, y los puertos `3005` y `3006`. El proxy queda en `127.0.0.1:8086`, con HTTP/1.1, `Upgrade` y `Connection` para conexiones persistentes, `proxy_buffering off` para el streaming de Next, y los headers `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` y `X-Forwarded-Host`.

La API ya tiene su plantilla en `deploy/nginx/dinamic-clean-cristian-api.conf.template`. No hace falta DNS para la publicación por IP. Esas plantillas no forman parte del acceso actual.

Certbot, cuando el vhost ya esté instalado y el DNS responda:

```bash
sudo certbot --nginx -d <hostname-real>
sudo nginx -t
```

Esos comandos no se ejecutaron. `nginx` no está instalado en la máquina donde se armó esta fase, así que `nginx -t` queda pendiente en el VPS.
