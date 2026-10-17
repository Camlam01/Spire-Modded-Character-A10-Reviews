-- Reports: visitors flag reviews or comments for an admin to look at. Run after 0005_verification_wins.sql.

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('review', 'comment')),
  target_id    uuid not null,              -- no foreign key: a report outlives the content it points at
  mod_id       uuid references public.mods (id) on delete cascade,
  reporter     text not null references public.players (steam_id) on delete cascade,
  reason       text not null check (char_length(reason) between 1 and 500),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  unique (target_id, reporter)            -- one report per person per item
);
create index reports_open_idx on public.reports (created_at) where resolved_at is null;

alter table public.rate_events drop constraint rate_events_kind_check;
alter table public.rate_events add constraint rate_events_kind_check
  check (kind in ('mod', 'review', 'comment', 'vote', 'runs', 'report'));

alter table public.reports enable row level security;

grant all on all tables in schema public to service_role;
notify pgrst, 'reload schema';
