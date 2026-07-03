-- T11: RLS on all user tables (DATA_MODEL.md §RLS is normative)
-- select-only for `authenticated` (writes are service-role only, rule 0);
-- eval tables get RLS enabled with zero policies (deny-all, not RLS-disabled)

-- local supabase no longer auto-exposes new tables to PostgREST roles by
-- default (config.toml api.auto_expose_new_tables) -- grant broadly and let
-- RLS policies, not GRANTs, be the actual restriction (standard convention)
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter table profiles enable row level security;
create policy profiles_select_own on profiles
  for select to authenticated
  using (user_id = auth.uid());

alter table decisions enable row level security;
create policy decisions_select_own on decisions
  for select to authenticated
  using (user_id = auth.uid());

alter table decision_events enable row level security;
create policy decision_events_select_own on decision_events
  for select to authenticated
  using (user_id = auth.uid());

alter table forecasts enable row level security;
create policy forecasts_select_own on forecasts
  for select to authenticated
  using (user_id = auth.uid());

alter table premortems enable row level security;
create policy premortems_select_own on premortems
  for select to authenticated
  using (user_id = auth.uid());

alter table premortem_risks enable row level security;
create policy premortem_risks_select_own on premortem_risks
  for select to authenticated
  using (user_id = auth.uid());

alter table checkins enable row level security;
create policy checkins_select_own on checkins
  for select to authenticated
  using (user_id = auth.uid());

alter table checkin_failures enable row level security;
create policy checkin_failures_select_own on checkin_failures
  for select to authenticated
  using (user_id = auth.uid());

alter table judge_scores enable row level security;
create policy judge_scores_select_own on judge_scores
  for select to authenticated
  using (user_id = auth.uid());

-- prompt_versions: readable by any authenticated user, no user_id column (shared registry)
alter table prompt_versions enable row level security;
create policy prompt_versions_select_authenticated on prompt_versions
  for select to authenticated
  using (true);

-- eval tables: RLS enabled, zero policies -- service role bypasses RLS entirely,
-- everyone else (anon/authenticated) gets nothing. deliberate, not an oversight --
-- an RLS-disabled table is served to every key by PostgREST (leaks gold-set content).
alter table eval_items enable row level security;
alter table eval_runs enable row level security;
