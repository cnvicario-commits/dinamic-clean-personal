# Aislamiento de producción

El frontend de Cristian no usa el proyecto `biectbcujabpjhinouil`, ni el contenedor `dinamic-clean-api`, ni el puerto `3005`, ni variables de Vercel. El build de producción sigue sin `output: "standalone"` porque no define `CRISTIAN_FRONTEND_BUILD`.

El guard rechaza ese ref en la URL de Supabase, en la URL pública de la API y en la anon key. El preflight rechaza los puertos `3005` y `3006`. El Compose del frontend no incluye el servicio de la API ni la ruta `/opt/dinamic-clean`.

No se modificó el Dockerfile del backend, su Compose, su CA ni su `.env`. No se ejecutaron migraciones. No se reinició ningún contenedor que ya estuviera corriendo. La sonda local usó el nombre `dinamic-clean-frontend-probe` y se eliminó.

`curl` contra `3005` y `3006` en el VPS no se repitió en esta fase. El runbook lo pide antes y después del despliegue real.
