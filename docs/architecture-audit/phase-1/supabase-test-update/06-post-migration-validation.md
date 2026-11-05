# Validación posterior

Supabase Test no fue migrado. Esta validación queda pendiente de la aprobación y de la ejecución del comando de `05-execution-report.md`.

Lo que sí quedó comprobado en la copia desechable está en `04-dry-run-results.md`: 28 historiales, checksums, check de compras, tres tablas, grants y conteos.

Después de una ejecución real hay que repetir, contra `edruejzwwnixsjsadbgb` y solo con lecturas:

- 28 filas, nombres y checksums iguales al repositorio, sin duplicados.
- Definición del check de `purchase_operation_idempotency`.
- Columnas, índices, RLS y grants de las tres tablas nuevas.
- Conteos de Auth, perfiles y tablas de negocio iguales a los del preflight.
- Buckets y cantidad de `storage.objects` (2 buckets privados, 5 objetos).
- `/readyz` solo si la instancia consultada es la de pruebas.

No se ejecutaron suites destructivas ni fixtures sobre el proyecto compartido.
