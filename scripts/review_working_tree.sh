#!/usr/bin/env bash
# Prepare uncommitted working-tree review artifacts for Dinamic Clean.
# Does NOT modify the git index (no git add -N).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MAX_SMALL_FILES="${MAX_SMALL_FILES:-8}"
MAX_SMALL_LINES="${MAX_SMALL_LINES:-600}"

mkdir -p .review review

STATUS="$(git --no-pager status --short || true)"
STAT="$(git --no-pager diff --stat || true)"
NAME_STATUS="$(git --no-pager diff --name-status || true)"
NUMSTAT="$(git --no-pager diff --numstat || true)"
UNTRACKED="$(git ls-files --others --exclude-standard || true)"

FILES=0
LINES=0
if [[ -n "$NAME_STATUS" ]]; then
  FILES="$(printf '%s\n' "$NAME_STATUS" | sed '/^$/d' | wc -l | tr -d ' ')"
fi
if [[ -n "$NUMSTAT" ]]; then
  LINES="$(printf '%s\n' "$NUMSTAT" | awk '{a+=$1; d+=$2} END {print a+d+0}')"
fi
UNTRACKED_COUNT=0
if [[ -n "$UNTRACKED" ]]; then
  UNTRACKED_COUNT="$(printf '%s\n' "$UNTRACKED" | sed '/^$/d' | wc -l | tr -d ' ')"
fi

AREAS=0
echo "$NAME_STATUS" | grep -E 'apps/api/' >/dev/null && AREAS=$((AREAS + 1)) || true
echo "$NAME_STATUS" | grep -E '(^|/)src/' >/dev/null && AREAS=$((AREAS + 1)) || true
echo "$NAME_STATUS" | grep -E 'supabase/' >/dev/null && AREAS=$((AREAS + 1)) || true
echo "$NAME_STATUS" | grep -E '\.github/' >/dev/null && AREAS=$((AREAS + 1)) || true
CROSS=0
if [[ "$AREAS" -ge 2 ]]; then CROSS=1; fi

MODE="SMALL_DIFF"
REASON="tracked_diff_files=${FILES} lines=${LINES} untracked=${UNTRACKED_COUNT} cross_areas=${AREAS}"
if [[ "$FILES" -gt "$MAX_SMALL_FILES" || "$LINES" -gt "$MAX_SMALL_LINES" || "$CROSS" -eq 1 ]]; then
  MODE="LARGE_DIFF"
fi

{
  echo "# Working tree summary"
  echo
  echo "Mode: **${MODE}**"
  echo
  echo "Why: ${REASON} (thresholds files<=${MAX_SMALL_FILES}, lines<=${MAX_SMALL_LINES})"
  echo
  echo "Note: this script does **not** run \`git add -N\` and does not change the index."
  echo
  echo "## status --short"
  echo '```'
  echo "$STATUS"
  echo '```'
  echo
  echo "## diff --stat (tracked / staged+unstaged)"
  echo '```'
  echo "$STAT"
  echo '```'
  echo
  echo "## diff --name-status"
  echo '```'
  echo "$NAME_STATUS"
  echo '```'
  echo
  echo "## untracked (git ls-files --others --exclude-standard)"
  echo '```'
  echo "$UNTRACKED"
  echo '```'
} > .review/working-tree-summary.md

printf '%s\n' "$UNTRACKED" > .review/untracked.txt
git --no-pager diff --find-renames --find-copies -U20 > .review/full.diff || true

git --no-pager status --short > review/latest-status.txt || true
git --no-pager diff --stat > review/latest-diffstat.txt || true
git --no-pager diff --find-renames --find-copies -U20 > review/latest-diff.txt || true
printf '%s\n' "$UNTRACKED" > review/latest-untracked.txt || true

{
  echo "# Review plan"
  echo
  echo "Mode: ${MODE}"
  echo
  if [[ "$MODE" == "LARGE_DIFF" ]]; then
    echo "Recommended order:"
    echo "1. supabase/migrations + baseline"
    echo "2. apps/api (auth, RBAC, routes, repos)"
    echo "3. src/ frontend contracts"
    echo "4. tests"
    echo "5. docs / CI"
    echo
    echo "Untracked files are listed separately; inspect manually (do not auto-stage)."
  else
    echo "Paste tracked diff from .review/full.diff; also inspect .review/untracked.txt."
  fi
} > .review/review-plan.md

echo "MODE=${MODE}"
echo "FILES=${FILES} LINES=${LINES} UNTRACKED=${UNTRACKED_COUNT} CROSS_AREAS=${AREAS}"
echo "Open first: .review/working-tree-summary.md"
echo "Also written: review/latest-{status,diffstat,diff,untracked}.txt"
