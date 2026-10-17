-- STS2 Character Mod Reviews: complete database setup.
-- Paste this whole file into Supabase → SQL Editor and run it once, on a new project.
-- Generated from supabase/migrations by `npm run db:bundle`; don't edit it by hand.
-- Already set up? Run only the migration files you haven't run yet instead.

-- ===== 0001_init.sql =====

-- STS2 Character Mod Reviews: initial schema.
-- Run this once in Supabase → SQL Editor (or with `supabase db push`).
--
-- Access model: the Next.js server talks to the database with the service-role key.
-- Row level security is switched on with no policies, so the public anon key can read
-- and write nothing. Players are identified by their SteamID64 from Steam sign-in.

create extension if not exists pgcrypto;

-- Metric ids must match lib/metrics.ts.
create or replace function public.valid_scores(s jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(s) = 'object'
    and not exists (
      select 1 from jsonb_each(s) e
      where e.key not in (
          'art','aes_consistency','immersion',
          'uniqueness','compatibility','mech_consistency','completeness','complexity','playability',
          'difficulty','adaptability','snowballing','outliers',
          'enjoyment','fulfilment')
        or jsonb_typeof(e.value) <> 'number'
        or (e.value)::numeric < 0
        or (e.value)::numeric > 10
        or ((e.value)::numeric * 2) <> round((e.value)::numeric * 2)
    )
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table public.players (
  steam_id         text primary key check (steam_id ~ '^[0-9]{17}$'),
  persona_name     text not null default '',
  avatar_url       text,
  profile_url      text,
  owns_game        boolean,          -- null when the player's game list is private
  playtime_minutes integer,          -- STS2 playtime, null when private
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.mods (
  id               uuid primary key default gen_random_uuid(),
  workshop_id      text not null unique check (workshop_id ~ '^[0-9]{1,20}$'),
  title            text not null check (char_length(title) between 1 and 200),
  description      text not null default '' check (char_length(description) <= 600),
  preview_url      text,
  creator_steam_id text,
  creator_name     text,
  added_by         text references public.players (steam_id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  mod_id     uuid not null references public.mods (id) on delete cascade,
  steam_id   text not null references public.players (steam_id) on delete cascade,
  a10_runs   integer check (a10_runs between 0 and 100000),
  notes      text not null default '' check (char_length(notes) <= 4000),
  scores     jsonb not null check (public.valid_scores(scores) and scores <> '{}'::jsonb),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mod_id, steam_id)
);
create index reviews_mod_id_idx on public.reviews (mod_id);

create trigger players_touch before update on public.players for each row execute function public.touch_updated_at();
create trigger mods_touch    before update on public.mods    for each row execute function public.touch_updated_at();
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();

-- Per-mod, per-metric average across every review: the "combined review".
create view public.mod_metric_stats with (security_invoker = true) as
  select r.mod_id,
         s.key                      as metric,
         avg((s.value)::numeric)    as avg_score,
         count(*)::int              as n
  from public.reviews r
  cross join lateral jsonb_each(r.scores) s
  group by r.mod_id, s.key;

alter table public.players enable row level security;
alter table public.mods    enable row level security;
alter table public.reviews enable row level security;

-- ===== 0002_discussion_votes_limits.sql =====

-- Metric notes, discussion comments, helpful votes, rate limiting and Workshop refresh.
-- Run after 0001_init.sql, in Supabase → SQL Editor.

-- A short note per metric score, explaining the reviewer's decision.
create or replace function public.valid_metric_notes(s jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(s) = 'object'
    and not exists (
      select 1 from jsonb_each(s) e
      where e.key not in (
          'art','aes_consistency','immersion',
          'uniqueness','compatibility','mech_consistency','completeness','complexity','playability',
          'difficulty','adaptability','snowballing','outliers',
          'enjoyment','fulfilment')
        or jsonb_typeof(e.value) <> 'string'
        or char_length(e.value #>> '{}') > 500
    )
$$;

alter table public.reviews
  add column metric_notes jsonb not null default '{}'::jsonb check (public.valid_metric_notes(metric_notes));

-- Discussion under a review (review_id set) or under a mod's combined review (review_id null).
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  mod_id     uuid not null references public.mods (id) on delete cascade,
  review_id  uuid references public.reviews (id) on delete cascade,
  steam_id   text not null references public.players (steam_id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_mod_id_idx on public.comments (mod_id, created_at);
create trigger comments_touch before update on public.comments for each row execute function public.touch_updated_at();

-- "Helpful" votes on reviews. One per player per review.
create table public.review_votes (
  review_id  uuid not null references public.reviews (id) on delete cascade,
  steam_id   text not null references public.players (steam_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, steam_id)
);

-- A log of write actions, used to rate-limit each player.
create table public.rate_events (
  id         bigint generated always as identity primary key,
  steam_id   text not null,
  kind       text not null check (kind in ('mod', 'review', 'comment', 'vote')),
  created_at timestamptz not null default now()
);
create index rate_events_lookup_idx on public.rate_events (steam_id, kind, created_at desc);

-- Workshop details kept in sync with Steam.
alter table public.mods
  add column workshop_updated_at timestamptz,
  add column subscriptions       integer,
  add column synced_at           timestamptz not null default now();

alter table public.comments     enable row level security;
alter table public.review_votes enable row level security;
alter table public.rate_events  enable row level security;

-- ===== 0003_verified_runs.sql =====

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

-- ===== 0004_service_role_grants.sql =====

-- Make sure the site's server key can use every table and view, including ones created later, and tell the API to
-- pick up the new tables straight away. Some Supabase projects don't grant this automatically to objects created in
-- the SQL Editor. The service role key is only ever used on the server; the public key stays blocked.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

notify pgrst, 'reload schema';

-- ===== 0005_verification_wins.sql =====

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
