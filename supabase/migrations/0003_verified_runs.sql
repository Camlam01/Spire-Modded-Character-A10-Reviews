-- Run-file verification: players scan their STS2 run history once, on their profile. Their A10 runs with every
-- character are stored, and each mod counts the runs with its own character. Run after 0002_discussion_votes_limits.sql.

-- Which in-game character ids belong to each mod, e.g. CHARACTER.THETAILOR-THE_TAILOR. Linked automatically by
-- matching the mod's Workshop title, or by the first reviewer when the title doesn't match. A mod can have more than
-- one (a character renamed between versions, or a mod with several characters).
alter table public.mods
  add column character_ids        text[] not null default '{}',
  add column workshop_created_at  timestamptz;

alter table public.players
  add column runs_scanned_at timestamptz;

-- One row per qualifying run: solo, standard mode, Ascension 10 or higher, not abandoned (wins and losses both count;
-- which one it was is never sent). The raw files never leave the player's computer.
create table public.verified_runs (
  steam_id     text not null references public.players (steam_id) on delete cascade,
  character_id text not null check (character_id ~ '^CHARACTER\.[A-Z0-9_.-]{1,120}$'),
  seed         text not null check (seed ~ '^[A-Z0-9]{1,32}$'),
  start_time   timestamptz not null,
  ascension    integer not null check (ascension between 10 and 20),
  run_time     integer not null check (run_time between 0 and 604800),  -- seconds; a run left open can pass a day
  build_id     text not null check (char_length(build_id) <= 40),
  uploaded_at  timestamptz not null default now(),
  primary key (steam_id, seed, start_time)
);
create index verified_runs_character_idx on public.verified_runs (character_id, steam_id);
create index verified_runs_run_idx on public.verified_runs (seed, start_time);

-- A player's A10 runs per character, for their profile.
create view public.player_character_runs with (security_invoker = true) as
  select steam_id, character_id, count(*)::int as a10_runs, max(start_time) as last_played
  from public.verified_runs
  group by steam_id, character_id;

-- A player's A10 runs with a mod's characters, ignoring runs dated before the mod was published.
create view public.player_mod_run_stats with (security_invoker = true) as
  select v.steam_id, m.id as mod_id, count(*)::int as a10_runs, max(v.start_time) as last_played
  from public.verified_runs v
  join public.mods m
    on v.character_id = any (m.character_ids)
   and (m.workshop_created_at is null or v.start_time >= m.workshop_created_at - interval '1 day')
  group by v.steam_id, m.id;

-- Every character anyone has verified runs with, for linking mods to characters.
create view public.known_characters with (security_invoker = true) as
  select distinct character_id from public.verified_runs;

alter table public.rate_events drop constraint rate_events_kind_check;
alter table public.rate_events add constraint rate_events_kind_check check (kind in ('mod', 'review', 'comment', 'vote', 'runs'));

alter table public.verified_runs enable row level security;
