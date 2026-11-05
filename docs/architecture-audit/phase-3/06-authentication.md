# Autenticación

| Flujo | Estado en el código |
| --- | --- |
| Login | `signInWithPassword` en `src/app/login/page.tsx` y navegación dura a `/` |
| Logout | `signOut` en `src/components/LogoutButton.tsx` |
| Refresh | Lo hace `@supabase/ssr` cuando la cookie necesita renovarse |
| Recuperación y reseteo | No hay pantallas ni rutas |
| Invitado | `src/proxy.ts` manda a `/login` |
| Rol | Lee `perfiles.rol` y puede mandar a `/sin-acceso`. No reemplaza la autorización del backend |
| Cookies | `@supabase/ssr` usa `SameSite=Lax` y no marca `Secure`. En HTTP el navegador puede guardarlas. No son confidenciales |
| Callback | No hay ruta de intercambio de código |

`signInWithPassword` no usa PKCE ni `crypto.subtle`. El código no muestra un bloqueo técnico para iniciar sesión por HTTP. Esa prueba no se ejecutó contra Supabase Test: queda `NOT_VERIFIED`.

`http://170.239.85.196` no es un contexto seguro. `crypto.subtle` no está disponible, así que un flujo PKCE caería a `plain`. El login por contraseña no entra por ahí. No se desactivó ninguna protección para compensarlo.

En el proyecto Test hay que cargar, sin tocar producción:

- Site URL: `http://170.239.85.196:8086`
- Redirect URLs: ese mismo origen

Ese cambio del panel no se aplicó. Si el panel lo rechaza, el login por contraseña igual no depende de una redirect URL. Los enlaces de correo sí. La recuperación de contraseña no tiene pantalla.
