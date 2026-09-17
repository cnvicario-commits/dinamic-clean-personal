# Dinamic Clean — Production Gates (G0–G10)

**Fecha:** 2026-09-15  
**Clasificación asociada:** `NOT_READY_FOR_ENTERPRISE_PRODUCTION`  
**Regla:** si falla cualquiera de G0–G6 → **no apto para producción empresarial**.

---

## Resumen

| Gate | Requisito | Estado |
|------|-----------|--------|
| G0 | Esquema productivo completo, versionado y reproducible | **FAIL** |
| G1 | Backend tradicional operativo | **FAIL** |
| G2 | Autorización server-side y RLS endurecida | **FAIL** |
| G3 | Procesos críticos transaccionales | **FAIL** |
| G4 | CI y pruebas críticas en verde | **FAIL** |
| G5 | Backups y restauración comprobados | **NO_VERIFICADO** / tratado como **FAIL** operativo |
| G6 | Monitoreo, alertas y audit log | **FAIL** |
| G7 | Pruebas de carga y concurrencia | **FAIL** |
| G8 | Staging y despliegue controlado | **NO_VERIFICADO** |
| G9 | Integración resiliente con Attendance | **FAIL** |
| G10 | Aprobación formal de salida a producción | **FAIL** |

**Decisión agregada:** **NO GO** a producción empresarial. **NO GO** a integración Attendance. **NO GO** a piloto controlado (requiere backend tradicional previo).

---

## G0 — Esquema productivo versionado

| Campo | Contenido |
|-------|-----------|
| **Estado** | `FAIL` |
| **Evidencia** | Migraciones asumen tablas preexistentes (`0002_compras_numeracion.sql`); sin `config.toml`; bucket `justificaciones` manual (`0030`); numeración `0002` duplicada |
| **Faltantes** | Baseline DDL completo; `pg_policies` prod; grants; storage IaC; historial de apply |
| **Responsable sugerido** | Database Architect + DevOps |
| **Criterio** | Shadow DB desde Git = prod (diff vacío salvo seeds) |
| **Pruebas** | `supabase db dump` / migrate apply en proyecto vacío; schema diff |
| **Decisión** | Bloquea DR y cualquier hardening serio |

## G1 — Backend tradicional operativo

| Campo | Contenido |
|-------|-----------|
| **Estado** | `FAIL` |
| **Evidencia** | Solo `/api/usuarios`; ~47 componentes mutan vía `createBrowserClient`; 0 Server Actions; 0 workers |
| **Faltantes** | API versionada; servicios; validación; OpenAPI; health; rate limit; data layer |
| **Responsable sugerido** | Software Architect + Staff SWE |
| **Criterio** | Mutaciones de negocio solo vía backend; browser no escribe tablas críticas |
| **Pruebas** | Inventory E2E: write PostgREST denegado; OpenAPI smoke |
| **Decisión** | **Requisito arquitectónico obligatorio incumplido** → no piloto |

## G2 — Autorización server-side + RLS

| Campo | Contenido |
|-------|-----------|
| **Estado** | `FAIL` |
| **Evidencia** | `permisos.ts` admite RLS permisivo; policies `USING (true)`; proxy solo navegación |
| **Faltantes** | RBAC en API; policies por rol; revoke grants; MFA admin (**NO VERIFICADO** remoto) |
| **Responsable sugerido** | AppSec + Backend |
| **Criterio** | Matriz rol×recurso×op en API y RLS; pentest roles PASS |
| **Pruebas** | Suite por rol PostgREST+API |
| **Decisión** | Bloquea datos de 200+ empleados |

## G3 — Procesos críticos transaccionales

| Campo | Contenido |
|-------|-----------|
| **Estado** | `FAIL` |
| **Evidencia** | `PanelComprasAsignacion` multi-insert; `CargaAuditoriaForm`; imports; duplicados; estados solo UI |
| **Faltantes** | Transacciones/RPC; state machines; idempotency keys; compensación |
| **Responsable sugerido** | Staff SWE + DB Architect |
| **Criterio** | Asignación compras / submit auditoría / upsert asistencia atómicos |
| **Pruebas** | Chaos mid-failure; transición ilegal 409 |
| **Decisión** | Bloquea centralización de compras/RRHH |

## G4 — CI y pruebas críticas

| Campo | Contenido |
|-------|-----------|
| **Estado** | `FAIL` |
| **Evidencia** | Sin `.github`; lint exit 1 (24 errors); 0 tests; scripts sin `test` |
| **Faltantes** | CI lint/tsc/build/unit/integration/RLS/e2e; secret+dep scanning |
| **Responsable sugerido** | QA Automation + DevOps |
| **Criterio** | PR no mergea si falla gate; cobertura mínima flujos P0 |
| **Pruebas** | Pipeline verde en PR ejemplo |
| **Decisión** | Bloquea calidad empresarial |

## G5 — Backups y restore

| Campo | Contenido |
|-------|-----------|
| **Estado** | `NO_VERIFICADO` (operativamente **FAIL** hasta evidencia) |
| **Evidencia** | Nada en repo; backups locales gitignored; restore drills no documentados |
| **Faltantes** | RPO/RTO; retención; restore probado; responsables; runbook |
| **Responsable sugerido** | SRE + owner Supabase |
| **Criterio** | Restore drill exitoso documentado ≤ RTO acordado |
| **Pruebas** | Restore a staging + checksum tablas críticas |
| **Decisión** | Sin G5 no hay producción crítica |

## G6 — Monitoreo, alertas, audit log

| Campo | Contenido |
|-------|-----------|
| **Estado** | `FAIL` |
| **Evidencia** | Sin APM/Sentry/OTel; errores UI; sin `audit_log` |
| **Faltantes** | Logs estructurados; request ID; métricas; alertas; audit negocio; health |
| **Responsable sugerido** | SRE |
| **Criterio** | Forense “quién/qué/cuándo” en mutaciones sensibles <15 min |
| **Pruebas** | Tabletop incidente + query audit |
| **Decisión** | Bloquea operación confiable |

## G7 — Carga y concurrencia

| Campo | Contenido |
|-------|-----------|
| **Estado** | `FAIL` |
| **Evidencia** | Sin load tests; listados sin paginar; imports en browser |
| **Faltantes** | Plan de carga (200 emp × 3 años asistencias); criterios P95; índices validados |
| **Responsable sugerido** | SRE + Backend |
| **Criterio** | P95 listados <2s; upsert asistencia concurrente correcto |
| **Pruebas** | k6/Locust escenarios definidos |
| **Decisión** | Requerido antes de ampliar uso histórico |

## G8 — Staging y despliegue controlado

| Campo | Contenido |
|-------|-----------|
| **Estado** | `NO_VERIFICADO` |
| **Evidencia** | Sin Dockerfile/CI/CD/vercel.json en repo |
| **Faltantes** | Staging; approvals; rollback; env separation |
| **Responsable sugerido** | DevOps |
| **Criterio** | Deploy prod solo desde main vía pipeline con approval |
| **Pruebas** | Dry-run deploy staging |
| **Decisión** | Verificar remoto; hoy no hay evidencia PASS |

## G9 — Integración Attendance

| Campo | Contenido |
|-------|-----------|
| **Estado** | `FAIL` |
| **Evidencia** | Sin M2M/outbox/contratos/workers; sync no puede ser browser |
| **Faltantes** | Todo el módulo integration (ver roadmap Fase 5) |
| **Responsable sugerido** | Integration specialist + Backend |
| **Criterio** | Sync staging idempotente + reconciliación + DLQ |
| **Pruebas** | Contract + replay + failure injection |
| **Decisión** | Bloqueado hasta G1–G3 + contratos |

## G10 — Aprobación formal producción

| Campo | Contenido |
|-------|-----------|
| **Estado** | `FAIL` |
| **Evidencia** | Gates G0–G6 no PASS |
| **Faltantes** | Sign-off AppSec, SRE, Arquitectura, Negocio, Legal/privacidad (si aplica) |
| **Responsable sugerido** | Steering committee |
| **Criterio** | Todos G0–G6 PASS; G7–G9 según alcance; checklist firmado |
| **Pruebas** | Go-live checklist |
| **Decisión** | **NO APPROVE** |

---

## Matriz de decisión rápida

```
G0-G6 all PASS?
  NO → NOT_READY_FOR_ENTERPRISE_PRODUCTION
  YES → G1 already implies backend exists
         → evaluate G7-G9 for scope
         → G10 committee
```
