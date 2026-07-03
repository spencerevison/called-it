-- T09: checkins, checkin_failures (DATA_MODEL.md is normative)
-- also adds the resolved_in_checkin_id FK on forecasts, deferred from T07

create table checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id) on delete cascade,
  horizon checkin_horizon not null,
  scheduled_for timestamptz not null,
  status checkin_status not null default 'pending',
  trigger_run_id text,
  outcome_notes text,
  overall_attribution attribution,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'completed' or (overall_attribution is not null and completed_at is not null))
);

-- what actually went wrong, linked back to pre-mortem risks (or unlisted)
create table checkin_failures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  checkin_id uuid not null references checkins(id) on delete cascade,
  description text not null,
  linked_risk_id uuid references premortem_risks(id),
  was_knowable boolean not null default true,
  attribution attribution not null,
  created_at timestamptz not null default now()
);

alter table forecasts
  add constraint forecasts_resolved_in_checkin_id_fkey
  foreign key (resolved_in_checkin_id) references checkins(id);

create index on checkins (status, scheduled_for);
create index on checkins (decision_id);
create unique index on checkins (decision_id, horizon) where horizon <> 'custom';
create index on checkin_failures (checkin_id);
