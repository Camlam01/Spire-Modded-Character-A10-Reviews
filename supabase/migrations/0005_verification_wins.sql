-- Verification: a review is "Verified" when its author has 10 finished A10 runs or 3 A10 wins with the mod's
-- character. Scans now also send each character's A10 win count (shown nowhere publicly; it only decides the badge),
-- and only modded characters are kept.

alter table public.character_runs
  add column a10_wins integer not null default 0;
alter table public.character_runs
  add constraint character_runs_wins_check check (a10_wins between 0 and a10_runs);

-- Base-game characters are no longer stored.
delete from public.character_runs where character_id !~ '^CHARACTER\.[A-Z0-9_]+-';

-- New columns go last, so the view can be replaced in place.
create or replace view public.player_mod_run_stats with (security_invoker = true) as
  select c.steam_id, m.id as mod_id, sum(c.a10_runs)::int as a10_runs, max(c.last_played) as last_played,
         sum(c.a10_wins)::int as a10_wins
  from public.character_runs c
  join public.mods m on c.character_id = any (m.character_ids)
  group by c.steam_id, m.id;

grant all on all tables in schema public to service_role;
notify pgrst, 'reload schema';
