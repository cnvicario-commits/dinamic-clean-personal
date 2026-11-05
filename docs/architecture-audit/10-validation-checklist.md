# 10 — Checklist de validación

Para usar cuando se implemente el plan. Esta auditoría no marcó estos ítems: no se desplegó nada.

Cada ítem pide evidencia (comando, check de GitHub o respuesta HTTP) y prohíbe pegar secretos.

## Aislamiento

- [ ] `SUPABASE_URL` del contenedor de pruebas tiene ref `edruejzwwnixsjsadbgb`.
- [ ] El mismo proceso termina con error si esa URL se reemplaza por `biectbcujabpjhinouil`.
- [ ] `DATABASE_URL` del contenedor resuelve al pooler de us-west-2, no al de sa-east-1.
- [ ] `MIGRATIONS_DATABASE_URL` dentro del contenedor está vacía.
- [ ] El environment `cristian-pruebas` no contiene el ref de producción en ningún secreto.
- [ ] Un job de la rama de pruebas no puede leer secretos del environment `production`.
- [ ] `npm test` de `apps/api` sin flags no abre el proyecto de test.

## API de pruebas

- [ ] `docker compose` del proyecto `dinamic-clean-cristian` y el de producción están los dos en ejecución.
- [ ] Puertos host distintos.
- [ ] `GET https://<dominio-pruebas>/readyz` → 200.
- [ ] `GET https://<dominio-pruebas>/healthz` identifica el SHA desplegado, cuando ese campo exista.
- [ ] CORS del dominio de Vercel de pruebas responde, y un origen desconocido no.
- [ ] El certificado del dominio de pruebas es válido.
- [ ] El contenedor corre como usuario no root (`dinamic`, uid 10001), igual que el Dockerfile.
- [ ] Hay límite de memoria y CPU visible en `docker inspect`.
- [ ] Matar el proceso con `SIGTERM` termina sin dejar el contenedor en restart loop por el health.

## Frontend

- [ ] El dominio de pruebas sirve el build de la rama `cristian-pruebas`.
- [ ] Login de un usuario de prueba del proyecto de test entra y vuelve a `/`.
- [ ] Una llamada de red del browser va al API de pruebas.
- [ ] El bundle no contiene el ref `biectbcujabpjhinouil`.
- [ ] El dashboard carga o muestra el error de RLS de forma explícita, sin escribir en producción.

## Datos

- [ ] `app_migrations.forward_history` de test contiene los archivos forward que el release espera.
- [ ] Existen perfiles de prueba. El inventario de esta auditoría vio 0.
- [ ] No se restauró un dump de producción con empleados y clientes reales sobre el demo.
- [ ] Backup del proyecto de test tomado antes de la migración de puesta al día, y un restore de prueba en una base desechable.

## CI

- [ ] Push a `cristian-pruebas` corre el nivel 1.
- [ ] Un test que falla no reemplaza la imagen que responde `/readyz`.
- [ ] Un PR a `auditoria-nasser` aplica las migraciones en un CLI vacío y corre integración.
- [ ] El mismo PR no puede mergearse con un check rojo.
- [ ] Hace falta una revisión distinta del autor.
- [ ] Push directo a `main` está rechazado.
- [ ] Force-push a `cristian-pruebas`, `auditoria-nasser` y `main` está rechazado.

## Promoción

- [ ] Un ticket de ensayo nace de `main` y su diff no incluye los merges de realineación de `cristian-pruebas`.
- [ ] El PR a `main` sale de `auditoria-nasser`.
- [ ] El deploy de producción usa el SHA de ese merge.
- [ ] Después del deploy, `/readyz` de producción responde 200 y el SHA coincide.
- [ ] Un hotfix de ensayo mergeado a `main` se puede mergear de vuelta a `cristian-pruebas` sin rebase.

## Rollback

- [ ] Con `/readyz` forzado a fallar, el host vuelve al tag anterior.
- [ ] El log del intento fallido queda guardado y no contiene `DATABASE_URL` ni service role.
- [ ] Producción no cambió de contenedor durante el ensayo del demo.
