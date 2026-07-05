-- T55: per-option pre-mortems (P10). NULL = legacy/whole-decision pre-mortem.

alter table premortems add column option text;

create index on premortems (decision_id, option);
