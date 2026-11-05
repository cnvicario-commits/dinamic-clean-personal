# Análisis de las siete migraciones

Orden léxico. Ningún archivo histórico se editó. Checksums SHA-256 del archivo actual, iguales a los registrados en la copia después del ensayo:

| Archivo | SHA-256 |
| --- | --- |
| `20261008120000_production_schema_reconciliation.sql` | `94f79b3518bdeb9707c11fc2ffde963050f1b240f4795748314905f2c33620f5` |
| `20261030140000_empresas_api_write_grants.sql` | `35f53c7bfbf9f60ce39c0275a4c179e16fdfe579521fd8c096cea3a72b6c866c` |
| `20261030160000_auth_compensation_jobs.sql` | `ceebee18c8aab33a914b0bc0ef80ccd81d5a3446065a17caf30d751efb14b3bd` |
| `20261030161000_create_idempotency.sql` | `0fd213cc37b645027bb5c815bd8304e11427f82e39330081d7a03d1447258f61` |
| `20261030170000_auth_compensation_claim.sql` | `011d9f1ee0b7dad0c510cff213eaeb4a71f94ba850cf2c2fa04115e67530744a` |
| `20261030171000_company_create_idempotency.sql` | `776803a9f48eaf7fc88b749aecae792ba656b0ba0c9771ff3efbb207bc220e0a` |
| `20261030172000_purchase_order_create_idempotency.sql` | `3c42d010722144dff44cf63cc65f089d59f94569102686b50992c3a34fa7f262` |

## Efecto y datos actuales

1. Reconciliación CRM. Completa `crm_leads.updated_at`, lo deja `NOT NULL` con default `now()`, recrea la FK de `oportunidad_id` con `ON DELETE SET NULL`, elimina un trigger y políticas viejas si existen, y revoca escritura de `anon` y `authenticated` sobre `crm_leads` y `crm_seguimientos_leads`. En Test, `crm_leads` tiene 0 filas y `updated_at` ya es `NOT NULL`. Las políticas que el archivo elimina (`*_propio_o_admin`, `crm_vistas_propia`) no están en Test. Las políticas `*_dinamic_api_all` sí están y el archivo no las toca. No hay filas que el `UPDATE` pueda cambiar.

2. Grants de `empresas`. `GRANT SELECT, INSERT, UPDATE` a `dinamic_api`, políticas de insert y update para ese rol, y `REVOKE` de escritura, `TRUNCATE`, `REFERENCES` y `TRIGGER` a `anon` y `authenticated`. `anon` también pierde `SELECT`. `authenticated` conserva `SELECT`. Las políticas `empresas_insert_admin` y `empresas_update_admin` quedan, pero sin grant de escritura no autorizan DML. No borra filas. `empresas` tiene 3 filas.

3. Crea `auth_compensation_jobs`. RLS, sin privilegios para `anon` y `authenticated`, `SELECT/INSERT/UPDATE` para `dinamic_api`. Tabla nueva.

4. Crea `client_operation_idempotency` con FK a `auth.users` y `ON DELETE CASCADE`. Amplía el check de compras a `purchase_request_import`, `purchase_order_generate` y `purchase_request_create`. La tabla de compras existe y tiene 0 filas, así que el check nuevo no choca con datos.

5. Amplía el check de estado de `auth_compensation_jobs` a `pending`, `processing`, `succeeded`, `exhausted`. Depende del archivo 3. La tabla acaba de crearse vacía.

6. Crea `company_operation_idempotency`, misma forma, operación `company_create`, FK a `auth.users`. No exige unicidad de CUIT.

7. Vuelve a ampliar el check de compras para incluir `purchase_order_create`. Depende del archivo 4.

No hay `DROP TABLE` ni borrado de usuarios. El bloqueo posible sería un check o un `NOT NULL` sobre filas incompatibles. El inventario de Test no muestra ese caso: `crm_leads` vacío y ya `NOT NULL`, compras de idempotencia vacías, `auth.users` presente para las FK nuevas.
