create table if not exists public.ecodna_reports (
  id text primary key,
  created_at timestamptz not null,
  report jsonb not null,
  inserted_at timestamptz not null default now(),
  reporter_username text generated always as (nullif(report->>'reporterUsername', '')) stored,
  location_name text generated always as (coalesce(nullif(report->>'locationName', ''), 'Unnamed location')) stored,
  latitude double precision generated always as ((report->>'latitude')::double precision) stored,
  longitude double precision generated always as ((report->>'longitude')::double precision) stored,
  item_count integer generated always as (jsonb_array_length(report->'items')) stored,
  primary_category text generated always as (report #>> '{items,0,category}') stored,
  primary_packaging_type text generated always as (report #>> '{items,0,packagingType}') stored,
  primary_likely_material text generated always as (report #>> '{items,0,likelyMaterial}') stored,
  primary_confidence double precision generated always as ((report #>> '{items,0,confidence}')::double precision) stored
);

-- The ALTER statements make this safe to run on an existing EcoDNA table.
alter table public.ecodna_reports
  add column if not exists reporter_username text generated always as (nullif(report->>'reporterUsername', '')) stored,
  add column if not exists location_name text generated always as (coalesce(nullif(report->>'locationName', ''), 'Unnamed location')) stored,
  add column if not exists latitude double precision generated always as ((report->>'latitude')::double precision) stored,
  add column if not exists longitude double precision generated always as ((report->>'longitude')::double precision) stored,
  add column if not exists item_count integer generated always as (jsonb_array_length(report->'items')) stored,
  add column if not exists primary_category text generated always as (report #>> '{items,0,category}') stored,
  add column if not exists primary_packaging_type text generated always as (report #>> '{items,0,packagingType}') stored,
  add column if not exists primary_likely_material text generated always as (report #>> '{items,0,likelyMaterial}') stored,
  add column if not exists primary_confidence double precision generated always as ((report #>> '{items,0,confidence}')::double precision) stored;

create index if not exists ecodna_reports_created_at_idx
  on public.ecodna_reports (created_at desc);

alter table public.ecodna_reports enable row level security;

-- EcoDNA accesses this table only from the Next.js server using the Supabase
-- service-role key. No anonymous/browser policy is intentionally created.

-- A compact, human-readable view for the Table Editor and dashboard checks.
create or replace view public.ecodna_observation_summary as
select
  id,
  created_at as observed_at,
  location_name,
  latitude,
  longitude,
  item_count,
  primary_category,
  primary_packaging_type,
  primary_likely_material,
  round(primary_confidence::numeric, 2) as primary_confidence,
  inserted_at,
  reporter_username
from public.ecodna_reports;

-- A one-row-per-item view: useful when an observation contains several pieces of waste.
create or replace view public.ecodna_report_items as
select
  report_row.id as observation_id,
  report_row.created_at as observed_at,
  report_row.location_name,
  report_row.latitude,
  report_row.longitude,
  item->>'brand' as brand,
  item->>'category' as category,
  item->>'packagingType' as packaging_type,
  item->>'likelyMaterial' as likely_material,
  round((item->>'confidence')::numeric, 2) as confidence,
  report_row.reporter_username
from public.ecodna_reports as report_row
cross join lateral jsonb_array_elements(report_row.report->'items') as item;

-- Shared action records used for before/after intervention tracking.
create table if not exists public.ecodna_interventions (
  id text primary key,
  area_key text not null,
  deployed_at date not null,
  created_at timestamptz not null,
  intervention jsonb not null
);

create index if not exists ecodna_interventions_area_idx
  on public.ecodna_interventions (area_key, deployed_at desc);

alter table public.ecodna_interventions enable row level security;

-- Application roles. Authentication credentials remain managed by Supabase Auth.
create table if not exists public.ecodna_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  role text not null default 'reporter' check (role in ('reporter', 'reviewer')),
  reward_points integer not null default 0 check (reward_points >= 0),
  created_at timestamptz not null default now()
);

alter table public.ecodna_profiles
  add column if not exists username text,
  add column if not exists reward_points integer not null default 0;

create unique index if not exists ecodna_profiles_username_idx
  on public.ecodna_profiles (lower(username))
  where username is not null;

alter table public.ecodna_profiles enable row level security;

create or replace function public.create_ecodna_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.ecodna_profiles (user_id, username, role)
  values (new.id, nullif(lower(new.raw_user_meta_data->>'username'), ''), 'reporter')
  on conflict (user_id) do update set
    username = coalesce(public.ecodna_profiles.username, excluded.username);
  return new;
end;
$$;

drop trigger if exists ecodna_auth_user_created on auth.users;
create trigger ecodna_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_ecodna_profile();

-- Backfill profiles for accounts created before this script was run.
insert into public.ecodna_profiles (user_id, role)
select id, 'reporter' from auth.users
on conflict (user_id) do nothing;

-- Immutable reward ledger. The unique report_id guarantees that approving the
-- same observation again cannot award points twice.
create table if not exists public.ecodna_rewards (
  id bigint generated by default as identity primary key,
  report_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null default 10 check (points > 0),
  reason text not null default 'Approved litter observation',
  awarded_at timestamptz not null default now()
);

create index if not exists ecodna_rewards_user_idx
  on public.ecodna_rewards (user_id, awarded_at desc);

alter table public.ecodna_rewards enable row level security;

-- Readable leaderboard for the Supabase Table Editor. EcoDNA itself reads
-- profile totals through its server-side API.
create or replace view public.ecodna_reward_leaderboard as
select
  profile.username,
  profile.reward_points,
  count(reward.id)::integer as approved_reports,
  max(reward.awarded_at) as latest_reward_at
from public.ecodna_profiles as profile
left join public.ecodna_rewards as reward on reward.user_id = profile.user_id
where profile.role = 'reporter'
group by profile.user_id, profile.username, profile.reward_points
order by profile.reward_points desc, latest_reward_at asc nulls last;

-- Promote a trusted reviewer after creating their Auth account:
-- update public.ecodna_profiles set role = 'reviewer'
-- where user_id = (select id from auth.users where email = 'reviewer@example.com');

-- Private evidence-photo bucket. Uploads and downloads go through EcoDNA's
-- server routes; no anonymous Storage policy is created.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ecodna-evidence', 'ecodna-evidence', false, 1048576, array['image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
