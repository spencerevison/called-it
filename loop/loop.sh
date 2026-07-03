#!/usr/bin/env bash
# called-it build loop — author -> review -> fix, with model-role separation.
# Run from repo root (dir with SPEC.md + loop/). Use tmux. Stop anytime: touch .loop-stop
#
# Design (full rationale in CLAUDE.md):
#   - Author (Sonnet) does one task on a scratch branch (loop/work), commits, stops.
#   - Runner verifies the gate itself (ground truth), then gates review off the task's risk tag.
#   - risk:high -> adversarial Fable review as a SEPARATE pass over the diff.
#       pass -> ff-merge main + tag + push. flag -> fixer cycle (Sonnet, N=2, then Opus).
#       high-sev flag on an auth/DB path, or unclearable flag -> HALT for a human.
#   - risk:low / risk:math -> no review; gate + merge (vectors are the check for math).
#   - Phase-boundary tasks trigger a cumulative quality review (Fable).
#   - Atomic: a crash/turn-kill leaves main untouched; loop/work is force-discarded next iter.
set -uo pipefail

AUTHOR_MODEL="${AUTHOR_MODEL:-claude-sonnet-5}"
REVIEWER_MODEL="${REVIEWER_MODEL:-claude-fable-5}"   # -> claude-opus-4-8 once Fable retires
FIXER_MODEL="${FIXER_MODEL:-claude-sonnet-5}"
ESCALATED_FIXER_MODEL="${ESCALATED_FIXER_MODEL:-claude-opus-4-8}"
EFFORT="${EFFORT:-medium}"
MAX_ITER="${MAX_ITER:-40}"
MAX_TURNS="${MAX_TURNS:-100}"      # author/fixer
REVIEW_TURNS="${REVIEW_TURNS:-60}"
FIX_CAP="${FIX_CAP:-3}"            # Sonnet fix/review cycles before Opus (raised from 2: deep tasks surface a stack of findings that converge)
STALL_LIMIT="${STALL_LIMIT:-2}"
PUSH="${PUSH:-1}"
WORK="${WORK:-loop/work}"

# auth/DB access-control tasks: a high-severity flag here HALTs, never auto-fixes (CLAUDE.md).
HALT_TASKS=" T11 T21 T25 "
# phase-boundary tasks: completing one triggers a cumulative quality review.
QG_TASKS=" T20 T28 T31 T36 T39 T44 "

[[ -f SPEC.md && -f loop/PROMPT.md ]] || { echo "Run from repo root (SPEC.md + loop/ expected)."; exit 1; }
export CLAUDE_CODE_EFFORT_LEVEL="$EFFORT"

log() { echo "[loop] $*" | tee -a loop/loop.log; }
ts()  { date "+%Y-%m-%dT%H:%M:%S%z"; }

run_agent() { # <model> <prompt> ; author/fixer, full tools
  local model="$1" prompt="$2"
  claude -p "$prompt" --model "$model" --max-turns "$MAX_TURNS" \
    --dangerously-skip-permissions 2>&1 | tee -a loop/loop.log
}

reset_work() { # discard any residue, fork a clean loop/work from main
  git checkout -f main >/dev/null 2>&1
  git branch -D "$WORK" >/dev/null 2>&1 || true
  if [[ -n "$(git status --porcelain)" ]]; then
    log "STOP: main dirty after force-reset (untracked/uncommitted non-ignored files). Human needed."
    exit 2
  fi
  git checkout -q -b "$WORK"
}

gate_ok() { # runner's own ground-truth check; skipped pre-T01 (no package.json/check)
  [[ -f package.json ]] && grep -q '"check"' package.json || return 0
  pnpm check >> loop/loop.log 2>&1
}

review() { # <diff-range> <task-line> <mode: task|quality> -> writes loop/REVIEW.md, echoes the VERDICT line (empty if the reviewer produced none)
  local range="$1" taskline="$2" mode="$3" diff prompt out body
  # strip reviewer.md's YAML frontmatter: a -p prompt string starting with "---" makes the
  # claude CLI arg parser reject it ("unknown option '---'") and the reviewer never runs.
  body="$(awk 'NR==1&&/^---[[:space:]]*$/{fm=1;next} fm&&/^---[[:space:]]*$/{fm=0;next} !fm' .claude/agents/reviewer.md)"
  diff="$(git diff "$range")"
  prompt="${body}

You are reviewing in **${mode}** mode. Task context (from loop/TASKS.md):
${taskline}

Diff under review (${range}):
\`\`\`diff
${diff}
\`\`\`
Read any files you need for context. End with exactly one VERDICT line."
  out="$(CLAUDE_CODE_EFFORT_LEVEL=high claude -p "$prompt" --model "$REVIEWER_MODEL" \
        --max-turns "$REVIEW_TURNS" --dangerously-skip-permissions \
        --allowedTools "Read Grep Glob" 2>&1)"
  printf '%s\n' "$out" > loop/REVIEW.md
  { echo "--- review ($mode) ${range} $(ts) ---"; printf '%s\n' "$out"; } >> loop/loop.log
  printf '%s\n' "$out" | grep -iE 'VERDICT:[[:space:]]*(pass|flag)' | tail -1
}

phase_of() { case "$1" in T20) echo P2;; T28) echo P3;; T31) echo P4;; T36) echo P5;; T39) echo P6;; T44) echo P7;; *) echo P?;; esac; }

halt() { # <tag> <reason>
  local tag="$1" reason="$2"
  log "HALT: $reason"
  [[ -n "$tag" ]] && git tag -f "$tag" >/dev/null 2>&1
  { echo; echo "## SUMMARY ($(ts))"; echo "HALT: $reason"; echo "Inspect: git status, branch $WORK, loop/REVIEW.md, loop/QUESTIONS.md."; } >> loop/PROGRESS.md
  exit 5
}

merge_and_tag() { # <verdict> <task> ; ff main to work, tag, push. No stdout (callers read main after).
  local verdict="$1" task="$2"
  git checkout -q main
  git merge --ff-only "$WORK" >> loop/loop.log 2>&1 || { log "STOP: ff-merge failed (main moved?)."; exit 6; }
  [[ -n "$task" ]] && git tag -f "reviewed-${verdict}-${task}" >/dev/null 2>&1
  if [[ "$PUSH" == 1 ]]; then
    { git push -q origin main && git push -q -f origin --tags; } >>loop/loop.log 2>&1 \
      || echo "[loop] warn: push failed (offline?)." >>loop/loop.log
  fi
}

stalls=0
for i in $(seq 1 "$MAX_ITER"); do
  [[ -f .loop-stop ]] && { log ".loop-stop found — exiting."; break; }

  remaining=$(grep '^- \[ \]' loop/TASKS.md | grep -vc '\[BLOCKED' || true)
  if [[ "${remaining:-0}" -eq 0 ]]; then
    log "No eligible tasks remain (all checked or blocked)."
    { echo; echo "## SUMMARY ($(ts))"; echo "All tasks checked or blocked."; } >> loop/PROGRESS.md
    break
  fi

  main_before="$(git rev-parse main 2>/dev/null)"
  reset_work
  log "=== iter $i/$MAX_ITER — $remaining task(s) — author=$AUTHOR_MODEL @ $EFFORT — $(ts) ==="

  # --- AUTHOR -------------------------------------------------------------
  run_agent "$AUTHOR_MODEL" "$(cat loop/PROMPT.md)"

  if [[ "$(git rev-parse "$WORK")" == "$main_before" ]]; then
    stalls=$((stalls + 1))
    log "No commit this iteration ($stalls/$STALL_LIMIT)."
    [[ "$stalls" -ge "$STALL_LIMIT" ]] && { log "STOP: $STALL_LIMIT consecutive no-progress iterations."; exit 4; }
    continue
  fi
  stalls=0

  # runner verifies the gate itself — author may have committed on a red gate
  if ! gate_ok; then
    halt "" "author committed but 'pnpm check' is red on $WORK — done() was lying. Inspect the last commit."
  fi

  newline="$(git diff main.."$WORK" -- loop/TASKS.md | grep -E '^\+.*- \[x\] T[0-9]+' | head -1)"
  task="$(printf '%s' "$newline" | grep -oE 'T[0-9]+' | head -1)"
  risk="$(printf '%s' "$newline" | grep -oE 'risk:(high|low|math)' | head -1)"
  taskline="$(printf '%s' "$newline" | sed 's/^+//')"
  log "iter $i: task=${task:-none} risk=${risk:-n/a}"

  verdict="pass"
  # --- REVIEW (risk:high only) -------------------------------------------
  if [[ "$risk" == "risk:high" ]]; then
    cycle=0
    while : ; do
      vline="$(review "main..$WORK" "$taskline" task)"
      log "review: ${vline:-<no verdict>}"
      # empty = reviewer never produced a verdict (invocation/harness error, not a code flag) — HALT, don't fix-cycle
      if [[ -z "$vline" ]]; then
        { echo; echo "### $task review ERROR — no verdict ($(ts))"; cat loop/REVIEW.md; } >> loop/QUESTIONS.md
        halt "" "reviewer produced no VERDICT on $task — invocation/harness error, not a finding. See loop/REVIEW.md."
      fi
      if printf '%s' "$vline" | grep -qiE 'VERDICT:[[:space:]]*pass'; then verdict="pass"; break; fi

      sev="$(printf '%s' "$vline" | grep -oiE 'severity=(low|medium|high)' | cut -d= -f2)"
      # immediate HALT: high-sev on an auth/DB path — never auto-fix these
      if [[ "$sev" == "high" && "$HALT_TASKS" == *" $task "* ]]; then
        { echo; echo "### $task review HALT ($(ts))"; cat loop/REVIEW.md; } >> loop/QUESTIONS.md
        halt "reviewed-HALT-$task" "high-severity finding on auth/DB path $task — stopping for human review."
      fi

      if [[ "$cycle" -ge $((FIX_CAP + 1)) ]]; then
        { echo; echo "### $task unclearable flag ($(ts))"; cat loop/REVIEW.md; } >> loop/QUESTIONS.md
        halt "reviewed-flag-$task" "reviewer flag on $task not cleared within escalation cap."
      fi

      # --- FIX ---
      fixer="$FIXER_MODEL"; [[ "$cycle" -ge "$FIX_CAP" ]] && fixer="$ESCALATED_FIXER_MODEL"
      cycle=$((cycle + 1))
      log "fix cycle $cycle on $task (fixer=$fixer)"
      run_agent "$fixer" "$(cat loop/FIX.md)"
      if ! gate_ok; then halt "reviewed-flag-$task" "fixer left $task with a red gate."; fi
    done
  fi

  # --- MERGE --------------------------------------------------------------
  merge_and_tag "$verdict" "$task"
  log "merged $task ($verdict) -> main @ $(git rev-parse --short main)"

  # --- QUALITY GATE (phase boundary) -------------------------------------
  if [[ -n "$task" && "$QG_TASKS" == *" $task "* ]]; then
    ph="$(phase_of "$task")"
    base="$(git tag -l 'qg-pass-*' --sort=creatordate | tail -1)"
    [[ -z "$base" ]] && base="$(git rev-list --max-parents=0 HEAD | tail -1)"
    log "quality gate $ph: reviewing ${base}..main"
    vline="$(review "${base}..main" "QUALITY GATE $ph (cumulative diff since $base)" quality)"
    log "quality gate $ph: ${vline:-<no verdict>}"
    if [[ -z "$vline" ]]; then
      { echo; echo "### quality gate $ph review ERROR — no verdict ($(ts))"; cat loop/REVIEW.md; } >> loop/QUESTIONS.md
      halt "" "quality gate $ph reviewer produced no VERDICT — harness error. See loop/REVIEW.md."
    elif printf '%s' "$vline" | grep -qiE 'VERDICT:[[:space:]]*pass'; then
      git tag -f "qg-pass-$ph" >/dev/null 2>&1
      [[ "$PUSH" == 1 ]] && git push -q -f origin --tags 2>>loop/loop.log
    else
      { echo; echo "### quality gate $ph flag ($(ts))"; cat loop/REVIEW.md; } >> loop/QUESTIONS.md
      halt "qg-flag-$ph" "quality gate $ph flagged cross-cutting drift — human review."
    fi
  fi

  sleep 3
done

log "Done. Review loop/PROGRESS.md, loop/QUESTIONS.md, git tag -l, git log."
