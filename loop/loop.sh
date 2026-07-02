#!/usr/bin/env bash
# Ralph loop for the called-it build.
# Run from the repo root (the directory containing SPEC.md and loop/). Use tmux.
# Stop anytime: `touch .loop-stop`.
#
# Env knobs:
#   MODEL       — default claude-sonnet-5 (fallback: claude-sonnet-4-6 if day-two weirdness)
#   EFFORT      — default medium (loop work is specced + gated; escalation handles hard cases)
#   MAX_ITER    — default 25. This is also the budget ceiling: on a plan there is no $ meter,
#                 so size MAX_ITER from calibration %/iteration and check bars between runs.
#   MAX_TURNS   — per-iteration agent turn cap, default 60
#   STALL_LIMIT — consecutive no-progress iterations tolerated, default 2
#
# Stop conditions, in checking order:
#   .loop-stop file · no eligible tasks · dirty tree at iteration start (prior crash)
#   · red gates after a claimed-progress iteration (shell verifies, not the model)
#   · STALL_LIMIT consecutive no-progress iterations · MAX_ITER
set -uo pipefail

MODEL="${MODEL:-claude-sonnet-5}"
EFFORT="${EFFORT:-medium}"
MAX_ITER="${MAX_ITER:-25}"
MAX_TURNS="${MAX_TURNS:-60}"
STALL_LIMIT="${STALL_LIMIT:-2}"
export CLAUDE_CODE_EFFORT_LEVEL="$EFFORT"

[[ -f SPEC.md && -f loop/PROMPT.md ]] || { echo "Run from repo root (SPEC.md + loop/ expected)."; exit 1; }

log() { echo "[loop] $*" | tee -a loop/loop.log; }

progress_sig() {
  # HEAD + checked-task count + blocked-task count. If none of these moved, nothing happened.
  local head checked blocked
  head=$(git rev-parse HEAD 2>/dev/null || echo "no-git")
  checked=$(grep -c '^- \[x\]' loop/TASKS.md || true)
  blocked=$(grep -c '\[BLOCKED' loop/TASKS.md || true)
  echo "${head}:${checked}:${blocked}"
}

stalls=0
for i in $(seq 1 "$MAX_ITER"); do
  [[ -f .loop-stop ]] && { log ".loop-stop found — exiting."; break; }

  remaining=$(grep '^- \[ \]' loop/TASKS.md | grep -v '\[HAND\]' | grep -vc '\[BLOCKED' || true)
  if [[ "${remaining:-0}" -eq 0 ]]; then
    log "No loop-eligible tasks remain (only [HAND]/[BLOCKED] left, or done)."
    break
  fi

  # Dirty tree at iteration start = the previous iteration died mid-task.
  # Do not let a fresh session improvise around a crash — stop for a human.
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    log "STOP: dirty working tree at iteration start (prior iteration crashed mid-task?)."
    log "Inspect with git status/diff, commit or reset to green, then rerun."
    exit 2
  fi

  before=$(progress_sig)
  echo "=== [loop] iteration $i/$MAX_ITER — $remaining task(s) — $MODEL @ $EFFORT — $(date "+%Y-%m-%dT%H:%M:%S%z") ===" | tee -a loop/loop.log
  claude -p "$(cat loop/PROMPT.md)" \
    --model "$MODEL" \
    --max-turns "$MAX_TURNS" \
    --dangerously-skip-permissions \
    2>&1 | tee -a loop/loop.log
  after=$(progress_sig)

  # Ground truth beats self-report: if the agent claims progress, the SHELL verifies the gates.
  # (Skipped until the repo has a package.json with a "check" script, i.e. pre-T01.)
  if [[ "$after" != "$before" && -f package.json ]] && grep -q '"check"' package.json; then
    if ! pnpm check >> loop/loop.log 2>&1; then
      log "STOP: agent reported progress but 'pnpm check' is red — done() was lying."
      log "Inspect the last commit(s); revert or fix before rerunning."
      exit 3
    fi
  fi

  if [[ "$after" == "$before" ]]; then
    stalls=$((stalls + 1))
    log "No progress this iteration ($stalls/$STALL_LIMIT)."
    if [[ "$stalls" -ge "$STALL_LIMIT" ]]; then
      log "STOP: $STALL_LIMIT consecutive no-progress iterations — stalled, not working."
      log "See loop/QUESTIONS.md and the tail of loop/loop.log."
      exit 4
    fi
  else
    stalls=0
  fi

  sleep 5
done

log "Done. Review loop/PROGRESS.md and loop/QUESTIONS.md, then git log."
