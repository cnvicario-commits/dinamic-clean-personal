# Variables

Las variables `NEXT_PUBLIC_*` quedan dentro del bundle del navegador durante `next build`. Cambiar el `.env` o el entorno del contenedor después de construir no cambia ese bundle. El arranque compara el entorno con `cristian-frontend-manifest.json` y se niega a iniciar si la URL de Supabase, la URL pública de la API o el SHA no coinciden con los del build.

## Build

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Tiene que ser `https://edruejzwwnixsjsadbgb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima o `sb_publishable_` de Test. Se rechaza `service_role` y `sb_secret_` |
| `NEXT_PUBLIC_API_URL` | Para esta publicación, exactamente `http://170.239.85.196:3006`. Un origen HTTPS futuro, sin IP ni puerto `3005` o `3006`, sigue siendo válido en un build nuevo |
| `APP_RELEASE_SHA` | SHA de Git, de 7 a 40 hexadecimales |
| `APP_DEPLOYMENT_ENV` | `cristian-pruebas` |
| `CRISTIAN_FRONTEND_BUILD` | `1`, solo en la imagen |

## Runtime

| Variable | Uso |
| --- | --- |
| `API_URL` | `http://dinamic-clean-cristian-api:3001` para el tráfico del servidor dentro de Docker. El navegador no la usa |
| `PORT` | `3000` |
| `HOSTNAME` | `0.0.0.0` |
| `APP_DEPLOYMENT_ENV` | Enciende el cartel visible de pruebas |
| `APP_RELEASE_SHA` | Sale en `/api/healthz` y en el cartel |

El frontend de Cristian rechaza `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `MIGRATIONS_DATABASE_URL`, `SUPABASE_JWT_SECRET` y `POSTGRES_PASSWORD`. Esas variables siguen perteneciendo solo a la API.

El preflight de despliegue también rechaza un origen `.invalid` o `.test`. Esos host sirven para la sonda local, no para publicar.

La plantilla está en `deploy/cristian-frontend.env.example`. No se copia el `.env` de la API ni el de producción.
