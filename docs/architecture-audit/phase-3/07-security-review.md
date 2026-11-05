# Seguridad

| Control | Resultado |
| --- | --- |
| Headers | Next ya envía `nosniff`, `Referrer-Policy`, `X-Frame-Options` y `Permissions-Policy`. Nginx agrega HSTS en el borde HTTPS |
| Cookies | `SameSite=Lax`, sin `Secure` y sin `HttpOnly`. En HTTP se pueden guardar y también leer o robar si alguien altera la página |
| Redirects | `src/proxy.ts` solo cambia el path a `/login` o `/sin-acceso`. El login vuelve a `/` |
| Variables | El guard rechaza producción, service role, URL de base y orígenes de ejemplo |
| Bundle | El scan del build no encontró el ref productivo ni asignaciones de secretos de servidor |
| Errores | `/api/healthz` devuelve estado, release e identidad. No devuelve claves |
| Dependencias | `npm audit --omit=dev` encontró 0 vulnerabilidades |
| Usuario | `10001:10001`, sin privileged y sin capabilities |
| Puertos | `0.0.0.0:8086` y `0.0.0.0:3006`. No se publica Docker, PostgreSQL ni Redis. `/healthz` y `/readyz` quedan accesibles y no devuelven secretos |
| CORS | No se abrió a `*` |
| SSRF | `API_URL` solo puede ser `http://dinamic-clean-cristian-api:3001` o la misma URL pública del navegador |
| Archivos | Siguen yendo al backend. No se abrió Storage en el navegador |
| Proxy | Compatible con los headers `X-Forwarded-*`. No se confía en un cliente que llegue directo al puerto publicado |

HTTP público no equivale a HTTPS. No da confidencialidad ni integridad a la contraseña, las cookies ni los tokens mientras viajan entre el celular y el VPS. Un atacante en esa red puede modificar el JavaScript antes de que el navegador hable por HTTPS con Supabase. Este entorno es solo para cuentas de prueba y datos ficticios o anonimizados. No sirve para secretos reutilizados de producción.

La publicación en `0.0.0.0` puede saltarse UFW si Docker escribe en la cadena `DOCKER-USER`. Hay que mirar el firewall del VPS antes de dar por cerrada cualquier restricción. Esta fase no lo cambió.

HTTPS sigue siendo posible: el guard acepta un origen HTTPS único en un build nuevo. No está implementado para esta publicación. Nginx y Certbot no se usan ahora.

CSP sigue sin aplicarse. El comentario de `next.config.ts` lo deja pendiente y esta fase no inventó una política.

`src/utils/supabase/admin.ts` sigue en el repositorio y no se llama. El contenedor de Cristian rechaza la service role si alguien la inyecta.

El cartel fijo dice que el entorno es el de pruebas de Cristian y muestra el SHA. No aparece cuando `APP_DEPLOYMENT_ENV` no está definido, que es el caso de Vercel y del desarrollo local.
