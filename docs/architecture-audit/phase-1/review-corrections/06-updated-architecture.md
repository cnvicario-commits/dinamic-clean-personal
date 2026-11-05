# 06 — Arquitectura actualizada

Esta nota reemplaza el dibujo en el que el frontend de Cristian era un segundo proyecto Vercel.

## Producción

- Frontend Next.js en Vercel.
- Backend Fastify en el VPS.
- Supabase Producción `biectbcujabpjhinouil`.

## Cristian

- Frontend Next.js en un contenedor Docker del mismo VPS.
- Backend Fastify en otro contenedor del mismo VPS, si el relevamiento muestra capacidad.
- Nginx con dominios y HTTPS para los dos.
- Supabase Test `edruejzwwnixsjsadbgb`, la misma que usa el desarrollo local.
- El deploy automático desde `cristian-pruebas` queda para más adelante. No se implementa en esta corrección.

## CI/CD futuro

Un mismo commit produce dos imágenes independientes, frontend y API, cada una con digest trazable y el mismo SHA. Se publican juntas. Si una no construye, no se toca el VPS. El workflow de pull request no recibe secretos de producción.

No se crea otro proyecto Vercel.

## Git

`GITHUB_BRANCH_PROTECTION_DEFERRED`. La falta de rulesets no frena esta corrección. Los PR los revisa el responsable técnico.

Los documentos `07-target-architecture.md`, `08-implementation-roadmap.md` y `phase-1/10-phase-2-readiness.md` quedaron alineados con este esquema. El roadmap de la fase 0 conserva el relevamiento original y apunta aquí.
