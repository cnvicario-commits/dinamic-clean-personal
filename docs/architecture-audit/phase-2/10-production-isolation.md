# Aislamiento de producción

Producción escucha en el puerto `3005`, en un contenedor distinto. Cristian usa `3006` y Supabase Test. El despliegue verificado no modificó el contenedor de producción. Esta corrección no abrió SSH ni ejecutó migraciones. El preflight rechaza el puerto `3005` y una ruta bajo `/opt/dinamic-clean/`.

El Compose de Cristian no contiene el ref `biectbcujabpjhinouil`. Publica solo en `127.0.0.1`. La CA se monta desde `/opt/dinamic-clean-cristian/` y el validador rechaza una ruta bajo `/opt/dinamic-clean/`. La guardia de arranque rechazó, en una imagen local, una URL de producción antes de escuchar: exit 1.

`deploy/docker-compose.api.yml` no se usó para este deploy. La base productiva no se consultó en esta corrección.
