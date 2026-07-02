#!/usr/bin/env bash
# Ralph loop for the called-it build.
# Run from repo root (dir containing SPEC.md and loop/). Use tmux. Stop: `touch .loop-stop`.
#
# Env knobs:
#   MODEL         claude-sonnet-5 (fallback: claude-sonnet-4-6)
#   EFFORT        medium
#   MAX_ITER      25  — also the budget ceiling; with usage credits ON, iterations past the
#                       weekly limit cost real money, so size this deliberately.
#   MAX_TURNS     60
#   STALL_LIMIT   2
#   PAUSE_ON_LIMIT      1 = on session limit, sleep until reset and resume (DEFAULT).
#                       0 = exit cleanly on limit; you re-run next session.
#                       CLI: --pause-and-wait (default) / --no-pause-and-wait override the env.
#   MAX_WAITS     3  — hard cap on total session-limit sleeps per invocation. A safety net:
#                       if detection misfires, the loop can't sleep forever. Past this, it exits.
#   FALLBACK_WAIT_MIN  90 — minutes to sleep if the reset time can't be parsed from output.
set -uo pipefail

MODEL="${MODEL:-claude-sonnet-5}"
EFFORT="${EFFORT:-medium}"
MAX_ITER="${MAX_ITER:-25}"
MAX_TURNS="${MAX_TURNS:-60}"
STALL_LIMIT="${STALL_LIMIT:-2}"
PAUSE_ON_LIMIT="${PAUSE_ON_LIMIT:-1}"
MAX_WAITS="${MAX_WAITS:-3}"
FALLBACK_WAIT_MIN="${FALLBACK_WAIT_MIN:-90}"

# CLI overrides for the pause behavior (win over env).
for arg in "$@"; do
  case "$arg" in
    --pause-and-wait)    PAUSE_ON_LIMIT=1 ;;
    --no-pause-and-wait) PAUSE_ON_LIMIT=0 ;;
    *) echo "unknown arg: $arg" >&2; exit 64 ;;
  esac
done
export CLAUDE_CODE_EFFORT_LEVEL="$EFFORT"

[[ -f SPEC.md && -f loop/PROMPT.md ]] || { echo "Run from repo root (SPEC.md + loop/ expected)."; exit 1; }
log() { echo "[loop] $*" | tee -a loop/loop.log; }

progress_sig() {
  local head checked blocked
  head=$(git rev-parse HEAD 2>/dev/null || echo "no-git")
  checked=$(grep -c '^- \[x\]' loop/TASKS.md || true)
  blocked=$(grep -c '\[BLOCKED' loop/TASKS.md || true)
  echo "${head}:${checked}:${blocked}"
}

# Recognize the session/usage-limit banner in captured output. String-grep because the CLI
# exposes no distinct structured code for it (verified 2026-07). Kept broad but limit-specific.
is_limit_hit() { grep -qiE 'usage limit reached|Claude AI usage limit|rate limit reached' "$1"; }

# Best-effort: seconds until the reset time named in the banner. Empty string if unparseable.
seconds_until_reset() {
  local out="$1" ts secs
  # Look for "try again after <time>" / "reset at <time>" style stamps.
  ts=$(grep -oiE 'after [0-9]{1,2}(:[0-9]{2})?\s?(am|pm)?' "$out" | head -1 | sed -E 's/after //I')
  [[ -z "$ts" ]] && { echo ""; return; }
  # macOS/BSD date: interpret the stamp as today's local time; if already past, add a day.
  secs=$(date -j -f "%I:%M %p" "$ts" "+%s" 2>/dev/null \
         || date -j -f "%I %p" "$ts" "+%s" 2>/dev/null || echo "")
  [[ -z "$secs" ]] && { echo ""; return; }
  local now delta; now=$(date "+%s"); delta=$(( secs - now ))
  (( delta < 0 )) && delta=$(( delta + 86400 ))
  echo "$delta"
}

waits=0
stalls=0
for i in $(seq 1 "$MAX_ITER"); do
  [[ -f .loop-stop ]] && { log ".loop-stop found — exiting."; break; }

  remaining=$(grep '^- \[ \]' loop/TASKS.md | grep -v '\[HAND\]' | grep -vc '\[BLOCKED' || true)
  [[ "${remaining:-0}" -eq 0 ]] && { log "No loop-eligible tasks remain."; break; }

  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    log "STOP: dirty tree at iteration start (prior iteration crashed?). Inspect, clean to green, rerun."
    exit 2
  fi

  before=$(progress_sig)
  iter_out=$(mktemp)
  echo "=== [loop] iter $i/$MAX_ITER — $remaining task(s) — $MODEL @ $EFFORT — pause=$PAUSE_ON_LIMIT — $(date "+%Y-%m-%dT%H:%M:%S%z") ===" | tee -a loop/loop.log
  # tee to both the persistent log and this iteration's capture (for limit detection).
  claude -p "$(cat loop/PROMPT.md)" \
    --model "$MODEL" --max-turns "$MAX_TURNS" --dangerously-skip-permissions \
    2>&1 | tee -a loop/loop.log | tee "$iter_out"
  rc=${PIPESTATUS[0]}
  after=$(progress_sig)

  # --- Session-limit handling: check BEFORE stall logic, since a limit hit looks like no-progress.
  if [[ "$rc" -ne 0 ]] && is_limit_hit "$iter_out"; then
    if [[ "$PAUSE_ON_LIMIT" -eq 1 ]]; then
      waits=$(( waits + 1 ))
      if [[ "$waits" -gt "$MAX_WAITS" ]]; then
        log "STOP: session limit hit and MAX_WAITS ($MAX_WAITS) exceeded — not sleeping again. Rerun later."
        rm -f "$iter_out"; exit 5
      fi
      secs=$(seconds_until_reset "$iter_out")
      if [[ -z "$secs" || "$secs" -le 0 ]]; then
        secs=$(( FALLBACK_WAIT_MIN * 60 ))
        log "Session limit hit; reset time unparseable — sleeping fallback ${FALLBACK_WAIT_MIN}m (wait $waits/$MAX_WAITS)."
      else
        secs=$(( secs + 120 ))  # 2-min cushion past the stated reset
        log "Session limit hit; sleeping ~$(( secs / 60 ))m until reset +cushion (wait $waits/$MAX_WAITS)."
      fi
      # Sleep in 60s slices so .loop-stop still works mid-wait.
      slept=0
      while (( slept < secs )); do
        [[ -f .loop-stop ]] && { log ".loop-stop during wait — exiting."; rm -f "$iter_out"; exit 0; }
        sleep 60; slept=$(( slept + 60 ))
      done
      rm -f "$iter_out"
      continue   # retry the SAME task; this iteration didn't count as progress or stall
    else
      log "Session limit hit; --no-pause-and-wait set — exiting clean. Rerun after reset to resume."
      rm -f "$iter_out"; exit 6
    fi
  fi

  # --- Non-zero exit that is NOT a recognized limit: fail safe, don't guess.
  if [[ "$rc" -ne 0 ]]; then
    log "STOP: claude exited $rc, not a recognized session-limit. Inspect loop/loop.log tail; rerun when resolved."
    rm -f "$iter_out"; exit 7
  fi
  rm -f "$iter_out"

  # --- Shell verifies gates when the agent claims progress (done() doesn't grade itself).
  if [[ "$after" != "$before" && -f package.json ]] && grep -q '"check"' package.json; then
    if ! pnpm check >> loop/loop.log 2>&1; then
      log "STOP: agent reported progress but 'pnpm check' is red — done() was lying. Inspect last commit(s)."
      exit 3
    fi
  fi

  # --- Stall detection.
  if [[ "$after" == "$before" ]]; then
    stalls=$(( stalls + 1 ))
    log "No progress this iteration ($stalls/$STALL_LIMIT)."
    if [[ "$stalls" -ge "$STALL_LIMIT" ]]; then
      log "STOP: $STALL_LIMIT consecutive no-progress iterations — stalled. See loop/QUESTIONS.md + log tail."
      exit 4
    fi
  else
    stalls=0
  fi
  sleep 5
done

log "Done. Review loop/PROGRESS.md and loop/QUESTIONS.md, then git log."
