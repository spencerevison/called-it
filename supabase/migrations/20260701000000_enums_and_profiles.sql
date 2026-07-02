-- T05: enums + profiles (see DATA_MODEL.md)

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

-- thin profile row, auth.users stays canonical
create table profiles (
  user_id uuid primary key references auth.users(id),
  display_name text,
  created_at timestamptz not null default now()
);
