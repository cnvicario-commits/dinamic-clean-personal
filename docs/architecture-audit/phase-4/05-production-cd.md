# 05 — Despliegue de producción

Archivo: `.github/workflows/cd-production.yml`.

Sigue siendo solo `workflow_dispatch`. Antes de usar el environment `production`, el job lee la corrida de CI del mismo SHA en `main` y `scripts/ci/evaluate-production-deploy-gate.mjs` exige confirmación `deploy-production`, `PRODUCTION_DEPLOY_ENABLED=true` y un push de CI exitoso. La imagen se publica como `production-<sha>` y el SSH envía el digest.

`scripts/deploy/production-remote-apply.sh` rechaza la ejecución si `PRODUCTION_COMPOSE_REVIEWED` no es `operator-reviewed`. Cuando ese control pasa, el recorrido es pull por digest, `docker compose config`, recreación solo de `api`, health y recién entonces el commit del registro. El puerto por defecto sigue siendo `3005`. Esta sesión no lo ejecutó contra el VPS. El Compose que acepta tiene que estar bajo `/opt/dinamic-clean-privileged/compose/`, nombrar el contenedor `dinamic-clean-api`, publicar `3005` y no contener el ref de Test ni `cristian-pruebas`. Esos marcadores salen de la descripción operativa, no de una lectura nueva del servidor. `scripts/deploy/production-readonly-diagnose.sh` solo imprime comandos de lectura. Esta sesión no los ejecutó. El Compose real del VPS queda pendiente.

`/healthz` exige el SHA. `/readyz` exige `status=ready`. El estado productivo es independiente, en `/var/lib/dinamic-clean/production/api.json`.

## Vercel

`VERCEL_INTEGRATION_NOT_VERIFIED`

No hay CLI ni `.vercel/project.json`. No se agregó `vercel deploy`. El checklist para una revisión posterior es:

- proyecto vinculado y rama productiva;
- si el merge a `main` ya despliega solo;
- variables por entorno y ausencia del ref de Test;
- alias productivo;
- cómo se revierte un deployment;
- cómo se promociona un deployment ya construido.

Hasta leer eso, el workflow de API no debe acompañarse de otra publicación del frontend.
