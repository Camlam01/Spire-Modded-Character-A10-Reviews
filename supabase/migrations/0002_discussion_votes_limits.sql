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
