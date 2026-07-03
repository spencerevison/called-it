-- T07: forecasts (DATA_MODEL.md is normative)
-- resolved_in_checkin_id FK to checkins added in T09 (checkins comes after forecasts)

create table forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  decision_id uuid not null references decisions(id) on delete cascade,
  question text not null,
  probability numeric(4,3) not null check (probability >= 0.01 and probability <= 0.99),
  desired boolean not null default true,
  resolve_by date,
  -- resolution (set at check-in)
  resolved boolean not null default false,
  outcome boolean,
  resolved_in_checkin_id uuid,
  recalled_probability numeric(4,3),
  recalled_at timestamptz,
  revealed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (resolved = false or outcome is not null)
);

create index on forecasts (decision_id);
create index on forecasts (user_id, resolved);
create index on forecasts (resolved_in_checkin_id);
