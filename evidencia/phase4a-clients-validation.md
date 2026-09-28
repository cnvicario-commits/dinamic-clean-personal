# Fase 4A — Clientes, Domicilios y Presupuestos

Fecha de cierre: 2026-09-28

## 1. Alcance implementado

Se migró verticalmente el dominio Clientes desde escrituras directas del navegador hacia `Frontend → API → PostgreSQL/Storage`. Incluye listado y detalle de clientes, alta y edición allowlisted, alta/edición/estado/principal de domicilios, y ciclo completo de presupuestos privados. No se implementó alcance 4B, 4C ni 4D.

## 2. Endpoints creados/modificados

- `GET /v1/clients`
- `POST /v1/clients`
- `GET /v1/clients/:id`
- `PATCH /v1/clients/:id`
- `GET /v1/clients/:id/addresses`
- `POST /v1/clients/:id/addresses`
- `PATCH /v1/clients/:id/addresses/:addressId`
- `PATCH /v1/clients/:id/addresses/:addressId/status`
- `POST /v1/clients/:id/addresses/:addressId/principal`
- `GET /v1/clients/:id/quotes`
- `POST /v1/clients/:id/quotes`
- `GET /v1/clients/:id/quotes/:quoteId/download`
- `DELETE /v1/clients/:id/quotes/:quoteId`

La superficie completa está documentada en OpenAPI. El cliente y los DTO TypeScript se regeneran desde el mecanismo existente de contratos.

## 3. Modelo de autorización aplicado

RBAC backend deny-by-default, mediante `requirePermission` y el catálogo central:

- `admin`, `gerente`, `compras`: `clients:read/create/update`, `client_addresses:read/update`, `client_quotes:read/create/delete`.
- `supervisor`, `auditoria`: sin grants backend nuevos sobre 4A y sin mutaciones.

Las rutas UI continúan siendo navegación, no autoridad. La API valida JWT, perfil/rol y permiso en cada endpoint. Los DTO Zod son estrictos y aplican allowlist; no aceptan IDs, auditoría, relaciones o paths Storage enviados arbitrariamente.

## 4. Transacciones implementadas

- Alta de cliente + domicilio inicial: una transacción PostgreSQL real con rollback completo.
- Establecer domicilio principal: advisory lock transaccional por cliente, validación de pertenencia/estado activo, desmarcado y marcado dentro de una sola transacción.
- Crear/editar un domicilio con `esPrincipal=true`: misma serialización por advisory lock.
- Desactivar un domicilio principal limpia `es_principal` en el mismo statement.

El índice parcial único existente `cliente_domicilios_un_principal(cliente_id) WHERE es_principal` permanece como defensa final ante concurrencia.

## 5. Estrategia Storage + metadata

El backend valida extensión `.pdf`, Base64 estricto, contenido no vacío, límite real de 15 MiB y magic bytes `%PDF-`; no confía sólo en el MIME cliente. El path es generado server-side como `clienteId/UUID_nombre-sanitizado.pdf`, con `upsert=false`.

Upload: verifica cliente → sube objeto → inserta metadata. Si falla DB después de Storage, elimina el objeto como compensación y registra cualquier fallo de compensación.

Delete: elimina metadata → elimina objeto. Si falla Storage, restaura metadata con ID, actor y timestamp originales; registra cualquier fallo de compensación.

Download: primero busca metadata por `cliente_id + quote_id` y luego emite URL firmada por 60 segundos. Storage y PostgreSQL no conforman una transacción distribuida; el mecanismo es compensatorio y no se presenta como atómico.

## 6. RLS/policies modificadas

La migración `20260928120000_phase4a_clients.sql`:

- otorga al rol backend `dinamic_api` sólo los DML requeridos;
- crea policies de backend para las tres tablas;
- revoca INSERT/UPDATE/DELETE a `anon` y `authenticated` en las tres tablas;
- elimina policies históricas de clientes que permitían DML browser a admin;
- elimina policies globales conocidas de domicilios, presupuestos y Storage;
- elimina además cualquier policy browser renombrada cuyo predicado alcance `presupuestos-clientes`;
- mantiene exclusivamente SELECT legacy de clientes/domicilios requerido por consumers aún no migrados;
- no deshabilita RLS.

Verificación efectiva local: bucket privado, cero policies browser de escritura del bucket y sin DML de tablas para `authenticated`.

## 7. Frontend migrado

Se migraron las páginas `/clientes` y `/clientes/[id]`, alta de cliente, formularios/estado/principal de domicilios y panel completo de presupuestos al cliente API tipado. Supabase queda en estas páginas sólo para obtener la sesión/JWT que la API vuelve a validar. No se rediseñó la UI.

## 8. Accesos directos eliminados

Se eliminaron todas las mutaciones directas 4A a `clientes`, `cliente_domicilios`, `cliente_presupuestos` y `presupuestos-clientes`, incluido el antiguo doble UPDATE para principal y la secuencia frontend Storage→metadata.

La búsqueda final completa está en `phase4a-clients-direct-access.txt`.

## 9. Accesos legacy que permanecen y justificación

Persisten sólo SELECT directos de `clientes`/`cliente_domicilios` en Compras, Pedidos, Órdenes, Auditorías y dashboard. Son consumers fuera de 4A; migrarlos ampliaría 4B/4C u otros módulos. Se preservan mediante las policies SELECT existentes. No queda acceso legacy a metadata o Storage de presupuestos.

## 10. Tests realmente ejecutados

- Suite API completa: 212 passed, 32 opt-in skipped.
- Seguridad real local PostgREST/Storage: 11 passed, 0 skipped.
- Tests HTTP: autenticación, RBAC, CRUD, validación, 404 y lifecycle.
- Tests repository: rollback cliente+domicilio y transacción/lock de principal.
- Tests presupuestos: PDF válido/inválido/sobretamaño, fallo Storage, fallo metadata con compensación, signed URL, cross-client, delete y restore.
- Tests estáticos/effectivos de policies y grants.
- OpenAPI/contratos y regeneración determinística.
- Lint backend/frontend, typecheck backend/frontend, build backend y build frontend webpack.

Detalle reproducible en `phase4a-clients-tests.txt`.

## 11. Limitaciones

- Storage + DB usa compensación; no hay atomicidad distribuida.
- La carga usa JSON Base64, con body limit de 22 MB limitado exclusivamente a la ruta de upload para admitir PDF de 15 MiB; el límite global continúa en 1 MiB. Multipart queda fuera de este slice.
- El build estándar Turbopack falla por una restricción de port binding de PostCSS del entorno; el build productivo webpack pasa completo.
- La operación de upload no expone una idempotency key; la UI bloquea doble click, pero un retry de transporte deliberado puede crear otro presupuesto válido.

## 12. Deudas técnicas

- Migrar en 4B/4C las lecturas legacy de clientes/domicilios de Compras y luego reducir SELECT browser.
- Migrar en su fase propia las lecturas de Auditorías/dashboard.
- Evaluar multipart/streaming e idempotency key para documentos si el volumen o los reintentos lo requieren.
- Resolver/actualizar Turbopack cuando el entorno permita su proceso auxiliar de CSS.

## 13. Criterios de cierre

- Frontend 4A usa API para todas las mutaciones: cumplido.
- Autorización backend explícita y deny-by-default: cumplido.
- RLS/grants impiden bypass DML: cumplido y probado contra servicio real local.
- Storage privado sin CRUD global authenticated: cumplido y probado.
- Principal consistente y operaciones PG multipaso transaccionales: cumplido.
- Compensación Storage/metadata explícita: cumplido.
- Compatibilidad de consumers legacy de lectura: preservada y documentada.
- Contratos, lint, typecheck, tests y builds verificables: cumplido; limitación Turbopack documentada con build webpack equivalente exitoso.
- Sin cambios 4B/4C/4D: cumplido.

## 14. Conclusión

`READY_FOR_REVIEW`

Fase 4A queda verticalmente migrada y cerrada para escrituras directas browser. No existe un bloqueo funcional o de seguridad pendiente dentro del alcance.
