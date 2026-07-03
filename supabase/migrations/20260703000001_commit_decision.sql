-- T26: commit_decision RPC — draft->active is a single-statement (single
-- transaction) unit so a partial failure can't leave orphan events/checkins
-- next to an untouched draft. Locks the row (for update) so a concurrent
-- premortem regenerate sees the committed status before it inserts risks.

create or replace function commit_decision(
  p_decision_id uuid,
  p_user_id uuid,
  p_two_weeks timestamptz,
  p_two_months timestamptz,
  p_six_months timestamptz
) returns void
language plpgsql
as $$
declare
  v_status decision_status;
  v_owner uuid;
begin
  select status, user_id into v_status, v_owner
  from decisions where id = p_decision_id
  for update;

  if v_owner is null or v_owner <> p_user_id then
    raise exception 'decision not found';
  end if;
  if v_status <> 'draft' then
    raise exception 'only a draft decision can be committed';
  end if;

  update decisions set status = 'active', decided_at = now() where id = p_decision_id;

  insert into decision_events (user_id, decision_id, event_type, payload)
  values (p_user_id, p_decision_id, 'committed', '{}'::jsonb);

  insert into checkins (user_id, decision_id, horizon, scheduled_for)
  values
    (p_user_id, p_decision_id, 'two_weeks', p_two_weeks),
    (p_user_id, p_decision_id, 'two_months', p_two_months),
    (p_user_id, p_decision_id, 'six_months', p_six_months);
end;
$$;

-- p_user_id is a plain param, not derived from auth.uid() — anon/authenticated
-- calling this directly (bypassing the server action) could pass any user's id.
-- service-role only, same posture as the table grants in the RLS migration.
revoke execute on function commit_decision(uuid, uuid, timestamptz, timestamptz, timestamptz) from public;
grant execute on function commit_decision(uuid, uuid, timestamptz, timestamptz, timestamptz) to service_role;
