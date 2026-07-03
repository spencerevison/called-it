-- T10: prompt_versions, judge_scores, eval_items, eval_runs (DATA_MODEL.md is normative)
-- also adds the premortems.prompt_version FK, deferred from T08

create table prompt_versions (
  id text primary key,
  kind prompt_kind not null,
  file_path text not null,
  content_hash text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table judge_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id) on delete cascade,
  prompt_version text not null references prompt_versions(id),
  model text not null,
  input_hash text not null,
  scores jsonb not null,
  rationale jsonb not null,
  contamination boolean not null default false,
  langfuse_trace_id text,
  created_at timestamptz not null default now()
);

-- eval tables: service-role only, no user RLS access (see T11)
create table eval_items (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  prompt_versions text[] not null,
  metrics jsonb not null,
  report_path text,
  created_at timestamptz not null default now()
);

alter table premortems
  add constraint premortems_prompt_version_fkey
  foreign key (prompt_version) references prompt_versions(id);

create index on judge_scores (decision_id);
