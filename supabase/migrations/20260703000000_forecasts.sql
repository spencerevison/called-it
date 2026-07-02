-- T07: forecasts (see DATA_MODEL.md)

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

create index on forecasts (decision_id);
create index on forecasts (user_id, resolved);
