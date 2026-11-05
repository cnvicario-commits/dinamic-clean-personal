# Auditoría del frontend

Relevado en el código de `DIN-417` antes de armar la imagen.

| Punto | Hallazgo |
| --- | --- |
| Next.js | `16.4.3` |
| React | `19.2.4` |
| Router | App Router, `src/app`. No hay Pages Router |
| Build y arranque | `npm run build` ejecuta `next build`. `npm start` ejecuta `next start`. El contenedor no usa `next start`: usa el servidor `standalone` |
| Dependencias de ejecución | `package-lock.json` en la raíz. Tailwind y TypeScript son de build. Producción queda en la imagen `standalone` |
| Variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`, `API_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Supabase | Cliente de navegador y de servidor con la anon key. La service role está en `src/utils/supabase/admin.ts` y no tiene llamadas |
| Backend | El navegador llama a `NEXT_PUBLIC_API_URL`. El servidor ahora prefiere `API_URL` y, si falta, usa la URL pública |
| PostgREST | Hay lecturas directas. Inventario en `05-backend-integration.md`. No se migraron |
| Sesión | `src/proxy.ts` reemplaza al middleware. Lee la cookie con `getSession()` y el rol en `perfiles` |
| Auth | Login con contraseña y logout. No hay recuperación de contraseña ni callback OAuth |
| Vercel | No hay `vercel.json` ni APIs de Vercel en `src`. Queda `public/vercel.svg`, el asset por defecto de Next |
| Server Components | La mayoría de las páginas. Server Actions: no hay `use server` |
| API Routes | `src/app/api/usuarios` reenvía el JWT al backend. `src/app/api/healthz` es nuevo |
| URLs fijas | No hay referencias al proyecto productivo en `src`, salvo el rechazo explícito del guard de Cristian |
| `next.config.ts` | Headers de seguridad. `output: "standalone"` solo si `CRISTIAN_FRONTEND_BUILD=1` |
| Archivos | No hay uploads directos a Storage desde el navegador. Los presupuestos y justificaciones viajan al backend |
| Tiempo real | No hay WebSocket ni Realtime. Las cookies de Supabase y el CORS del backend sí importan |

El build de Vercel no define `CRISTIAN_FRONTEND_BUILD`. Sigue con el output por defecto.
