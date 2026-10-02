
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.reel_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  starting_target numeric not null check (starting_target > 0),
  current_target numeric not null check (current_target > 0),
  current_week integer not null default 1 check (current_week > 0),
  week_start date not null,
  week_end date not null,
  successful_weeks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reel_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  hours numeric not null check (hours >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, log_date)
);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> receiver_id)
);

alter table public.profiles enable row level security;
alter table public.reel_settings enable row level security;
alter table public.reel_logs enable row level security;
alter table public.connections enable row level security;

drop policy if exists "profiles own select" on public.profiles;
create policy "profiles own select" on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "reel settings own" on public.reel_settings;
create policy "reel settings own" on public.reel_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "reel logs own" on public.reel_logs;
create policy "reel logs own" on public.reel_logs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "connections participant select" on public.connections;
create policy "connections participant select" on public.connections for select to authenticated using (requester_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "connections requester insert" on public.connections;
create policy "connections requester insert" on public.connections for insert to authenticated with check (requester_id = auth.uid());

drop policy if exists "connections receiver update" on public.connections;
create policy "connections receiver update" on public.connections for update to authenticated using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());

-- The app's friend-data reads need a controlled way to read an accepted friend's
-- profile/logs/settings. For production, add SECURITY DEFINER RPCs for those reads
-- rather than exposing all profiles/logs. The starter UI keeps the policy surface
-- intentionally small; add those RPCs before exposing the deployed app publicly.
