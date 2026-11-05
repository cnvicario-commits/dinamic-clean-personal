# Integridad de datos

Inventario de Test el 2026-11-05, solo conteos:

| Objeto | Antes | Copia restaurada | Copia después del ensayo | Test cloud ahora |
| --- | ---: | ---: | ---: | ---: |
| Auth users | 15 | 15 ids | 15 | 15 |
| `perfiles` | 15 | 15 | 15 | 15 |
| `forward_history` | 21 | 21 | 28 | 21 |
| `empresas` | 3 | 3 | 3 | no recontado |
| `clientes` | 113 | 113 | 113 | no recontado |
| `empleados` | 265 | 265 | 265 | no recontado |
| `pedidos_compra` | 10 | 10 | 10 | no recontado |
| `ordenes_compra` | 5 | 5 | 5 | no recontado |
| `crm_leads` | 0 | 0 | 0 | no recontado |
| `storage.objects` | 5 | no restaurado | no restaurado | 5 en el preflight |

La copia cargó solo los `id` de Auth, no el registro completo de GoTrue. Los conteos de negocio coinciden. No se borraron ni se regeneraron usuarios.

La comparación completa contra Test cloud queda para después de la ejecución real. El historial cloud no cambió: sigue en 21.
