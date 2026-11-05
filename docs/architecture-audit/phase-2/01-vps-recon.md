# Relevamiento del VPS

Estado: `NOT_ACCESSIBLE`.

No hay `~/.ssh/config` en esta máquina y el repositorio no contiene un host de producción. No se abrió SSH. No se ejecutó `scripts/recon-vps-readonly.sh` en el servidor.

El script es de solo lectura. Imprime CPU, uptime, memoria, swap, disco, contenedores, límites, redes, volúmenes, drivers de log y nombres de `server_name`, `listen` y `proxy_pass`. De las URLs de Supabase imprime solo el project ref. No se desplegó nada.

Para destrabar el despliegue, un administrador ejecuta en el VPS:

```bash
bash scripts/recon-vps-readonly.sh
```

La salida tiene que responder, sin pegar `.env` ni connection strings:

- distribución, CPU, RAM, swap, disco libre, uptime y carga
- versión de Docker y Compose
- contenedor actual de la API, puerto publicado, red, directorio, healthcheck y restart
- si `/opt/dinamic-clean-cristian` ya existe
- puertos en escucha
- vhosts y certificados, solo nombres

Hasta esa salida, la capacidad y el puerto libre quedan sin medir. No se declara un despliegue.
