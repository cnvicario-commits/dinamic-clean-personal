# 02 — Verificación de Vercel

Estado: `NOT_ACCESSIBLE`.

En esta máquina no está el CLI de Vercel (`command -v vercel` vacío) y el repo no tiene `.vercel/project.json` ni `vercel.json`. No se consultó la API de Vercel. No hay dominio, rama de producción ni lista de variables confirmados.

El README de Next menciona Vercel como texto de plantilla. Eso no prueba un proyecto real.

## Qué sí queda decidido con el código

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_API_URL` se incrustan en el build (`src/utils/supabase/client.ts`, `src/lib/api/browser.ts`). Un proyecto Vercel que tenga esas variables en el entorno Production, y que además despliegue la rama `cristian-pruebas` con ese entorno, publicaría el frontend de pruebas apuntando a producción.

Por eso el segundo proyecto sigue siendo la alternativa recomendada, no un deployment de rama dentro del proyecto productivo:

| Criterio | Proyecto nuevo | Rama dentro del proyecto actual |
|----------|----------------|----------------------------------|
| Aislar variables de Production | El proyecto de pruebas no las tiene | Un error de alcance las reutiliza |
| Dominio estable | Dominio propio del proyecto | Se puede, pero comparte el equipo y los env |
| Rollback | Independiente | Un promote puede mezclar entornos |
| Costo | Un proyecto más en el mismo equipo | Menor |
| Riesgo sobre producción | No comparte el botón de promote | Más alto |

No se modifica el proyecto productivo. Cuando haya acceso, solo se lee.

## Configuración requerida para el proyecto de pruebas

Cuando exista acceso de admin a Vercel:

- Proyecto nuevo. Root directory `.` (el `package.json` de Next está en la raíz). Framework Next.js. Build `npm run build`. Install `npm ci`.
- Production Branch de ese proyecto: `cristian-pruebas`. No es la rama `main` del producto.
- Dominio estable propio.
- Variables de ese proyecto, y de ningún otro:

| Nombre | Valor permitido |
|--------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://edruejzwwnixsjsadbgb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key de ese proyecto |
| `NEXT_PUBLIC_API_URL` | origen HTTPS del API de pruebas |
| `API_URL` | el mismo origen, solo servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | solo si un server component la necesita. Hoy `createAdminClient` no tiene callers. No crearla hasta que haga falta |

- Ignored Build Step o deploy hook: el pipeline confiable despliega el frontend después de que `/readyz` del API de pruebas responda. El auto-deploy de Vercel en el push publica el frontend antes que el API. El hook lo evita. El secreto del hook vive en el environment de pruebas, no en la rama.
- En el proyecto Supabase de test, el dominio nuevo entra en Site URL / Redirect URLs. El login del código es `signInWithPassword` y no define un callback (`src/app/login/page.tsx`). Igual hace falta el dominio para la cookie y para cualquier mail de Auth. Esa pantalla del dashboard no se pudo leer.

## Lectura pendiente, sin cambiar nada

Anotar proyecto, Production Branch, dominios, y el nombre de cada variable en Production y Preview. Del valor de `NEXT_PUBLIC_SUPABASE_URL` anotar solo el project ref. No copiar claves.
