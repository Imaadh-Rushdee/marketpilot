begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketpilot-assets', 'marketpilot-assets', false, 10000000, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false, file_size_limit=10000000, allowed_mime_types=excluded.allowed_mime_types;
create policy "MarketPilot owners read assets" on storage.objects for select to authenticated
using (bucket_id='marketpilot-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "MarketPilot owners upload assets" on storage.objects for insert to authenticated
with check (bucket_id='marketpilot-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "MarketPilot owners delete assets" on storage.objects for delete to authenticated
using (bucket_id='marketpilot-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create table public.marketpilot_graphics (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 path text not null, kind text not null check (kind in ('post','ad','banner')),
 format text not null check (format in ('square','portrait','landscape')),
 headline text not null, demo boolean not null default false,
 created_at timestamptz not null default now(),
 check (split_part(path,'/',1)=user_id::text)
);
alter table public.marketpilot_graphics enable row level security;
revoke all on public.marketpilot_graphics from anon, authenticated;
grant select, insert, delete on public.marketpilot_graphics to authenticated;
create policy "Owners read graphics" on public.marketpilot_graphics for select to authenticated using ((select auth.uid())=user_id);
create policy "Owners save graphics" on public.marketpilot_graphics for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Owners remove graphics" on public.marketpilot_graphics for delete to authenticated using ((select auth.uid())=user_id);
create index on public.marketpilot_graphics (user_id, created_at desc);
commit;
notify pgrst, 'reload schema';
