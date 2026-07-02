-- T10: prompt_versions, judge_scores, eval_items, eval_runs (see DATA_MODEL.md)

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
  scores jsonb not null,        -- {risk_comprehensiveness, calibration_given_knowable, process_quality} ints 1-5
  rationale jsonb not null,     -- {rationale:{<dim>:text}, evidence_spans:[...]}
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

create index on judge_scores (decision_id);
