# 08 — Registro de imágenes

Registro previsto: GitHub Container Registry. No se publicó ninguna imagen y no se comprobó el permiso del paquete. Estado: `NOT_VERIFIED`.

| Imagen | Tag |
|---|---|
| API de Cristian | `cristian-<sha de 40 hex>` |
| Frontend de Cristian | `cristian-<sha de 40 hex>` |
| API de producción | `production-<sha de 40 hex>` |

`latest` no se usa. El mismo SHA puede producir dos imágenes distintas, porque el frontend de Cristian incorpora variables `NEXT_PUBLIC_*` de Test y la API productiva no. El prefijo del tag impide promover la imagen de pruebas cambiándole el nombre. El rollback vuelve a usar el tag ya publicado; no reconstruye otro contenido bajo el mismo SHA.

El script remoto hace `docker pull` y después un tag local `dinamic-clean-api:<sha>` o `dinamic-clean-frontend:<sha>`, que es el nombre que ya esperan los Compose de Cristian. En producción el tag local es `dinamic-clean-api:production-<sha>`. El digest que imprime `docker push` es la referencia inmutable que debe quedar en el log del job. Esta sesión no tiene un digest real.

No hay política de borrado. Las imágenes anteriores se conservan para el rollback. Una retención de GHCR, si se configura más adelante, tiene que excluir los SHA registrados en `releases/current-sha` y `releases/previous-sha`. No se ejecutó `docker system prune`.
