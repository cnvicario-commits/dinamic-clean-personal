# Frontend y backend

El navegador llama a `http://170.239.85.196:3006`. El servidor de Next sigue llamando a `http://dinamic-clean-cristian-api:3001`. Esas direcciones no se intercambian: `localhost` no resuelve la API desde el otro contenedor.

Los puertos `8086` y `3006` son orígenes distintos. La API acepta solo `http://170.239.85.196:8086`, con credenciales y los métodos `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE` y `OPTIONS`. El header `Authorization` viaja en el preflight. No se admite `*`.

No se agregó un proxy abierto. Las rutas `src/app/api/usuarios` siguen reenviando el JWT del usuario. El resto de las llamadas del navegador van a la URL pública. Esta fase no recreó el contenedor de la API. El cambio de CORS y de publicación exige hacerlo en el VPS, solo con el preflight de la API.

## Lecturas directas a PostgREST

No se migraron. Todas usan la sesión del usuario, no la service role.

| Lugar | Tabla | Operación | Clasificación |
| --- | --- | --- | --- |
| `src/proxy.ts` | `perfiles` | `select rol` | Control de navegación. RLS sigue siendo el límite real |
| `src/app/layout.tsx` | `perfiles` | `select rol` | Solo arma el menú |
| `src/app/empresas/page.tsx` | `empresas` | `select` | Lectura. Las escrituras ya pasan por la API |
| `src/app/dashboard/page.tsx` | `ordenes_compra` | `select` con ítems, clientes y proveedores | Lectura agregada |
| `src/app/dashboard/page.tsx` | `clientes` | `select` de presupuestos | Lectura |
| `src/app/dashboard/page.tsx` | `asignaciones` | `select` activas | Lectura |
| `src/app/dashboard/page.tsx` | `asistencias` | `select` del mes | Lectura |
| `src/app/dashboard/page.tsx` | `empleados` | `count` de activos | Lectura |

Pasar estas lecturas al backend es trabajo de una fase posterior. Depende de RLS y de los permisos actuales.
