# Phase 0 — Baseline approach

## Problem

`supabase/migrations/` contains **incremental deltas** only. Core tables (`empleados`, `perfiles`, `empresas`, `pedidos_*`, …) were created outside the repo. Migrations alone **cannot** rebuild production or a full empty project.

## Strategy (adopted)

1. **Versioned schema dump** from the isolated **test** project `edruejzwwnixsjsadbgb`:
   - Artifact: `supabase/baseline/001_public_schema.sql` (schema-only, no owners/privileges).
2. Keep incremental migrations for forward changes after baseline.
3. Document restore in `docs/phase-0-restore-runbook.md`.
4. Do **not** treat the original production project as the default target.

## Evidence captured (test project)

| Artifact | Purpose |
|----------|---------|
| `supabase/baseline/001_public_schema.sql` | Public schema DDL |
| `evidence/phase0-tables.txt` | Table list (36 public tables) |
| `evidence/phase0-policies.txt` | RLS policy inventory |
| `evidence/phase0-buckets.txt` | Storage buckets |
| `evidence/phase0-grants-sample.txt` | Sample grants |
| `evidence/phase0-row-counts.txt` | Smoke counts |
| `evidence/phase0-empleados-describe.txt` | empleados structure + policies |

## Honest limitation

- Baseline reflects **test** DB state at dump time, not a certified production clone.
- Storage object policies / Auth config beyond buckets may still need dashboard export.
- Full “empty project → identical prod” remains **PARTIAL** until restore drill is rehearsed end-to-end and signed off.
