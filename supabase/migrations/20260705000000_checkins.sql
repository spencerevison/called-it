-- T09: checkins, checkin_failures (see DATA_MODEL.md)

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

-- what actually went wrong, linked back to pre-mortem risks (or unlisted)
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

create index on checkins (status, scheduled_for);   -- reconciliation cron scan
create index on checkins (decision_id);
create index on checkin_failures (checkin_id);
