# 08 — Quality gate

**Estado:** `PHASE_1_CODE_READY_WITH_LIMITATIONS`

El código de la fase 1 queda listo para integrar, con límites que no son un fallo del workflow ni un permiso para tocar la nube.

Listo:

- El job `api` usa `working-directory` y actionlint no reporta propiedades inválidas.
- Un restore destructivo no llega a producción ni a Supabase Test, tampoco con `I_CONFIRM_DISPOSABLE=yes`.
- `npm test` no abre bases cloud. El desarrollo local no perdió el acceso a Supabase Test, porque ese proceso no carga el guard ni el script de restore.
- La integración efímera pasó 20 pruebas en `127.0.0.1`. Una suite que falló de verdad quedó fuera, sin cambiar su expectativa.
- Lint, typecheck y build de frontend y API pasaron en local.

Límites, a propósito:

- Supabase Test sigue en 21 migraciones. No es `PHASE_1_COMPLETED`.
- El job no corrió dentro de GitHub.
- El VPS no se leyó. La protección de ramas sigue diferida.
- La fase 6 todavía tiene 74 pruebas de integración y el caso 409/502 de resultados.

No hubo push ni merge.
