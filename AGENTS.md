<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Dinamic Clean — Agent entry

Enterprise system (200+ employees). Backend traditional API is mandatory.

## Cursor agents (`.cursor/agents/`)

| Agent | Use for |
|-------|---------|
| `software-architect` | Planning, slices, cross-layer consistency, Devil's Advocate |
| `backend-senior` | `apps/api`, auth, RBAC, OpenAPI, server tests |
| `frontend-senior` | Next.js UI, API client migration, UX states |
| `database-senior` | Migrations, constraints, RLS, grants, SQL |

## Slash commands (`.cursor/commands/`)

- `/implementar` — stage-scoped implementation + tests + `review/` + `evidence/`
- `/corregir` — explicit fix-list corrections only + scope control + review package

Helper: `./scripts/review_working_tree.sh` (writes gitignored `review/` and `.review/`).

## Docs

- `docs/cursor-development-workflow.md`
- Enterprise rules in `.cursor/rules/*.mdc` (always apply)
