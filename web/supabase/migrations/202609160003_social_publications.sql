begin;
create table if not exists public.social_publications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 content_id text not null, platform text not null check(platform in ('Facebook','Instagram','TikTok','LinkedIn','Pinterest','X')),
 account_id text not null, external_id text not null, published_at timestamptz not null default now(),
 unique(user_id,content_id,platform,account_id)
);
alter table public.social_publications enable row level security;
revoke all on public.social_publications from anon,authenticated;
grant select,insert,update,delete on public.social_publications to authenticated;
create policy "Owners read publications" on public.social_publications for select to authenticated using ((select auth.uid())=user_id);
create policy "Owners add publications" on public.social_publications for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Owners update publications" on public.social_publications for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Owners delete publications" on public.social_publications for delete to authenticated using ((select auth.uid())=user_id);
commit;
notify pgrst, 'reload schema';
