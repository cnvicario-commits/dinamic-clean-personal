# Dinamic Clean — Evidencia auditoría empresarial

**Fecha:** 2026-09-15  
**Repositorio:** `/Users/nasserelbacha/Documents/Dinamic sistems/dinamic-clean-personal`  
**Remoto observado:** `https://github.com/cnvicario-commits/dinamic-clean-personal.git`  
**Tipo:** análisis estático + comandos locales no destructivos  
**Restricción:** sin modificar código de aplicación; sin tocar Supabase/hosting remoto.

Esta auditoría **extiende** (no reemplaza el valor histórico de) `dinamic-clean-technical-audit.md` / `dinamic-clean-audit-evidence.md`, elevando el estándar a **plataforma empresarial crítica** y al **requisito obligatorio de backend tradicional**.

---

## 1. Versiones del entorno de auditoría

| Herramienta | Versión |
|-------------|---------|
| Node | v22.14.0 |
| npm | 11.4.2 |
| Next (package) | 16.2.12 |
| React | 19.2.4 |
| OS | darwin 25.5.0 (host auditor) |

---

## 2. Archivos / áreas inspeccionadas

### Confirmado en repo

- `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`, `README.md`
- `src/proxy.ts`, `src/utils/permisos.ts`, `src/utils/supabase/{client,server,admin}.ts`
- `src/app/api/usuarios/route.ts` (único API privilegiado)
- `src/app/**` rutas (~41)
- `src/components/**` mutaciones Supabase (muestra exhaustiva vía ripgrep)
- `src/types/{compras,crm,auditoria,resultados}.ts`
- `supabase/migrations/*.sql` (33 archivos; **solo** carpeta `migrations/`)

### Ausencias relevantes (confirmadas)

- Sin `supabase/config.toml`, Edge Functions, seed formal
- Sin `.github/`, Dockerfile, `vercel.json`, workers/cron/queues
- Sin `.env*` en working tree
- Sin tests (`*.test.*` / `*.spec.*` de app)
- Sin Server Actions (`'use server'` no encontrado)

### Artefactos de auditoría previa reutilizados como contexto

- `dinamic-clean-technical-audit.md`
- `dinamic-clean-findings.csv`
- `dinamic-clean-remediation-roadmap.md`
- `dinamic-clean-audit-evidence.md`

---

## 3. Comandos ejecutados y resultados

```bash
npm ci                    # previo; node_modules presente
npx tsc --noEmit          # exit 0
npm run lint              # exit 1 — 24 errors, 1 warning
npm run build             # exit 0 (sesión previa) — 41 rutas; Proxy presente
npm audit                 # 7 vulns: 1 critical (next), 6 high (xlsx, postcss, sharp, …)
```

Conteos:

```text
CLIENT_CREATE (supabase/client): 47 archivos
SERVER_CREATE (supabase/server): 45 archivos
ADMIN_CREATE  (supabase/admin):  2 archivos (api/usuarios + usuarios/page)
```

Mutaciones browser confirmadas (muestra no exhaustiva de impacto):  
`empleados`, `asignaciones`, `asistencias`, `clientes`, `cliente_domicilios`, `empresas`, `proveedores`, `articulos`, `pedidos_*`, `ordenes_*`, `crm_*`, `auditoria_*`, `resultados_*`, Storage `presupuestos-clientes` / `justificaciones`.

---

## 4. Errores / limitaciones

| Limitación | Impacto |
|------------|---------|
| Sin credenciales Supabase prod | RLS live, Auth MFA, backups, Storage justificaciones → **NO VERIFICADO** |
| Sin acceso hosting/DNS/CI remoto | G5/G8 parcialmente **NO VERIFICADO** |
| Lint falla pero build pasa | Calidad no gated |
| Build OK ≠ producción OK | Regla explícita de esta auditoría |
| Migraciones ≠ prod garantizado | Drift posible |

---

## 5. Configuraciones faltantes a solicitar

1. Proyecto Supabase (URL, entornos, owners).  
2. Dump schema + `pg_policies` + grants + buckets.  
3. Confirmación migraciones aplicadas.  
4. Políticas bucket `justificaciones`.  
5. Hosting (Vercel/otro), env vars (metadatos, no secretos en tickets).  
6. Backups: frecuencia, retención, **último restore drill**.  
7. Inventario usuarios Auth + roles reales.  
8. ¿Existe ya algún backend/BFF no versionado aquí?  
9. Alcance Attendance (entidades, dirección sync, SLA).  
10. Requisitos legales/privacidad internos (solo para contexto técnico).

---

## 6. Consultas SQL read-only necesarias

Identical in spirit to auditoría técnica; mínimas para enterprise:

```sql
-- RLS enablement
select relname, relrowsecurity from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and relkind='r' order by 1;

-- Policies
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname in ('public','storage') order by 1,2;

-- USING(true)
select * from pg_policies
where schemaname='public' and (qual='true' or with_check='true');

-- perfiles policies (escalation)
select * from pg_policies where tablename='perfiles';

-- buckets
select * from storage.buckets;

-- volume projection
select 'empleados' t, count(*) from empleados
union all select 'asistencias', count(*) from asistencias
union all select 'pedidos_compra', count(*) from pedidos_compra
union all select 'ordenes_compra', count(*) from ordenes_compra
union all select 'crm_oportunidades', count(*) from crm_oportunidades
union all select 'perfiles', count(*) from perfiles;
```

Prueba adversarial (usuario no-admin):

1. `SELECT * FROM resultados_mensuales LIMIT 1;`  
2. `UPDATE ordenes_compra SET estado='recepcionada' WHERE id='…';`  
3. `UPDATE perfiles SET rol='admin' WHERE id=auth.uid();` ← crítico  

---

## 7. Evidencia remota pendiente

| Ítem | Estado |
|------|--------|
| pg_policies prod | NO VERIFICADO |
| Auth MFA / password policy remoto | NO VERIFICADO |
| Cookie flags prod | NO VERIFICADO |
| Backup/restore drills | NO VERIFICADO |
| Staging existence | NO VERIFICADO |
| Vercel/hosting security headers | NO VERIFICADO |
| Secret history git completo | NO VERIFICADO (working tree limpio de .env) |

---

## 8. Diferencias repo vs producción (hipótesis controlada)

| Hipótesis | Base | Estado |
|-----------|------|--------|
| Prod tiene tablas RRHH/compras no creadas en migraciones | Comentarios SQL + uso app | PROBABLE → casi certeza operacional |
| Policies prod ≈ migraciones `USING(true)` | Código asume RLS “real” pero policies permisivas | PROBABLE |
| Existen policies extra aplicadas a mano | SQL Editor workflow | HIPÓTESIS |
| Justificaciones con policy distinta | Dashboard-only | NO VERIFICADO |

---

## 9. Diferenciación metodológica

1. **Evidencia confirmada** — código/SQL/comandos locales.  
2. **Riesgo probable** — patrón fuerte sin live verify.  
3. **Información faltante** — requiere acceso remoto.  
4. **Hipótesis** — plausible, no demostrada.  
5. **Recomendación opcional** — mejora no bloqueante.

---

## 10. Artefactos generados (enterprise)

| Archivo | Rol |
|---------|-----|
| `dinamic-clean-enterprise-audit.md` | Informe integral |
| `dinamic-clean-enterprise-findings.csv` | Hallazgos |
| `dinamic-clean-enterprise-remediation-roadmap.md` | Fases 0–6 |
| `dinamic-clean-enterprise-evidence.md` | Este documento |
| `dinamic-clean-backend-migration-inventory.csv` | Migración ops→backend |
| `dinamic-clean-production-gates.md` | G0–G10 |
