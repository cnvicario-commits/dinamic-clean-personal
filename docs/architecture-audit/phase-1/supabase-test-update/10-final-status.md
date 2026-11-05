# Estado final

`SUPABASE_TEST_READY_FOR_APPROVAL`

Completado:

- Preflight de identidad. El destino configurado es Test, pooler, rol `postgres`, puerto `5432`.
- Guardia del runner contra producción, contra una nube no identificada y contra un loopback no marcado.
- Dump SQL no vacío, fuera del repositorio, modos `700` y `600`.
- Restauración de `public` y del historial en Postgres desechable, con los conteos de negocio iguales.
- Ensayo de las siete migraciones sobre esa copia. 28 checksums coinciden. Grants de `empresas` y check de compras quedaron como pide el backend.
- Test cloud sigue en 21 migraciones. Producción no se escribió.

Pendiente de una aprobación explícita:

```bash
env -u DINAMIC_MIGRATION_TARGET -u MIGRATIONS_DATABASE_URL ./scripts/apply-forward-migrations.sh
```

Límites del backup: no contiene los bytes de los 5 objetos de Storage ni la configuración de Auth del dashboard. El dump de `auth.users` sí tiene las 15 filas. La copia local no levantó el esquema completo de GoTrue.

No corresponde `SUPABASE_TEST_UPDATED_AND_VALIDATED`: las migraciones no se aplicaron en `edruejzwwnixsjsadbgb`.
