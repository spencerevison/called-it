-- T26: draft -> active commit, as a single-transaction RPC (a plain function
-- body is implicitly one transaction -- any raised exception rolls back
-- everything the function already did, incl. the earlier decisions update).
create or replace function commit_decision(
  p_decision_id uuid,
  p_checkin_two_weeks timestamptz,
  p_checkin_two_months timestamptz,
  p_checkin_six_months timestamptz
) returns decisions
language plpgsql
security invoker
as $$
declare
  v_decision decisions;
begin
  update decisions
    set status = 'active', decided_at = now()
    where id = p_decision_id and user_id = auth.uid() and status = 'draft'
    returning * into v_decision;

  if not found then
    raise exception 'decision not found, not owned, or not in draft status';
  end if;

  insert into decision_events (user_id, decision_id, event_type, payload)
    values (auth.uid(), p_decision_id, 'committed', '{}'::jsonb);

  insert into checkins (user_id, decision_id, horizon, scheduled_for)
    values
      (auth.uid(), p_decision_id, 'two_weeks', p_checkin_two_weeks),
      (auth.uid(), p_decision_id, 'two_months', p_checkin_two_months),
      (auth.uid(), p_decision_id, 'six_months', p_checkin_six_months);

  return v_decision;
end;
$$;

grant execute on function commit_decision(uuid, timestamptz, timestamptz, timestamptz) to authenticated;
