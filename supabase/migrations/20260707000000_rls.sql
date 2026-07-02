-- T11: RLS on all user tables (see DATA_MODEL.md#RLS)

alter table profiles enable row level security;
alter table decisions enable row level security;
alter table decision_events enable row level security;
alter table forecasts enable row level security;
alter table premortems enable row level security;
alter table premortem_risks enable row level security;
alter table checkins enable row level security;
alter table checkin_failures enable row level security;
alter table prompt_versions enable row level security;
alter table judge_scores enable row level security;
alter table eval_items enable row level security;
alter table eval_runs enable row level security;

-- profiles: pk column is user_id itself
create policy "profiles_select_own" on profiles for select using (user_id = auth.uid());
create policy "profiles_insert_own" on profiles for insert with check (user_id = auth.uid());
create policy "profiles_update_own" on profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles_delete_own" on profiles for delete using (user_id = auth.uid());

create policy "decisions_select_own" on decisions for select using (user_id = auth.uid());
create policy "decisions_insert_own" on decisions for insert with check (user_id = auth.uid());
create policy "decisions_update_own" on decisions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "decisions_delete_own" on decisions for delete using (user_id = auth.uid());

create policy "decision_events_select_own" on decision_events for select using (user_id = auth.uid());
create policy "decision_events_insert_own" on decision_events for insert with check (user_id = auth.uid());
create policy "decision_events_update_own" on decision_events for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "decision_events_delete_own" on decision_events for delete using (user_id = auth.uid());

create policy "forecasts_select_own" on forecasts for select using (user_id = auth.uid());
create policy "forecasts_insert_own" on forecasts for insert with check (user_id = auth.uid());
create policy "forecasts_update_own" on forecasts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "forecasts_delete_own" on forecasts for delete using (user_id = auth.uid());

create policy "premortems_select_own" on premortems for select using (user_id = auth.uid());
create policy "premortems_insert_own" on premortems for insert with check (user_id = auth.uid());
create policy "premortems_update_own" on premortems for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "premortems_delete_own" on premortems for delete using (user_id = auth.uid());

create policy "premortem_risks_select_own" on premortem_risks for select using (user_id = auth.uid());
create policy "premortem_risks_insert_own" on premortem_risks for insert with check (user_id = auth.uid());
create policy "premortem_risks_update_own" on premortem_risks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "premortem_risks_delete_own" on premortem_risks for delete using (user_id = auth.uid());

create policy "checkins_select_own" on checkins for select using (user_id = auth.uid());
create policy "checkins_insert_own" on checkins for insert with check (user_id = auth.uid());
create policy "checkins_update_own" on checkins for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "checkins_delete_own" on checkins for delete using (user_id = auth.uid());

create policy "checkin_failures_select_own" on checkin_failures for select using (user_id = auth.uid());
create policy "checkin_failures_insert_own" on checkin_failures for insert with check (user_id = auth.uid());
create policy "checkin_failures_update_own" on checkin_failures for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "checkin_failures_delete_own" on checkin_failures for delete using (user_id = auth.uid());

-- prompt_versions: read-only for any authenticated user, writes via service role (bypasses RLS) only
create policy "prompt_versions_select_authenticated" on prompt_versions for select to authenticated using (true);

-- judge_scores follows the same owner-scoped shape as the other user tables
create policy "judge_scores_select_own" on judge_scores for select using (user_id = auth.uid());
create policy "judge_scores_insert_own" on judge_scores for insert with check (user_id = auth.uid());
create policy "judge_scores_update_own" on judge_scores for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "judge_scores_delete_own" on judge_scores for delete using (user_id = auth.uid());

-- eval_items, eval_runs: no policies at all -- service role bypasses RLS, everyone else gets nothing

-- Table grants: RLS policies only filter rows, Postgres still needs the base
-- privilege before a role can attempt the statement at all. supabase_admin's
-- default privileges don't cover tables created by plain migrations, so
-- these have to be explicit.
grant select, insert, update, delete on
  profiles, decisions, decision_events, forecasts, premortems, premortem_risks,
  checkins, checkin_failures, judge_scores
  to authenticated, service_role;

grant select on
  profiles, decisions, decision_events, forecasts, premortems, premortem_risks,
  checkins, checkin_failures, judge_scores
  to anon;

grant select, insert, update, delete on prompt_versions to service_role;
grant select on prompt_versions to authenticated, anon;

-- service role only: authenticated/anon get schema usage but no table
-- privileges, so any attempted query is denied outright (not just RLS-empty)
grant select, insert, update, delete on eval_items, eval_runs to service_role;
