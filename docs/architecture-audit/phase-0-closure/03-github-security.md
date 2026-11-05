# 03 — Seguridad de GitHub

Estado de la configuración viva: `NOT_ACCESSIBLE`.

`gh auth status` responde que no hay login. No se pudieron leer branch protection, rulesets, environments, secrets ni administradores. GHCR tampoco se consultó. El único workflow versionado sigue siendo `.github/workflows/ci.yml`: push a `main` y `master`, y todo pull request. No declara `permissions:` ni `environment:`. No despliega. Un push a `cristian-pruebas` no lo dispara.

## Hecho de diseño

Un GitHub Environment no aísla secretos si el workflow que los recibe está en la rama que Cristian puede editar. El job corre el YAML de esa rama. Quien cambia el YAML puede imprimir los secretos del environment que el job tiene permitido usar.

La lógica privilegiada tiene que vivir en un workflow cuya definición sale de `main`, no del commit de `cristian-pruebas`.

## Control concreto

1. El workflow de la rama de Cristian, si existe, solo hace lint, typecheck y tests sin secretos. `permissions: contents: read`. Sin `packages: write`. Sin SSH.
2. En `main` hay un workflow `workflow_run` que escucha el CI de la misma repo. GitHub ejecuta el archivo que está en la rama por defecto, no el archivo del commit que disparó el evento. Cristian no puede cambiar ese archivo empujando a `cristian-pruebas`.
3. Ese workflow lee `github.event.workflow_run.head_branch` y `head_sha`.
   - Si la rama es `cristian-pruebas` y el CI terminó bien, construye la imagen de ese SHA y despliega con el environment `cristian-pruebas`.
   - Si la rama es `main`, usa el environment `production`.
   - Cualquier otra rama no despliega.
4. El environment `production` limita las ramas a `main` y exige un revisor. El environment `cristian-pruebas` contiene solo el ref `edruejzwwnixsjsadbgb`, la service role de test, el `DATABASE_URL` de `dinamic_api` de test y la llave SSH del usuario `deploy-cristian`.
5. La llave SSH no entra al contenedor. El script de `main` hace `docker compose pull` del digest y `up`. El env del contenedor lo arma ese script con las variables de test.
6. Cristian no es admin del repo, no puede editar environments y no puede aprobar el environment `production`.
7. `.github/workflows/**` en un PR hacia `main` o `auditoria-nasser` exige revisión del responsable técnico. Esto cubre el caso en que el cambio de workflow entra por PR. No cubre, por sí solo, un check obligatorio falsificado desde la rama del PR.

## Límites de este control

GitHub asocia los required status checks por nombre. Un workflow modificado en el PR puede crear un check con el mismo nombre y dejarlo en verde. El environment no impide eso.

El cierre técnico, cuando el plan de GitHub lo permita, es un ruleset que exige un workflow definido en la rama por defecto. Hasta ver el plan y los permisos, el gate de merge depende de esa capacidad o de un repositorio de CI aparte al que Cristian no pueda hacer push. Queda como bloqueo de la fase de quality gates, no como algo ya configurado.

## Matriz de ataques

| Ataque | Qué lo corta |
|--------|----------------|
| Exfiltración de secretos de producción | Esos secretos no están en ningún job que evalúe YAML de `cristian-pruebas` |
| Exfiltración de secretos de test | Posible solo si el YAML de la rama recibe ese environment. El diseño no se lo da. El `workflow_run` de `main` sí los usa, y Cristian no edita ese archivo |
| Deploy no autorizado a producción | El script confiable ignora toda rama distinta de `main` para el environment `production` |
| Deploy del demo con código no revisado | Es el comportamiento pedido. El código no revisado corre solo con credenciales de test |
| Inyección en el script de deploy | El script no concatena títulos de commit ni mensajes del PR en un shell. El único identificador que pasa a `docker` es el SHA de 40 hex y el digest `sha256:` |
| Modificación del workflow de deploy | No tiene efecto hasta que ese cambio se mergea a `main` con revisión |
| Token GITHUB_TOKEN amplio | `contents: read` en CI. `packages: write` solo en el job de `main` que publica la imagen |
| Escalamiento de test a producción | El contenedor de pruebas arranca solo si el ref es `edruejzwwnixsjsadbgb`. La llave SSH de ese usuario no escribe el directorio de producción |

## GHCR

Recomendado y no verificado. El job de `main` publica `ghcr.io/<owner>/dinamic-clean-api` con tag del SHA y con el digest que devuelve el build. Producción y pruebas hacen pull por digest. Un tag movible no es la referencia del deploy.

## Qué tiene que leer `gh` cuando haya login

```bash
gh auth status
gh api repos/cnvicario-commits/dinamic-clean-personal --jq '{visibility,default_branch}'
gh api repos/cnvicario-commits/dinamic-clean-personal/branches/main/protection
gh api repos/cnvicario-commits/dinamic-clean-personal/rulesets
gh api repos/cnvicario-commits/dinamic-clean-personal/environments
gh api repos/cnvicario-commits/dinamic-clean-personal/actions/secrets
gh api repos/cnvicario-commits/dinamic-clean-personal/collaborators --jq '.[] | {login,role_name}'
```

De secrets y environments anotar solo nombres. No pedir los valores.
