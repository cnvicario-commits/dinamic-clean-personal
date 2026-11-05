# Resultado

`PHASE_3_HTTP_IP_IMPLEMENTED_PENDING_DEPLOY`

El acceso pedido es `http://170.239.85.196:8086` para el frontend y `http://170.239.85.196:3006` para la API. Los tests locales pasan y el login por contraseña no depende de HTTPS. No está desplegado y el acceso desde otro dispositivo no se comprobó. No corresponde `DEPLOYED`.

## Listo

- Next.js 16.4.3 en Docker, usuario no root, healthcheck propio y SHA visible.
- El build de Vercel no cambia de modo de output.
- Supabase Test es la única URL pública aceptada. Producción, service role y URL de base se rechazan.
- El navegador no recibe `localhost:3006`. El servidor usa el nombre del contenedor de la API.
- Nginx no forma parte de esta publicación. Las plantillas quedan para un HTTPS posterior.
- El redeploy del frontend no recrea la API. El de la API sigue siendo un comando aparte.

## Pendiente antes de darlo por desplegado

- Medir de nuevo CPU, memoria, disco, el puerto `8086` y el firewall. Docker puede abrir `0.0.0.0` aunque UFW esté cerrado.
- Construir la imagen con la anon key real de Test. La sonda anterior no sirve.
- Recrear la API para aplicar el CORS `http://170.239.85.196:8086` y la publicación `0.0.0.0:3006`.
- Cargar Site URL y Redirect URLs en Supabase Test. No se hizo.
- Probar desde otro dispositivo el login, un módulo, una llamada a la API y el logout. Hoy están en `NOT_VERIFIED`.

HTTPS queda como mejora opcional. No hace falta un dominio para esta publicación. HTTP no protege las credenciales.

## Riesgos que no bloquean el armado y sí una prueba pública

- El dashboard, el menú y el listado de empresas siguen leyendo PostgREST con la sesión del usuario.
- No hay recuperación de contraseña en la interfaz.
- CSP sigue diferido.
