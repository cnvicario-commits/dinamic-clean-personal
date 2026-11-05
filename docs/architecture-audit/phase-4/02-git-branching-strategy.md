# 02 — Estrategia de ramas

No se creó, borró, fusionó ni reescribió ninguna rama remota.

## Ramas

| Rama | Función |
|---|---|
| `main` | Código autorizado para producción y para el frontend de Vercel |
| `cristian-pruebas` | Despliegue del entorno de Cristian. Recibe `main` por merge; no es el origen de un PR hacia `main` |
| `feature/*` | Trabajo nuevo, creado desde `main` |
| `DIN-417` | Rama de trabajo de la infraestructura actual, hasta su promoción por PR |

`develop` no se incorpora. El equipo ya separa integración y producción con pull requests hacia `main`, y el único entorno desplegado de prueba es `cristian-pruebas`. Una tercera rama permanente repetiría esa cola y alargaría la divergencia.

## Recorrido

1. La tarea nace en `feature/*` desde `main`.
2. El PR apunta a `main`. CI es obligatorio cuando un administrador active la protección.
3. Los conflictos se resuelven rebasando la feature sobre `main` antes del merge. No se reescribe `cristian-pruebas`.
4. Después del merge, `main` se integra en `cristian-pruebas` con un merge. Así la rama de pruebas no acumula comportamiento ausente en producción.
5. Un hotfix nace desde `main`, entra por PR y después se integra a `cristian-pruebas` con el mismo merge. No se parchea producción desde la rama de pruebas.
6. `DIN-417` se promueve con un PR hacia `main`. Esta sesión no lo abrió.

## Protección prevista y no aplicada

Hace falta un administrador de GitHub para exigir, en `main` y en `cristian-pruebas`:

- pull request;
- el workflow `ci` en verde;
- prohibición de push directo;
- prohibición de borrar la rama.

Sin esa configuración, las reglas de este documento no están vigentes. Estado: `NOT_VERIFIED`. La ausencia de protección es el control que impide tratar un push a `cristian-pruebas` como una frontera de seguridad suficiente.
