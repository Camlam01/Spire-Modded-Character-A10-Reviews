-- Run-file verification: players scan their STS2 run history on their profile, and the site keeps one count per
-- character: how many A10 runs they've played with it. Individual runs are never stored.
-- Run after 0002_discussion_votes_limits.sql.

-- Which in-game character ids belong to each mod, e.g. CHARACTER.THETAILOR-THE_TAILOR. Linked automatically by
-- matching the mod's Workshop title, or by the first reviewer when the title doesn't match. A mod can have more than
-- one (a character renamed between versions, or a mod with several characters).
alter table public.mods
  add column character_ids        text[] not null default '{}',
  add column workshop_created_at  timestamptz;

alter table public.players
  add column runs_scanned_at timestamptz;

-- A player's verified A10 runs per character: solo, standard mode, Ascension 10+, not abandoned. Wins and losses both
-- count, and which one it was is never sent. Each scan replaces the counts for the characters it finds.
create table public.character_runs (
  steam_id     text not null references public.players (steam_id) on delete cascade,
  character_id text not null check (character_id ~ '^CHARACTER\.[A-Z0-9_.-]{1,120}$'),
  a10_runs     integer not null check (a10_runs between 1 and 100000),
  last_played  timestamptz not null,
  updated_at   timestamptz not null default now(),
  primary key (steam_id, character_id)
);
create index character_runs_character_idx on public.character_runs (character_id);

-- A player's A10 runs with a mod's characters.
create view public.player_mod_run_stats with (security_invoker = true) as
  select c.steam_id, m.id as mod_id, sum(c.a10_runs)::int as a10_runs, max(c.last_played) as last_played
  from public.character_runs c
  join public.mods m on c.character_id = any (m.character_ids)
  group by c.steam_id, m.id;

-- Every character anyone has verified runs with, for linking mods to characters.
create view public.known_characters with (security_invoker = true) as
  select distinct character_id from public.character_runs;

alter table public.rate_events drop constraint rate_events_kind_check;
alter table public.rate_events add constraint rate_events_kind_check check (kind in ('mod', 'review', 'comment', 'vote', 'runs'));

alter table public.character_runs enable row level security;
