<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

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

- `/audit-dinamic-clean-stage` — read-only audit of a phase/subphase/feature/evidence
- `/implement-dinamic-clean-stage` — implement only the named stage + focused validation + `review/` Git artifacts
- `/fix-dinamic-clean-review` — triage and fix adversarial review findings only + regenerate `review/` artifacts

Helper: `./scripts/review_working_tree.sh` (writes gitignored `review/` and `.review/`). Capture exits with `./scripts/capture_cmd_exit.sh`.

## Docs

- `docs/cursor-development-workflow.md`
- Project rule: `.cursor/rules/dinamic-clean.mdc` (`alwaysApply: true`)
