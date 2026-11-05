# 06 — Relevamiento de infraestructura

Ningún dato de esta sección fue inventado. Lo que no se pudo leer queda `NOT_ACCESSIBLE`.

## VPS

`NOT_ACCESSIBLE`. No hay configuración SSH usable desde esta máquina y no se abrió una sesión.

Script listo para que un administrador lo ejecute en el servidor, solo lectura, sin imprimir connection strings:

`scripts/recon-vps-readonly.sh`

Cubre host, CPU, RAM, disco, contenedores, stats, límites, redes, restart, labels de Compose, volúmenes, refs de Supabase extraídos del host o del usuario (no la URL), `server_name` / `listen` / `proxy_pass` de Nginx, nombres de certificados, listeners, timers de backup y log drivers.

Hasta pegar esa salida, no se decide el segundo stack.

## Vercel

`NOT_ACCESSIBLE`. No hay CLI `vercel`, no hay `.vercel/project.json` y no se creó un proyecto. Un administrador tiene que informar, sin pegar valores:

- proyecto productivo y Production Branch
- dominios
- framework y comando de build
- nombres de variables por entorno, no sus valores
- repositorio de GitHub conectado

El segundo proyecto de Vercel para `cristian-pruebas` no se crea en esta fase. `NEXT_PUBLIC_*` se hornean en el build; por eso el proyecto de demo no puede ser el de producción.

## GitHub

`gh auth status`: no hay login. No se leyeron environments, nombres de secrets, GHCR ni branch protection.

Workflows versionados: solo `.github/workflows/ci.yml`, ahora con el job de integración descrito en `05-ci-validation.md`.

`GITHUB_BRANCH_PROTECTION_DEFERRED`. La fase no se detiene por falta de rulesets. Los PR los revisa y autoriza el responsable técnico. Esa excepción no autoriza secretos de producción en un workflow de pull request.

Cuando haya `gh auth login` con permiso de lectura:

```bash
gh api repos/cnvicario-commits/dinamic-clean-personal/branches/main/protection
gh api repos/cnvicario-commits/dinamic-clean-personal/rulesets
gh api repos/cnvicario-commits/dinamic-clean-personal/environments
gh secret list
gh api repos/cnvicario-commits/dinamic-clean-personal/actions/permissions
```

Los secretos se listan por nombre. No se imprimen valores.
