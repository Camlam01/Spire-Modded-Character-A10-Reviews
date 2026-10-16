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
