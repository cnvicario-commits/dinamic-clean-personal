# 07 — Decisiones de arquitectura

Estado de fase 0: `PHASE_0_PARTIALLY_VERIFIED`.

## Confirmadas

| Decisión | Evidencia | Riesgo que queda |
|----------|-----------|------------------|
| Dos proyectos Supabase distintos. Producción es `biectbcujabpjhinouil`. El demo usa `edruejzwwnixsjsadbgb` | Conteos, historial y grants de esta pasada. El env local ya apunta al de test | Test está 7 migraciones atrás y `anon` todavía tiene DML sobre `empresas` |
| No promover `cristian-pruebas` como PR | Los tres árboles Git siguen iguales y el historial de la demo ya tiene 13 commits de rebase sin diff. Sigue vigente el relevamiento del 2026-11-05 | Un cherry-pick incompleto no compila. Lo tiene que atrapar el CI, no el acuerdo verbal |
| Tickets `DIN-xxx` desde `main`. Merge de `main` hacia la demo. Sin rebase de `cristian-pruebas` | El rebase previo duplicó commits | Conflictos cuando un hotfix toca archivos que la demo también tocó |
| CI de integración en Supabase CLI, modo simulation, rechazando los dos refs cloud | `supabase-test-guard.ts` ya tiene esa rama. El CLI está instalado. `config.toml` pide Postgres 17 | La versión del CLI no se imprimió. El guard todavía no envuelve todas las suites |
| Deploy privilegiado definido en `main` con `workflow_run`, no en el YAML de `cristian-pruebas` | `ci.yml` no tiene environments. El modelo de GitHub ejecuta el YAML de la rama que dispara el push | El plan de GitHub y los permisos de Cristian no se leyeron |
| Imagen identificada por digest y por SHA | El Compose actual etiqueta `dinamic-clean-api:local` | GHCR no está creado |
| Migraciones fuera del push | `apply-forward-migrations.sh` commitea archivo por archivo y no tiene down seguro | Un operador puede apuntar `MIGRATIONS_DATABASE_URL` al proyecto equivocado. El job tiene que fijar el ref |
| Segundo proyecto Vercel para el demo | `NEXT_PUBLIC_*` se hornean en el build | El proyecto productivo no se pudo leer. La recomendación no está contrastada con la configuración real |
| Mismo VPS solo si el relevamiento muestra aislamiento | No hay evidencia de host | Si el env o el puerto 3001 son únicos, el segundo stack no se instala ahí |

## Procedimiento Git

No se modificó ninguna rama.

1. La demo sigue en `cristian-pruebas`. Puede juntar varias features. Eso no sale a revisión.
2. Para promover un ticket se crea `DIN-xxx` desde `origin/main` actualizado.
3. Si el trabajo solo existe en la demo, se listan los commits con `git log --oneline origin/main..origin/cristian-pruebas` y se cherry-pickean en orden, solo los de ese ticket.
4. Un commit que mezcla dos tickets se aplica con el contenido del ticket, no con `git cherry-pick` ciego del commit entero. El PR tiene que quedar con un diff que se explica por el ticket.
5. Si el cherry-pick no compila o depende de otro ticket que no está en `main`, no se parte el ticket a mano en el servidor: se declara la dependencia y los dos entran en un solo PR, o el segundo espera a que el primero esté en `main`.
6. El PR entra a `auditoria-nasser`. Los checks corren sobre el merge ref, con la rama al día.
7. El PR de `auditoria-nasser` a `main` usa merge commit. El workflow de `main` construye ese SHA nuevo. No se despliega el tag armado en la rama del ticket.
8. Después del merge a `main`, se mergea `main` en `cristian-pruebas`. Sin rebase y sin reset.
9. Un hotfix nace en `main`, se despliega desde `main`, y baja a `auditoria-nasser` y a `cristian-pruebas` con el mismo merge.

El historial duplicado que ya está en `cristian-pruebas` se deja. Reescribirlo repite el problema que muestran los commits `Align cristian-pruebas with main`.

## Qué no quedó confirmado

- Capacidad y topología del VPS.
- Existencia del proyecto Vercel, su dominio y sus variables.
- Branch protection, environments, admins y si el plan permite ruleset workflows.
- Site URL de Auth en los dos proyectos cloud.
- Versión exacta del Supabase CLI.
