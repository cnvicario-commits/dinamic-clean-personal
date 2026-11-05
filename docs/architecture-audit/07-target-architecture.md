# 07 — Arquitectura objetivo

## Entornos

| | Local | `cristian-pruebas` | Integración | Producción |
|--|-------|--------------------|-------------|------------|
| Rama | la de trabajo del desarrollador | `cristian-pruebas` | efímera, en el PR a `auditoria-nasser` | `main` |
| Frontend | `next dev` en :3000, contra Supabase Test | Contenedor Docker en el mismo VPS, detrás de Nginx | No persistente. El build de CI basta | Proyecto Vercel de producción |
| Backend | `npm run dev` en :3001, contra Supabase Test | Otro contenedor Docker en el mismo VPS, si la capacidad lo permite | No persistente | Contenedor Fastify del VPS |
| Base | Supabase Test `edruejzwwnixsjsadbgb`, compartida con la demo | la misma Supabase Test | Supabase CLI del job | `biectbcujabpjhinouil` |
| Auth y Storage | los del stack local | los del proyecto de test | los del CLI | los de producción |
| Credenciales | `.env` local, gitignored | Environment GitHub `cristian-pruebas` y env de Vercel de ese proyecto | generadas por el job | Environment `production` y env de Vercel de producción |
| Migraciones | libres sobre la base desechable | job con aprobación, después de backup | cada PR, desde cero | ventana con backup y precheck |
| Tests | unitarios al commitear | nivel 1 | nivel 2 bloqueante | nivel 3 sobre el SHA ya verde |
| Deploy | ninguno | push de la rama, si el nivel 1 pasa | ninguno a un servidor | aprobación y smoke |
| Acceso | desarrolladores | Cristian y usuarios de prueba de la empresa | el runner | operación |
| Rollback | recrear la base local | tag de imagen anterior | se descarta el runner | tag anterior. SQL destructivo solo con backup |

### Por qué no hay un servidor persistente para `auditoria-nasser`

Esa rama es una cola de revisión. El 2026-11-05 su árbol es idéntico a `main` y a `cristian-pruebas`. Un cuarto entorno con base propia duplicaría migraciones y datos sin un usuario que lo pruebe: quien prueba funcionalmente usa `cristian-pruebas`. Los defectos de integración los tiene que encontrar el CI efímero del PR. Un preview de Vercel por PR es opcional y puede apuntar a un API efímero solo si más adelante hace falta ver UI. No es requisito de la primera entrega.

## Matriz de aislamiento

| Desde \\ hacia | Local | Test cloud | Producción |
|----------------|-------|------------|------------|
| Proceso local de desarrollo | no es el destino de `npm run dev` | destino compartido con la demo | rechazado si el ref no coincide con Test |
| Contenedor `cristian-pruebas` | no | mismo proyecto Test | el proceso no arranca si el ref es el de producción |
| CI del PR | no | no | sin secretos de ese environment |
| API de producción | no | no | único destino |
| Runner de migraciones de test | no | `MIGRATIONS_DATABASE_URL` de test, fuera del contenedor | no está en ese environment |
| Runner de migraciones de producción | no | no | solo environment `production` |

## Diagramas

### Actual, verificada

```mermaid
flowchart TB
  dev[Desarrollador local]
  testDB[(Test edruejzwwnixsjsadbgb)]
  prodDB[(Producción biectbcujabpjhinouil)]
  gh[GitHub main y PRs]
  ci[ci.yml sin deploy]
  dev -->|env local| testDB
  gh --> ci
  prodDB -.->|datos operativos sin pipeline en el repo| prodUnknown[VPS y Vercel no accesibles]
```

### Objetivo

```mermaid
flowchart TB
  subgraph localEnv [Local]
    nextDev[Next dev]
    apiDev[API dev]
    testDB[(Supabase Test)]
  end
  subgraph demo [cristian-pruebas en el VPS]
    nginx[Nginx HTTPS]
    webDemo[Contenedor Next]
    apiTest[Contenedor Fastify]
  end
  subgraph ciEnv [PR]
    gha[GitHub Actions]
    cli[(Supabase CLI efímero)]
  end
  subgraph prod [Producción]
    vercelProd[Vercel]
    apiProd[Fastify en el VPS]
    prodDB[(Supabase Producción)]
  end
  nextDev --> apiDev --> testDB
  nginx --> webDemo
  nginx --> apiTest
  webDemo --> testDB
  apiTest --> testDB
  gha --> cli
  vercelProd --> apiProd --> prodDB
```

### Git

```mermaid
flowchart LR
  main[main]
  ticket[DIN-xxx]
  audit[auditoria-nasser]
  demo[cristian-pruebas]
  main --> ticket
  ticket --> audit
  audit --> main
  main --> demo
```

### Promoción

```mermaid
flowchart TD
  work[Cristian prueba en el demo]
  branch[Rama desde main con el ticket]
  pr1[PR a auditoria-nasser]
  gate[Nivel 2 en CLI efímero]
  pr2[PR a main]
  approve[Aprobación production]
  mig[Migración de producción si hace falta]
  ship[Deploy del SHA y smoke]
  work --> branch --> pr1 --> gate --> pr2 --> approve --> mig --> ship
```

## Observabilidad mínima para reconocer un deploy

Hoy `/healthz` responde `{ status: 'ok' }` sin versión (`apps/api/src/http/routes/health.ts`). `/readyz` sí distingue base caída y esquema incompatible de fase 2D/3A.

Para cada instancia, el objetivo es poder responder:

| Pregunta | Cómo |
|----------|------|
| Qué versión corre | `APP_RELEASE_SHA` en `/healthz` y tag de imagen igual al SHA |
| Qué migraciones tiene | `select filename from app_migrations.forward_history` ejecutado por un operador, no por el proceso web |
| Si la base responde | `/readyz` 200 |
| Si el frontend habla con esa API | `NEXT_PUBLIC_API_URL` del build de ese proyecto Vercel, comprobado en el smoke |
| Si el deploy dejó errores | logs Pino del contenedor de esa instancia, con `request.id` ya implementado |

CPU, memoria y alertas no están en el repo. En Compose se fijan límites del servicio de pruebas para que no compita sin tope con producción en el mismo VPS. La alerta del primer corte es el check de GitHub en rojo más el fallo de `/readyz`.
