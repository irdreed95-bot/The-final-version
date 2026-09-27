create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,name text,avatar_url text,phone text,username text unique,created_at timestamptz default now());
create table if not exists public.public_chat_messages(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,message text not null check(length(message)<=2000),created_at timestamptz default now());
create table if not exists public.project_requests(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,title text not null,details text,status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz default now());
create table if not exists public.direct_messages(id uuid primary key default gen_random_uuid(),sender_id uuid references auth.users(id) on delete cascade,receiver_id uuid references auth.users(id) on delete cascade,message text not null check(length(message)<=2000),created_at timestamptz default now());
alter table public.profiles enable row level security; alter table public.public_chat_messages enable row level security; alter table public.project_requests enable row level security; alter table public.direct_messages enable row level security;
create policy "profiles read" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update using (auth.uid()=id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid()=id);
create policy "chat read" on public.public_chat_messages for select using (true);
create policy "chat insert own" on public.public_chat_messages for insert with check (auth.uid()=user_id);
create policy "requests own read" on public.project_requests for select using (auth.uid()=user_id);
create policy "requests own insert" on public.project_requests for insert with check (auth.uid()=user_id);
create policy "dm participants read" on public.direct_messages for select using (auth.uid()=sender_id or auth.uid()=receiver_id);
create policy "dm sender insert" on public.direct_messages for insert with check (auth.uid()=sender_id);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,name) values(new.id,new.raw_user_meta_data->>'name'); return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();


-- Admin workspace
alter table public.profiles add column if not exists is_admin boolean not null default false;

create table if not exists public.admin_settings (
  id integer primary key default 1 check (id = 1),
  settings_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.admin_settings enable row level security;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

drop policy if exists "admin settings read" on public.admin_settings;
drop policy if exists "admin settings insert" on public.admin_settings;
drop policy if exists "admin settings update" on public.admin_settings;
create policy "admin settings read" on public.admin_settings for select using (public.is_current_user_admin());
create policy "admin settings insert" on public.admin_settings for insert with check (public.is_current_user_admin());
create policy "admin settings update" on public.admin_settings for update using (public.is_current_user_admin()) with check (public.is_current_user_admin());

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','replied','closed')),
  reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
drop policy if exists "ticket owner read" on public.support_tickets;
drop policy if exists "ticket owner insert" on public.support_tickets;
drop policy if exists "admin tickets read" on public.support_tickets;
drop policy if exists "admin tickets update" on public.support_tickets;
create policy "ticket owner read" on public.support_tickets for select using (auth.uid() = user_id);
create policy "ticket owner insert" on public.support_tickets for insert with check (auth.uid() = user_id);
create policy "admin tickets read" on public.support_tickets for select using (public.is_current_user_admin());
create policy "admin tickets update" on public.support_tickets for update using (public.is_current_user_admin()) with check (public.is_current_user_admin());

drop policy if exists "admin chat delete" on public.public_chat_messages;
create policy "admin chat delete" on public.public_chat_messages for delete using (public.is_current_user_admin());
