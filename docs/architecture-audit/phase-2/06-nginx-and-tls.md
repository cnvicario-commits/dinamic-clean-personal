# Nginx y HTTPS

Preparado, no instalado. No hay un dominio definitivo en el repositorio y no se inventó uno.

Plantilla: `deploy/nginx/dinamic-clean-cristian-api.conf.template`.

`deploy/render-cristian-nginx.sh` exige `DEMO_API_DOMAIN` y `CRISTIAN_API_HOST_PORT`. Rechaza dominio vacío, `*`, `localhost` y un puerto fuera de 1024–65535. No recarga Nginx.

Render de prueba con `api-demo.example.com` y puerto `3199`:

- `listen 80` redirige a HTTPS
- `listen 443 ssl` con certificado en `/etc/letsencrypt/live/<dominio>/`
- `proxy_pass http://127.0.0.1:3199`
- `client_max_body_size 22m`, alineado con las cargas de la API
- encabezados `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` y `Authorization`
- sin `default_server` y sin wildcard

El dominio de ejemplo no es el dominio que hay que publicar. El puerto `3199` tampoco está elegido.

`nginx` y `certbot` no están en esta máquina. `nginx -t` no se ejecutó. Certbot no se ejecutó. No se modificó ningún vhost.

Antes de recargar en el VPS: renderizar con el dominio real, `nginx -t`, y abortar si el test falla. El certificado se pide solo cuando el DNS de ese dominio ya apunta al VPS y hay autorización. Fastify debe recibir `TRUST_PROXY_CIDRS=127.0.0.1` porque Nginx está en el host.
