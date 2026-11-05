# Integridad de datos

Conteos leídos en Test antes de escribir y después del exit 0.

| Objeto | Antes | Después |
| --- | ---: | ---: |
| Auth users | 15 | 15 |
| `perfiles` | 15 | 15 |
| Perfiles sin usuario Auth | 0 | 0 |
| `empresas` | 3 | 3 |
| `clientes` | 113 | 113 |
| `empleados` | 265 | 265 |
| `pedidos_compra` | 10 | 10 |
| `ordenes_compra` | 5 | 5 |
| `crm_leads` | 0 | 0 |
| `purchase_operation_idempotency` | 0 | 0 |
| Buckets | 2 | 2, ninguno público |
| `storage.objects` | 5 | 5 |
| `forward_history` | 21 | 28 |
| Tablas nuevas | ausentes | 0 filas cada una |

No se regeneraron usuarios ni se modificaron filas de negocio. El cambio de historial es el registro de las siete migraciones.
