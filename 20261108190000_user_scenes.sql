create table if not exists public.user_scenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null check (octet_length(prompt) <= 2800),
  scene jsonb not null check (pg_column_size(scene) <= 262144),
  created_at timestamptz not null default now()
);

create index if not exists user_scenes_owner_created_at_idx
  on public.user_scenes (user_id, created_at desc);

alter table public.user_scenes enable row level security;

revoke all on table public.user_scenes from anon, authenticated;
grant select, insert, update, delete on table public.user_scenes to authenticated;

drop policy if exists "Owners can read their scenes" on public.user_scenes;
create policy "Owners can read their scenes"
  on public.user_scenes for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Owners can create their scenes" on public.user_scenes;
create policy "Owners can create their scenes"
  on public.user_scenes for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can update their scenes" on public.user_scenes;
create policy "Owners can update their scenes"
  on public.user_scenes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can delete their scenes" on public.user_scenes;
create policy "Owners can delete their scenes"
  on public.user_scenes for delete to authenticated
  using ((select auth.uid()) = user_id);
