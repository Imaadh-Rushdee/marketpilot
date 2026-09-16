begin;
create table public.social_connections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check (provider in ('meta','tiktok')), platform text not null check (platform in ('Facebook','Instagram','TikTok')),
 account_id text not null, account_name text not null, token_ciphertext text not null,
 metadata jsonb not null default '{}'::jsonb, expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,platform,account_id)
);
alter table public.social_connections enable row level security;
revoke all on public.social_connections from anon,authenticated;
grant select,insert,update,delete on public.social_connections to authenticated;
create policy "Owners read social connections" on public.social_connections for select to authenticated using ((select auth.uid())=user_id);
create policy "Owners add social connections" on public.social_connections for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Owners update social connections" on public.social_connections for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Owners delete social connections" on public.social_connections for delete to authenticated using ((select auth.uid())=user_id);
create index social_connections_owner on public.social_connections(user_id,platform);
commit;
notify pgrst, 'reload schema';
