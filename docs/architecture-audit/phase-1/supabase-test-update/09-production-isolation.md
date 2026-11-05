# Aislamiento de producción

La ejecución usó la clave de migraciones de `apps/api/.env`. El guardia la clasificó `test-cloud`, pooler, rol `postgres`, puerto `5432`, y rechaza `biectbcujabpjhinouil` antes de conectar.

La URL de la aplicación, usada por el check de compatibilidad y por `/readyz`, contiene el ref de Test y no el de producción. El check devolvió `projectRef` `edruejzwwnixsjsadbgb`.

No se ejecutó migración, restauración ni escritura contra producción. Una consulta de solo lectura a producción fue bloqueada por la revisión automática de la herramienta en la sesión anterior. Estado: `NOT_VERIFIABLE`. El último inventario leído sigue siendo el de la fase 0: 28 migraciones, 13 usuarios Auth y 13 perfiles.
