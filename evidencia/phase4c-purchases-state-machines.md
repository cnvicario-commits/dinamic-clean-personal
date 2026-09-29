# Fase 4C — State machines finales

| Entidad / origen | Acción | Destino | Validación backend | Permiso | Test final |
|---|---|---|---|---|---|
| Pedido `borrador` | enviar | `enviada` | estado actual e items válidos; transición protegida en transacción | `purchase_requests:write` | PASS — PostgreSQL integration |
| Pedido `enviada` | editar | rechazado | sólo pedidos en borrador son editables | `purchase_requests:write` | PASS — HTTP/integration |
| Pedido `enviada` | generar asignaciones/OC | OC/depósito `borrador` | pedido bloqueado y asignaciones validadas | `assignments:write` / `purchase_orders:write` | PASS — PostgreSQL integration |
| OC `borrador` | enviar | `enviada` | transición exacta validada bajo `FOR UPDATE` | `purchase_orders:write` | PASS — PostgreSQL integration |
| OC `enviada` | recepcionar | `recepcionada` | transición exacta validada bajo `FOR UPDATE` | `purchase_orders:write` | PASS — PostgreSQL integration |
| Depósito `borrador` | enviar | `enviada` | transición exacta validada bajo `FOR UPDATE` | `warehouse_orders:write` | PASS — PostgreSQL integration |
| Depósito `enviada` | recepcionar | `recepcionada` | transición exacta validada bajo `FOR UPDATE` | `warehouse_orders:write` | PASS — PostgreSQL integration |

Las transiciones inválidas, retrocesos, repeticiones y estados desconocidos son rechazados por el backend. El CHECK de `pedidos_compra` admite `recepcionada`, pero no existe acción funcional 4C que produzca esa transición y no se agrega.
