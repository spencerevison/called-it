# Data Model

Postgres (Supabase). Loop implements as ordered SQL migrations (`supabase/migrations/`). All timestamps `timestamptz`. All user tables carry `user_id uuid not null references auth.users(id)` with RLS. Types below are normative; naming is normative; the loop may add `updated_at` triggers uniformly.

## Enums

```sql
create type decision_status as enum ('draft','active','resolved','abandoned');
create type stakes_level    as enum ('low','medium','high');
create type reversibility   as enum ('one_way','two_way');
create type decision_event_type as enum ('created','committed','revised','reversed','reaffirmed','resolved','abandoned');
create type checkin_status  as enum ('pending','due','completed','skipped');
create type checkin_horizon as enum ('two_weeks','two_months','six_months','custom');
create type risk_source     as enum ('ai','user');
create type risk_severity   as enum ('low','medium','high');
create type attribution     as enum ('skill','luck','mixed');
create type prompt_kind     as enum ('premortem','judge');
```

## Tables

```sql
-- Profile (thin; auth.users is canonical)
create table profiles (
  user_id uuid primary key references auth.users(id),
  display_name text,
  created_at timestamptz not null default now()
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null,
  context text not null,                    -- situation description at decision time
  rationale text,                           -- why the chosen option; judge input
  options_considered jsonb not null default '[]',  -- array of strings, length ≥ 1
  chosen_option text,
  stakes stakes_level not null default 'medium',
  reversibility reversibility not null default 'two_way',
  status decision_status not null default 'draft',
  decided_at timestamptz,                   -- set on commit
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Append-only event log; reversal frequency reads from here
create table decision_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id) on delete cascade,
  event_type decision_event_type not null,
  payload jsonb not null default '{}',      -- e.g. {note}
  created_at timestamptz not null default now()
);

create table forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id) on delete cascade,
  question text not null,                   -- binary, concretely resolvable
  probability numeric(4,3) not null check (probability >= 0.01 and probability <= 0.99),
  desired boolean not null default true,    -- is YES the outcome the user wants?
  resolve_by date,
  -- resolution (set at check-in)
  resolved boolean not null default false,
  outcome boolean,                          -- null until resolved
  recalled_probability numeric(4,3),        -- captured BEFORE recorded value is revealed
  resolved_at timestamptz,
  -- P2 headroom: interval forecasts
  forecast_type text not null default 'binary',
  lower_bound numeric, upper_bound numeric,
  created_at timestamptz not null default now(),
  check (resolved = false or outcome is not null)
);

create table premortems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id) on delete cascade,
  prompt_version text not null,             -- e.g. 'premortem_v1'
  model text not null,
  langfuse_trace_id text,
  created_at timestamptz not null default now()
);

-- Risks as rows so check-in failures can link to them
create table premortem_risks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  premortem_id uuid not null references premortems(id) on delete cascade,
  description text not null,
  category text not null,                   -- execution|external|information|motivated_reasoning|second_order
  severity risk_severity not null,
  likelihood numeric(4,3),                  -- model-estimated, optional
  source risk_source not null default 'ai',
  created_at timestamptz not null default now()
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id) on delete cascade,
  horizon checkin_horizon not null,
  scheduled_for timestamptz not null,
  status checkin_status not null default 'pending',
  trigger_run_id text,                      -- Trigger.dev run handle (P1 cancellation)
  outcome_notes text,
  overall_attribution attribution,          -- required at completion (app-enforced); M9 input
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- What actually went wrong, linked back to pre-mortem risks (or unlisted)
create table checkin_failures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  checkin_id uuid not null references checkins(id) on delete cascade,
  description text not null,
  linked_risk_id uuid references premortem_risks(id),  -- null = unlisted (pre-mortem missed it)
  was_knowable boolean not null default true,          -- knowable at decision time?
  attribution attribution not null,
  created_at timestamptz not null default now()
);

create table prompt_versions (
  id text primary key,                      -- 'premortem_v1', 'judge_v2'
  kind prompt_kind not null,
  file_path text not null,                  -- prompts/premortem_v1.md
  content_hash text not null,               -- drift guard: file vs registered
  notes text,
  created_at timestamptz not null default now()
);

create table judge_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id) on delete cascade,
  prompt_version text not null references prompt_versions(id),
  model text not null,
  scores jsonb not null,        -- {risk_comprehensiveness, calibration_given_knowable, process_quality} ints 1–5
  rationale jsonb not null,     -- {rationale:{<dim>:text}, evidence_spans:[...]} — the judge output's top-level evidence_spans array nests here (no separate column)
  contamination boolean not null default false,  -- judge flagged outcome info in input
  langfuse_trace_id text,
  created_at timestamptz not null default now()
);

-- Eval tables: service-role only (no user RLS access)
create table eval_items (
  id text primary key,                      -- 'gs-001'
  payload jsonb not null,                   -- full gold-set entry per EVAL_PLAN schema
  created_at timestamptz not null default now()
);

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                       -- 'judge_agreement' | 'premortem_surface' | 'compare' | 'contamination'
  prompt_versions text[] not null,
  metrics jsonb not null,                   -- see EVAL_PLAN report schemas
  report_path text,
  created_at timestamptz not null default now()
);
```

## Indexes

```sql
create index on decisions (user_id, status);
create index on decision_events (decision_id, created_at);
create index on forecasts (decision_id);
create index on forecasts (user_id, resolved);
create index on premortem_risks (premortem_id);
create index on checkins (status, scheduled_for);   -- reconciliation cron scan
create index on checkins (decision_id);
create index on checkin_failures (checkin_id);
create index on judge_scores (decision_id);
```

## RLS

- Every user table: `enable row level security` + policies for select/insert/update/delete where `user_id = auth.uid()`; inserts must set `user_id = auth.uid()` (with-check).
- `prompt_versions`: readable by authenticated users; writable by service role only.
- `eval_items`, `eval_runs`: service role only.
- Policy tests are required (T11): anon reads nothing; user A cannot read user B's seed rows.

## Integrity rules enforced in application code (tested)

1. Commit transition (`draft → active`) sets `decided_at`, writes a `committed` event, creates 3 check-in rows, and freezes decision-time fields — subsequent edits only via `revised` events with payload diffs.
2. `recalled_probability` may only be written while `resolved = false` for that forecast, and the check-in UI must capture it before rendering the recorded value (F2 AC).
3. Judge input assembly selects **only**: title, context, rationale, options_considered, chosen_option, stakes, reversibility, forecasts (question + probability + desired), pre-mortem risks. An assertion test greps the assembled payload for outcome fields.
