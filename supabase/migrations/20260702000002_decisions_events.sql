-- T06: decisions + decision_events (DATA_MODEL.md is normative)

create table decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null,
  context text not null,
  rationale text,
  options_considered jsonb not null default '[]',
  chosen_option text,
  stakes stakes_level not null default 'medium',
  reversibility reversibility not null default 'two_way',
  status decision_status not null default 'draft',
  decided_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- append-only event log; reversal frequency (M8) reads from here
create table decision_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id) on delete cascade,
  event_type decision_event_type not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index on decisions (user_id, status);
create index on decision_events (decision_id, created_at);
