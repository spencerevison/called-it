-- T35: resolve_decision RPC — mirrors commit_decision's shape (lock, check,
-- single-transaction multi-table write). Terminal transition: active -> resolved/abandoned,
-- sets resolved_at, writes the terminal event, and skips any check-in that hasn't
-- fired yet so the reminder/reconcile cron never resurfaces it (DATA_MODEL rule 5).

create or replace function resolve_decision(
  p_decision_id uuid,
  p_user_id uuid,
  p_status decision_status
) returns void
language plpgsql
as $$
declare
  v_status decision_status;
  v_owner uuid;
begin
  if p_status not in ('resolved', 'abandoned') then
    raise exception 'p_status must be resolved or abandoned';
  end if;

  select status, user_id into v_status, v_owner
  from decisions where id = p_decision_id
  for update;

  if v_owner is null or v_owner <> p_user_id then
    raise exception 'decision not found';
  end if;
  if v_status <> 'active' then
    raise exception 'only an active decision can be resolved or abandoned';
  end if;

  update decisions set status = p_status, resolved_at = now() where id = p_decision_id;

  -- p_status shares its two terminal labels with decision_event_type but is a
  -- distinct enum type -- postgres won't implicitly cross-cast, so go via text
  insert into decision_events (user_id, decision_id, event_type, payload)
  values (p_user_id, p_decision_id, p_status::text::decision_event_type, '{}'::jsonb);

  update checkins
  set status = 'skipped'
  where decision_id = p_decision_id
    and status in ('pending', 'due');
end;
$$;

revoke execute on function resolve_decision(uuid, uuid, decision_status) from public;
grant execute on function resolve_decision(uuid, uuid, decision_status) to service_role;
