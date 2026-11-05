# 03 — Seguridad del restore

`scripts/restore-development.sh` llama a `scripts/disposable-target.mjs` antes de cualquier `psql`.

Acepta solo un host `localhost`, `127.0.0.1` o `::1`, y solo si la cadena no contiene `biectbcujabpjhinouil` ni `edruejzwwnixsjsadbgb`. Pooler, host desconocido, URL ilegible y cadena vacía salen como `cloud`, `ambiguous` o `empty`. El proceso termina 1.

`I_CONFIRM_DISPOSABLE` no se lee. Un restore con esa variable en `yes` y la URL de producción salió exit 1, con `RESTORE_TARGET_REJECTED cloud`, sin imprimir la URL y sin llegar a `psql`.

La misma función la usa el runner efímero antes del `DROP SCHEMA`, y `run-integration-with-env.mjs` antes de arrancar Vitest.

`npm run dev` no llama a este script. Sigue pudiendo usar Supabase Test.

Pruebas: `apps/api/tests/disposable-restore-target.test.ts`, 10 pasadas. Comparan el clasificador del script con `classifyConnectionTarget` y comprueban que el proceso hijo no escribe la contraseña ficticia `secret` en stdout ni stderr. No abren una conexión.
