-- Phase 2B: single-row JSONB store for the whole AppData blob.
-- Apply once in the Supabase dashboard (SQL editor).

create table app_state (
  id   int primary key default 1,
  data jsonb not null,
  constraint app_state_singleton check (id = 1)
);

alter table app_state enable row level security;

-- Anon read/write on the single row. The PIN gate stays client-side.
-- See the spec's "Security tradeoff" section: the anon key is public, so this
-- policy is effectively open — acceptable for one shop's internal ledger, and
-- hardenable later without domain/UI changes.
create policy app_state_rw on app_state
  for all
  using (true)
  with check (true);
