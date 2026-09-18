# Cursor development workflow — Dinamic Clean

## Mechanism chosen (Cursor-compatible)

| Mechanism | Path | Purpose |
|-----------|------|---------|
| Project subagents | `.cursor/agents/*.md` | Specialized agents with isolated prompts |
| Slash commands | `.cursor/commands/*.md` | `/implementar`, `/corregir` |
| Project rules | `.cursor/rules/*.mdc` | Always-on enterprise + git evidence + review readiness |
| Root instructions | `AGENTS.md` (+ `CLAUDE.md` → `@AGENTS.md`) | Preserved Next.js notice + agent index |

No incompatible structures invented. Existing Next.js agent note in `AGENTS.md` was **preserved and extended**.

## Agents

### `software-architect`

Coordinates Backend + Frontend + Database. Defines vertical slices, blocks scope creep, demands evidence. Invoke for planning and gatekeeping.

### `backend-senior`

Fastify/TS API, JWT, RBAC, repositories, OpenAPI, tests. Invoke for `apps/api` and server logic.

### `frontend-senior`

Next.js/React, typed API consumption, migration off direct Supabase mutations. Invoke for `src/**` UI work.

### `database-senior`

PostgreSQL/Supabase schema, migrations, RLS, grants, integrity. Invoke for `supabase/**` and SQL design.

### How to invoke

- Explicit: `/backend-senior …`, `/software-architect …`, or “use the database-senior agent to …”
- Automatic: Agent may delegate via Task tool using each agent’s `description`
- Prefer architect first on multi-layer work, then specialists in parallel when independent

## Commands

### `/implementar`

Stage-scoped implementation (read → plan → implement → test → **review package**).

- Requires an explicit **target stage** name from the user.
- Ends with Implementation report + Review package (SMALL_DIFF / LARGE_DIFF).
- Writes gitignored `review/*.txt` and formal `evidence/<feature>-implementation-*.txt`.
- Prefer helper: `./scripts/review_working_tree.sh`

### `/corregir`

Scope-controlled corrective patch (explicit fix list only).

- Stricter blast radius than `/implementar`.
- Ends with Scope control + Review package (CORRECTION_SMALL / LARGE).
- Writes `review/*.txt` and `evidence/<feature>-corrections-*.txt` (never overwrite implementation evidence).

Full command bodies: `.cursor/commands/implementar.md`, `.cursor/commands/corregir.md`.

## Shared rules

1. `dinamic-clean-enterprise.mdc` — enterprise bar, backend mandatory  
2. `git-evidence-protocol.mdc` — evidence after every cycle  
3. `code-review-readiness.mdc` — external Diff review readiness  

## Git Diff / review protocol (summary)

**Formal evidence (may be committed intentionally):** `evidence/`

- Implementation: `<feature>-implementation-*.txt`
- Corrections: `<feature>-corrections-*.txt`
- Snapshot: `latest-*.txt`

**Local review dumps (gitignored — never commit):** `review/`, `.review/`

```bash
./scripts/review_working_tree.sh
# or manual (does NOT modify the index — no git add -N):
mkdir -p review
git --no-pager status --short > review/latest-status.txt
git --no-pager diff --stat > review/latest-diffstat.txt
git --no-pager diff --find-renames --find-copies -U20 > review/latest-diff.txt
git ls-files --others --exclude-standard > review/latest-untracked.txt
```

Capture real command exit codes with `./scripts/capture_cmd_exit.sh evidence/out.txt -- <command>`.

Include **untracked** files (`git diff` alone is insufficient). Never destructive git without explicit approval.

## External review flow

1. Implement with `/implementar`  
2. Produce `review/` + `evidence/` artifacts  
3. External reviewer consumes Diff + evidence  
4. Fix with `/corregir`  
5. New correction evidence + retest  
6. Status: `READY_FOR_REVIEW` | `READY_WITH_KNOWN_LIMITATIONS` | `BLOCKED`

## Phase roadmap (reference)

See enterprise audit/roadmap docs. Phase 0 = reproducible non-prod baseline. Phase 1 = API foundation + `/v1/me` + employees read + FE pilot.
