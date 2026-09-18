# Phase 0 — .gitignore / sanitization check

## Checks executed

| Check | Result |
|-------|--------|
| `.env*` in `.gitignore` | YES (line 34) |
| `git check-ignore -v .env.local` | matches `.env*` |
| `/backups/` ignored | YES |
| `/Referencias/` ignored | YES |
| `*.pem` ignored | YES |
| Baseline SQL contains no passwords | Expected (schema-only dump) |
| Evidence files contain no connection strings | Verified by construction |

## Apps/API

Ensure `apps/api/.env` and `apps/api/.env.local` remain covered by root `.env*`.

## Residual risk

Secrets previously pasted in chat/logs should be **rotated** if the channel is not fully private. Status: **RIESGO PROBABLE** until rotation confirmed.
