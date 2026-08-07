-- 002_sync_state.sql — high-water-mark table for the delta-sync Edge Function.
-- Run in the Supabase SQL editor (after 001_init.sql).
-- Required ONLY if you use the wc-delta-sync Edge Function. The Express
-- woocommerce-api-wrapper uses a local data/sync-state.json file instead.

create table if not exists public.wc_sync_state (
  id int primary key default 1,
  last_modified timestamptz
);

insert into public.wc_sync_state (id, last_modified) values (1, null)
  on conflict (id) do nothing;
