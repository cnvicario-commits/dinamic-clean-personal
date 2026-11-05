# Aislamiento de producción

Proyecto de producción: `biectbcujabpjhinouil`. No se ejecutó ninguna escritura, restauración ni migración contra ese ref.

El guardia rechaza una URL que contiene ese ref. La prueba `migration-target-guard` cubre ese rechazo, incluso si además se marca el destino como desechable. Exit 0, 5 tests.

La única URL que el backup y el runner aceptaron como nube fue clasificada `test-cloud` (pooler, rol `postgres`, puerto `5432`). El ensayo usó `127.0.0.1:55432` y el guardia lo etiquetó `disposable-local`.

Una consulta de solo lectura a producción fue bloqueada por la revisión automática de la herramienta. Estado de esta sesión: `NOT_VERIFIABLE`. El último inventario leído de producción sigue siendo el de la fase 0: 28 migraciones, 13 usuarios Auth y 13 perfiles. Esta sesión no lo reconfirmó.

Test cloud se releyó después del ensayo: 21 migraciones, 15 usuarios, 15 perfiles. No recibió las siete migraciones.
