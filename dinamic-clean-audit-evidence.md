# Dinamic Clean — Evidencia de auditoría

**Fecha:** 2026-09-15  
**Repositorio:** `/Users/nasserelbacha/Documents/Dinamic sistems/dinamic-clean-personal`  
**Remoto observado:** `https://github.com/cnvicario-commits/dinamic-clean-personal.git`  
**Alcance:** análisis estático del código versionado + comandos locales no destructivos.  
**Restricción respetada:** sin modificaciones al sistema de aplicación; sin cambios en Supabase remoto; sin comandos destructivos.

---

## 1. Archivos e inspecciones realizadas

### 1.1 Inventario estructural

- Raíz: `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `README.md`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`
- Código: `src/app/**` (≈41 rutas App Router), `src/components/**` (≈100 componentes), `src/utils/**`, `src/types/**`, `src/proxy.ts`
- Base de datos versionada: `supabase/migrations/*.sql` (33 archivos; **no** hay `supabase/config.toml`, **no** hay Edge Functions en el repo)
- Ausencias relevantes: `.env*`, `.github/`, CI, tests, `Dockerfile`, `vercel.json`, `supabase/seed.sql`, `supabase/functions/`

### 1.2 Archivos de seguridad / auth leídos de punta a punta

| Archivo | Motivo |
|---------|--------|
| `src/proxy.ts` | gate de sesión y roles |
| `src/utils/permisos.ts` | matriz de rutas por rol |
| `src/utils/supabase/{client,server,admin}.ts` | claves y clientes |
| `src/app/api/usuarios/route.ts` | creación/cambio de usuarios con service role |
| `src/app/login/page.tsx`, `src/app/page.tsx`, `src/app/layout.tsx` | flujo de sesión |
| `src/components/AusenciaForm.tsx` | storage + signed URLs |
| `src/components/ClientePresupuestosPanel.tsx` | storage presupuestos |
| `src/types/compras.ts` | modelo `empresa` / documentos |
| Migraciones `0001`, `0007`, `0014`, `0015`, `0018`, `0028`, `0030`, `0031` | RLS y esquema |

### 1.3 Exploración asistida (solo lectura)

- Inventario completo de migraciones (tablas, políticas, funciones, storage).
- Auditoría de auth/API/secretos en `src/`.

---

## 2. Comandos ejecutados y resultados

### 2.1 Instalación

```bash
npm ci
```

**Resultado:** OK (494 packages). Advertencias de peer dependency `@emnapi/runtime`.  
**Al terminar:** `npm` reportó **7 vulnerabilidades (6 high, 1 critical)**.

### 2.2 Type-check

```bash
npx tsc --noEmit
```

**Resultado:** exit `0` (sin errores de tipos).

### 2.3 Lint

```bash
npm run lint
```

**Resultado:** exit `1` — **24 errors, 1 warning**.

Hallazgos principales:

- `@typescript-eslint/no-explicit-any` en páginas de listados/dashboard/reportes.
- `react/no-unescaped-entities` en textos de UI.
- `react-hooks/set-state-in-effect` en `NavBar.tsx:98`.
- `react-hooks/exhaustive-deps` warning en `ArticulosTabla.tsx`.

**Nota:** el script `lint` existe, pero **no hay CI** que lo ejecute; el build de Next **no** falla por estos errores de ESLint.

### 2.4 Build

```bash
npm run build
```

**Resultado:** exit `0`.

```
Next.js 16.2.12 (Turbopack)
✓ Compiled successfully
✓ Finished TypeScript
✓ Generating static pages (41/41)
ƒ Proxy (Middleware) presente
```

**Limitación:** el build no valida RLS, no ejecuta la app contra Supabase, y no demuestra corrección funcional.

### 2.5 Auditoría de dependencias

```bash
npm audit
```

| Paquete | Severidad | Notas |
|---------|-----------|-------|
| `next@16.2.12` | **critical** | RCE (Windows / Image Optimization AVIF); fix sugerido `16.3.5` vía `--force` |
| `xlsx@*` | **high** | Prototype Pollution + ReDoS; **sin fix** en el paquete community |
| `postcss`, `sharp`, `brace-expansion`, `js-yaml`, `nanoid` | high | transitivas / tooling |

### 2.6 Inventarios auxiliares

```bash
wc -l src/components/*.tsx …   # PanelComprasAsignacion.tsx ≈590 líneas (mayor)
find src -name '*.tsx' | wc -l # 140
rg "as any|: any" …            # ≈16 usos
rg "\.select\('\*'\)" …        # ≈21 ocurrencias
ls supabase/                   # solo migrations/
```

### 2.7 Secretos en árbol de trabajo

```bash
# búsqueda de patrones de secretos / service_role / JWT-like
```

**Resultado:** no se encontraron `.env*` ni claves `service_role` versionadas. Solo referencias a `process.env.SUPABASE_SERVICE_ROLE_KEY` en `admin.ts`.  
**NO VERIFICADO:** historial git completo de secretos filtrados; valores en Vercel/hosting; dashboard Supabase.

---

## 3. Errores / limitaciones del entorno de auditoría

| Limitación | Impacto |
|------------|---------|
| Sin acceso al proyecto Supabase remoto | RLS real de tablas preexistentes (`empresas`, `empleados`, `pedidos_*`, etc.) **NO VERIFICADO** |
| Sin `SUPABASE_*` en el entorno local | no se pudo consultar `pg_policies` / Auth / Storage live |
| Sin tests automatizados en el repo | cobertura = 0 |
| Sin CI | no hay evidencia de gates de calidad en merge |
| Migraciones incompletas (esquema base fuera del repo) | reconstrucción productiva imposible solo desde git |
| Bucket `justificaciones` creado en dashboard | políticas de storage **NO VERIFICADAS** |
| Políticas UPDATE/INSERT/DELETE de `perfiles` no versionadas | auto-elevación de rol vía PostgREST **NO VERIFICADA** |
| Cookie flags (`HttpOnly`, `Secure`, `SameSite`) | dependen de runtime `@supabase/ssr` + hosting |

---

## 4. Información a solicitar a los responsables

1. **Proyecto Supabase:** URL del proyecto, entorno(s) (dev/staging/prod), quién administra.
2. **Export completo del esquema:**
   - DDL de tablas preexistentes no creadas en migraciones.
   - `pg_policies` de **todas** las tablas públicas y `storage.objects`.
   - Functions, triggers, grants, roles.
3. **Confirmación de qué migraciones se aplicaron** (y si se aplicaron a mano en SQL Editor).
4. **Políticas del bucket `justificaciones`** y si es público/privado.
5. **Lista de usuarios Auth** (cantidad, roles) y proceso de onboarding.
6. **Hosting:** Vercel u otro; variables de entorno configuradas; dominio; HTTPS.
7. **Backups:** frecuencia, retención, restore drills.
8. **Datos personales** en migraciones `0019`/`0022`: ¿hay PII real en el repo? ¿consentimiento / minimización?
9. **Intención multiempresa:** ¿el producto debe servir a múltiples clientes/organizaciones, o es una app interna de Dinamic Clean con dos razones sociales (Dinamic/Moral)?
10. **Alcance de integración Dinamic Attendance:** qué entidades se sincronizarán (empleados, asistencias, clientes, etc.).

---

## 5. Consultas SQL de solo lectura recomendadas (Supabase SQL Editor)

Ejecutar en **solo lectura** / con rol de auditoría. No modificar datos.

```sql
-- 1) Tablas sin RLS
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- 2) Políticas por tabla
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by tablename, policyname;

-- 3) Tablas autenticadas con USING (true) — inspección humana del qual
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true');

-- 4) Políticas de perfiles (crítico para escalada de rol)
select * from pg_policies where tablename = 'perfiles';

-- 5) Storage buckets
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets;

-- 6) Políticas storage
select * from pg_policies where schemaname = 'storage';

-- 7) Functions SECURITY DEFINER
select n.nspname, p.proname, p.prosecdef, pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef = true;

-- 8) Constraints de rol
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.perfiles'::regclass;

-- 9) Inventario de FKs
select
  tc.table_name, kcu.column_name,
  ccu.table_name as foreign_table, ccu.column_name as foreign_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
order by 1;

-- 10) Conteos orientativos (volumen)
select 'empleados' as t, count(*) from empleados
union all select 'asistencias', count(*) from asistencias
union all select 'clientes', count(*) from clientes
union all select 'pedidos_compra', count(*) from pedidos_compra
union all select 'crm_oportunidades', count(*) from crm_oportunidades
union all select 'perfiles', count(*) from perfiles;
```

### Prueba de autorización (manual, con usuario no-admin)

Con un usuario de rol `auditoria` o `supervisor`, desde el cliente JS o REST de PostgREST:

1. `SELECT * FROM resultados_mensuales LIMIT 5;` — ¿devuelve filas? (esperado con políticas actuales: **sí**)
2. `UPDATE crm_oportunidades SET estado = 'perdida' WHERE id = '<uuid>';` — ¿permite? (esperado: **sí** si RLS es `using (true)`)
3. `UPDATE perfiles SET rol = 'admin' WHERE id = auth.uid();` — **crítico**; resultado **NO VERIFICADO** en repo.

---

## 6. Exportaciones / capturas necesarias del dashboard de Supabase

| # | Qué exportar | Para qué |
|---|--------------|----------|
| A | Authentication → Users (count + providers) | inventario de cuentas |
| B | Authentication → Policies / URL config | redirects, site URL |
| C | Database → Roles / Grants | privilegios `anon`/`authenticated`/`service_role` |
| D | Storage → buckets + policies screenshots | `justificaciones`, `presupuestos-clientes` |
| E | Database → Extensions | confirmar `pg_trgm` y otras |
| F | Project Settings → API keys (solo metadatos: qué keys existen; **no** pegar secrets en tickets) | confirmar que service_role no está en frontend |
| G | Logs (Auth + API) de una semana | abuso / errores |
| H | Backups schedule | operación |

---

## 7. Diferenciación comprobado vs inferido

| Afirmación | Estado |
|------------|--------|
| Políticas `authenticated_all` / `using (true)` en migraciones versionadas | **COMPROBADO** |
| Roles de app no se reflejan en la mayoría de RLS | **COMPROBADO** (comentarios + SQL) |
| `empresas` = razón social interna, no tenant SaaS | **COMPROBADO** (tipos + UI empleados DINAMIC/MORAL) |
| Esquema base (RRHH/compras headers) fuera del repo | **COMPROBADO** (comentarios en migraciones + uso en app) |
| RLS productiva idéntica a migraciones | **INFERIDO / NO VERIFICADO** |
| Usuario puede auto-promoverse a admin vía `perfiles` | **NO VERIFICADO** (falta política UPDATE) |
| Explotabilidad inmediata en producción | **PROBABLE** si migraciones se aplicaron tal cual y hay usuarios no-admin |

---

## 8. Artefactos generados por esta auditoría

| Archivo | Contenido |
|---------|-----------|
| `dinamic-clean-technical-audit.md` | informe integral |
| `dinamic-clean-findings.csv` | hallazgos tabulares |
| `dinamic-clean-remediation-roadmap.md` | plan por fases |
| `dinamic-clean-audit-evidence.md` | este documento |

Ninguno de estos archivos modifica el comportamiento de la aplicación.
