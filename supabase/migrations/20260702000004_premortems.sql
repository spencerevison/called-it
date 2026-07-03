-- T08: premortems, premortem_risks (DATA_MODEL.md is normative)
-- premortems.prompt_version FK to prompt_versions added in T10 (prompt_versions comes after premortems)

create table premortems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id) on delete cascade,
  prompt_version text not null,
  model text not null,
  langfuse_trace_id text,
  created_at timestamptz not null default now()
);

-- risks as rows so check-in failures can link back to them
create table premortem_risks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  premortem_id uuid not null references premortems(id) on delete cascade,
  description text not null,
  category text not null check (category in ('execution','external','information','motivated_reasoning','second_order')),
  severity risk_severity not null,
  likelihood numeric(4,3),
  source risk_source not null default 'ai',
  created_at timestamptz not null default now()
);

create index on premortems (decision_id);
create index on premortem_risks (premortem_id);
