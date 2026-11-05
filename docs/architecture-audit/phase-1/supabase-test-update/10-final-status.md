# Estado final

`SUPABASE_TEST_UPDATED_AND_VALIDATED`

- Backup SQL comprobado y todavía conservado. No cubre bytes de Storage ni el dashboard de Auth.
- Ensayo previo exitoso sobre una copia desechable.
- Preflight repetido sin cambios inesperados.
- Siete migraciones aplicadas en `edruejzwwnixsjsadbgb` con el runner forward. Exit 0.
- 28 registros, checksums idénticos al repositorio, sin duplicados.
- Check de compras con las cuatro operaciones.
- Tres tablas nuevas creadas, vacías, con RLS y grants previstos.
- `empresas`: `dinamic_api` escribe; `authenticated` solo lee; `anon` sin DML ni `TRUNCATE`.
- 15 usuarios Auth, 15 perfiles y los conteos de negocio se conservaron. Storage: 2 buckets privados y 5 objetos.
- Compatibilidad: `db_schema_compatible` contra Test como `dinamic_api`, y `/readyz` local `200`.
- Producción no se modificó. Su relectura queda `NOT_VERIFIABLE`.
