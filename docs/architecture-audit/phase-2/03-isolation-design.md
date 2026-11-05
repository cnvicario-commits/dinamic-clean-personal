# Aislamiento

La API de Cristian ya corre en el VPS. Producción sigue en su propio contenedor.

| Pieza | Cristian | Producción |
| --- | --- | --- |
| Compose project | `dinamic-clean-cristian` | el que ya existe; no se reutiliza |
| Archivo | `deploy/docker-compose.cristian.yml` | `deploy/docker-compose.api.yml` queda para el uso local ya documentado |
| Contenedor | `dinamic-clean-cristian-api` | no se nombra ni se toca |
| Red | bridge `dinamic-clean-cristian` | no se comparte |
| Puerto interno | `3001` | sin cambio |
| Puerto del host | `0.0.0.0:3006` | `3005` |
| Directorio | `/opt/dinamic-clean-cristian` | no usar `/opt/dinamic-clean` |
| Entorno | archivo propio, solo Supabase Test | no montar su env |
| Base | `edruejzwwnixsjsadbgb` | `biectbcujabpjhinouil` prohibido |

El contenedor no tiene socket de Docker, no es privilegiado, no usa `network_mode: host` y no monta volúmenes productivos. `MIGRATIONS_DATABASE_URL` queda vacío en el proceso. El rol de runtime es `dinamic_api`.

`/opt/dinamic-clean-cristian` es el directorio de Cristian. El preflight rechaza una CA o un env bajo `/opt/dinamic-clean/`. El puerto `3005` también se rechaza.
