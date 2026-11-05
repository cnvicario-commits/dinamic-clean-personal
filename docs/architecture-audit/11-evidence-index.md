# 11 — Índice de evidencia

Fecha: 2026-11-05. Rama de trabajo local al relevar: `DIN-417` en `18ec97b`, mismo commit que `origin/auditoria-nasser`. `git status` no mostró cambios de archivos antes de escribir esta carpeta.

## Comandos y consultas usadas

| Acción | Resultado útil | Límite |
|--------|----------------|--------|
| `git remote -v`, `git branch -a`, `git status -sb`, `git log` | remote `cnvicario-commits/dinamic-clean-personal`. Ramas `main`, `auditoria-nasser`, `cristian-pruebas` existen | Refs locales. No se hizo fetch en esta sesión |
| `git rev-list --left-right --count` y `git rev-parse <rama>^{tree}` | Árbol único `dc158fccd60f44e91784f020ade52a219d1e96d2`. `main` +1 commit vacío de diff sobre `auditoria-nasser`. `cristian-pruebas` +13 commits y diff vacío | No dice si el remote avanzó después del último fetch |
| `git diff --stat origin/main origin/cristian-pruebas` | Vacío | — |
| Lectura de `package.json`, `apps/api/package.json`, `next.config.ts`, `apps/api/src/config/env.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `health.ts`, `pool.ts`, `jwt.ts`, `rbac.ts`, `Dockerfile`, `deploy/docker-compose.api.yml`, `.github/workflows/ci.yml` | Arquitectura de las secciones 02 y 06 | No se ejecutaron lint, test ni build |
| Inventario de `src/app/**/page.tsx` | 50 páginas | — |
| Búsqueda de `.from('` en `src` | dashboard, empresas, layout, proxy | No prueba que RLS permita o niegue esas lecturas |
| `list_projects` / `get_project` | Tres proyectos. Dos activos | La cuenta puede no ver otros proyectos de la empresa |
| `list_edge_functions` | Vacío en ambos activos | — |
| `list_migrations` | Test: `20260923140000_phase3a_core_hr`, `20260923143000_phase3b_attendance`. Producción: vacío | Es el libro del CLI, no `app_migrations.forward_history` |
| `list_tables` schema `public`, `verbose: false` | Desfase de tres tablas y órdenes de magnitud de filas | Filas posiblemente estimadas. No se listó `auth` ni `storage` |
| `execute_sql` de existencia de `forward_history` | No corrido | Bloqueado por la revisión automática de la sesión |
| Nombres de variables en `.env.local`, `apps/api/.env`, `apps/api/.env.local` | Ref de test, CORS localhost, service role solo en la raíz | Valores secretos no copiados. Estos archivos están en `.gitignore` |
| `gh auth status` y API de protection | Sin login | Rulesets `NOT_ACCESSIBLE` |
| Búsqueda de `vercel.json`, nginx, Playwright, `docs/phase-1-deploy-runbook.md` | Ausentes | No prueba que el VPS no tenga Nginx |

## Archivos de configuración citados

- `.env.example`, `apps/api/.env.example`
- `supabase/config.toml`
- `supabase/ops/create_api_role.sql`
- `supabase/baseline/003_storage.sql`
- `supabase/migrations/forward/README.md`
- `scripts/apply-forward-migrations.sh`
- `scripts/restore-development.sh`
- `apps/api/scripts/check-db-compatibility.mjs`
- `apps/api/scripts/clone-production-to-simulation.sh` (no ejecutado)
- `apps/api/tests/supabase-test-guard.ts`
- `apps/api/vitest.config.ts`, `vitest.config.ts`

## Conteos

- Forward SQL: 28 archivos en `supabase/migrations/forward/`.
- Tests API: 81 `*.test.ts`.
- Tests frontend: 3.
- Workflows: 1.

## Relevamiento pendiente en el VPS

Ejecutar como un usuario de lectura. No imprimir `.env`.

```bash
# identidad y recursos
uname -a
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
docker stats --no-stream
df -h
free -h

# compose y redes, sin volcar env
docker inspect --format '{{.Name}} {{.HostConfig.RestartPolicy.Name}} {{.HostConfig.Memory}}' $(docker ps -q)

# proxy y certificados, si existen
sudo nginx -T 2>/dev/null | awk '($1=="server_name"||$1=="listen"||$1=="proxy_pass"){print}'
sudo certbot certificates 2>/dev/null | awk 'NR==1 || /Certificate Name|Domains|Expiry/'

# firewall, sin reglas que revelen secretos
sudo ufw status verbose 2>/dev/null || sudo nft list ruleset 2>/dev/null | head

# refs de los procesos, no las URLs completas
# extraer solo el subdominio de SUPABASE_URL desde el env del contenedor
```

En Vercel, anotar proyecto, Production Branch, dominios y el nombre de cada variable por entorno. El valor de las claves no se copia al informe. Se anota únicamente el project ref embebido en `NEXT_PUBLIC_SUPABASE_URL`.

En GitHub, con `gh auth login`:

```bash
gh api repos/cnvicario-commits/dinamic-clean-personal/branches/main/protection
gh api repos/cnvicario-commits/dinamic-clean-personal/rulesets
gh api repos/cnvicario-commits/dinamic-clean-personal/branches/auditoria-nasser/protection
gh api repos/cnvicario-commits/dinamic-clean-personal/branches/cristian-pruebas/protection
```

En ambos proyectos Supabase, cuando haya una consulta de solo lectura aprobada:

```sql
select filename, applied_at
from app_migrations.forward_history
order by filename;
```

Y un conteo de `auth.users` y `public.perfiles` sin listar emails.

## Qué no se hizo

- No se corrieron tests, lint, build ni migraciones.
- No se abrió el VPS ni Vercel.
- No se leyeron policies RLS ni grants efectivos del rol conectado.
- No se confirmó el SHA que está corriendo en producción.
- No se modificó DNS, GitHub, Supabase ni contenedores.
- Los documentos de esta carpeta son el único cambio producido por la auditoría.
