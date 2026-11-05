# 14 — Riesgos residuales

1. `workflow_run` protege el YAML de despliegue solo cuando ese archivo está en la rama por defecto. Hoy está en `DIN-417`. Hasta el merge, el CD no queda activo.
2. El job de publicación construye el SHA ya aceptado por CI. Ese checkout recibe la clave anónima de Test, que es pública por diseño. No recibe la llave SSH ni el URL de migraciones. Un Dockerfile malicioso podría intentar imprimir la clave anónima; GitHub enmascara el secret.
3. La protección de ramas y los reviewers no se leyeron. `gh` sigue sin sesión.
4. El Compose productivo del VPS no se inspeccionó. El script está cerrado hasta una revisión humana. Los nombres `dinamic-clean-api` y el puerto `3005` vienen de la descripción operativa.
5. `VERCEL_INTEGRATION_NOT_VERIFIED`.
6. El lock de migraciones es local al proceso y al grupo de concurrencia del workflow. No se probó un advisory lock de Postgres entre dos hosts. `SIGKILL` puede dejar el directorio de lock vacío.
7. El rollback de un contenedor no revierte SQL.
8. Cristian sigue en HTTP público. Esta corrección no agrega TLS.
9. La cuenta que finalmente invoque Docker sigue sin un mecanismo instalado que evite el grupo `docker`. El procedimiento está escrito y no aplicado.
10. No se volvió a medir el VPS.
