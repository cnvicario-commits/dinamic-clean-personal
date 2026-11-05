# 14 — Riesgos residuales

1. `gh` no tiene sesión. No está comprobado el plan, los reviewers, los rulesets ni la visibilidad de GHCR. La variable apagada impide el despliegue automático; no sustituye una aprobación de otra persona cuando alguien pueda encenderla y despachar.
2. Un push directo a `cristian-pruebas` ejecuta el YAML de esa rama. Sin protección de rama, ese YAML puede modificarse para pedir secretos de otro environment. La activación queda bloqueada hasta existir la protección y los reviewers.
3. La cuenta de despliegue todavía no existe. Un wrapper sin un permiso acotado de Docker no puede publicar, y darle el grupo `docker` anularía el aislamiento. Ese permiso todavía no está diseñado como una regla instalada.
4. El Compose productivo real no se leyó del VPS en esta fase. El script rechaza un archivo con señales de Cristian, pero no se validó contra `/opt/dinamic-clean`.
5. La integración con Vercel no se leyó. Puede haber un despliegue de frontend al mergear `main` que esta fase no controla ni debe duplicar.
6. El rollback de Docker no revierte migraciones. El workflow de migración está separado y apagado; una migración ya aplicada queda fuera del rollback.
7. Cristian sigue en HTTP público. El pipeline no agrega TLS y no convierte esa dirección en un canal adecuado para credenciales reales.
8. El anon key del frontend viaja como build arg. No es la service role, y puede quedar en el historial de la imagen. Los logs de GitHub enmascaran el secret, el historial local de BuildKit no es el mismo control.
9. No se midió de nuevo el VPS. La activación tiene que volver a medir antes de publicar imágenes.
10. `deploy-guards` en CI usa Docker del runner para `docker compose config`. Eso valida sintaxis. No despliega y no abre los puertos 3006 ni 8086.
